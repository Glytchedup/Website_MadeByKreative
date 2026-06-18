import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { addStock, queueEtsyPush } from "@/lib/inventory";
import { sendOrderConfirmation } from "@/lib/email";

export const runtime = "nodejs";

// Restore reserved stock for an order that didn't complete (expired/failed).
async function releaseOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.status !== "pending") return; // only release un-paid reservations
  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await addStock(
        item.variantId,
        item.quantity,
        { reason: "manual_correction", channel: "system", referenceId: orderId, note: "Released abandoned checkout" },
        tx
      );
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
  });
  // Push restored availability back to Etsy.
  for (const item of order.items) {
    const v = await prisma.variant.findUnique({ where: { id: item.variantId } });
    if (v?.etsyListingId) await queueEtsyPush(v.id, v.quantity).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ received: true, note: "stripe disabled" });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!sig || !secret) throw new Error("missing signature/secret");
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${String(err)}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
        if (order && order.status === "pending") {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: "paid",
              email: session.customer_details?.email || order.email,
              shippingName: session.customer_details?.name || null,
              shippingAddress: session.customer_details?.address
                ? JSON.stringify(session.customer_details.address)
                : null,
              totalCents: session.amount_total ?? order.totalCents,
            },
          });
          // Stock was already reserved at checkout; just confirm Etsy is in sync.
          for (const item of order.items) {
            const v = await prisma.variant.findUnique({ where: { id: item.variantId } });
            if (v?.etsyListingId) await queueEtsyPush(v.id, v.quantity).catch(() => {});
          }
          // Transactional confirmation email.
          await sendOrderConfirmation({
            to: session.customer_details?.email || order.email,
            orderId: order.id,
            items: order.items.map((i) => ({
              title: i.productTitle,
              variant: i.variantName,
              quantity: i.quantity,
              unitPriceCents: i.unitPriceCents,
            })),
            totalCents: session.amount_total ?? order.totalCents,
          }).catch((e) => console.error("email failed", e));
        }
      }
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) await releaseOrder(orderId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
