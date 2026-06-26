import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { forceDecrement, queueEtsyPush, tryReserve } from "@/lib/inventory";
import { releaseOrder } from "@/lib/orders";
import { sendOrderConfirmation, sendOversellAlert } from "@/lib/email";

export const runtime = "nodejs";

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

  // Defense-in-depth idempotency: if we've already fully processed this event,
  // ack and skip. (The order-status guards below are the primary mechanism; this
  // is recorded AFTER processing, so a crash mid-handler safely re-runs on
  // Stripe's redelivery rather than being lost.)
  const seen = await prisma.processedStripeEvent.findUnique({ where: { eventId: event.id } });
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
        if (order) {
          const paidData = {
            status: "paid",
            email: session.customer_details?.email || order.email,
            shippingName: session.customer_details?.name || null,
            shippingAddress: session.customer_details?.address
              ? JSON.stringify(session.customer_details.address)
              : null,
            totalCents: session.amount_total ?? order.totalCents,
          };

          // Normal path: the order is still "pending" (stock was reserved at
          // checkout), so a single atomic update finalizes it. This guarded
          // update is also the idempotency guard — Stripe's duplicate/retried
          // deliveries find count 0 and fall through to the already-handled case.
          const fromPending = await prisma.order.updateMany({
            where: { id: orderId, status: "pending" },
            data: paidData,
          });

          // Oversold items captured during a revival; alerts fire AFTER commit.
          const oversoldItems: { productTitle: string }[] = [];

          if (fromPending.count === 0) {
            // Revival path: a late-but-valid payment landed after the abandon-
            // sweeper already cancelled + restocked the order. Claim cancelled ->
            // paid AND re-reserve the units in ONE transaction, so the order is
            // never marked paid without its stock durably re-reserved (crash-safe:
            // if this rolls back, the order stays cancelled and a Stripe retry
            // re-runs it cleanly). If a unit is gone (sold elsewhere in the gap),
            // record the oversell rather than silently over-counting.
            const result = await prisma.$transaction(async (tx) => {
              const claim = await tx.order.updateMany({
                where: { id: orderId, status: "cancelled" },
                data: paidData,
              });
              if (claim.count === 0) return { revived: false, oversold: [] as { productTitle: string }[] };
              const oversold: { productTitle: string }[] = [];
              for (const item of order.items) {
                const ok = await tryReserve(item.variantId, item.quantity, {
                  reason: "site_sale", channel: "site", referenceId: orderId,
                  note: "Re-reserved: payment confirmed after abandon-sweep",
                }, tx);
                if (!ok) {
                  await forceDecrement(item.variantId, item.quantity, {
                    reason: "site_sale", channel: "site", referenceId: orderId,
                    note: "Oversell: paid after hold expired but stock already gone",
                  }, tx);
                  oversold.push({ productTitle: item.productTitle });
                }
              }
              if (oversold.length) {
                await tx.order.update({ where: { id: orderId }, data: { oversellFlag: true } });
              }
              return { revived: true, oversold };
            });
            if (!result.revived) break; // already paid/handled by another delivery
            oversoldItems.push(...result.oversold);
          }

          // The order is now durably "paid" (and re-reserved if it was revived).
          // Fire side-effects only AFTER the DB work has committed.
          for (const item of oversoldItems) {
            await sendOversellAlert({
              orderId,
              detail: `Order ${orderId} was paid after its checkout hold expired, but "${item.productTitle}" was no longer in stock — likely sold elsewhere in the meantime.`,
            }).catch((e) => console.error("oversell alert failed", e));
          }
          // Confirm Etsy is in sync with our authoritative count.
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

  // Record the event as processed (fast-path + audit). After side effects, so a
  // crash before this point safely re-runs on redelivery. Swallow a unique-key
  // clash from a concurrent duplicate delivery — the handlers are idempotent.
  await prisma.processedStripeEvent
    .create({ data: { eventId: event.id, type: event.type } })
    .catch(() => {});

  return NextResponse.json({ received: true });
}
