import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { flags, siteConfig, tunables } from "@/lib/config";
import { isLowStock, queueEtsyPush, tryReserve } from "@/lib/inventory";
import { jitEtsyStockOk } from "@/lib/etsy/sync";

export const runtime = "nodejs";

const Body = z.object({
  items: z.array(z.object({ variantId: z.string(), quantity: z.number().int().positive() })).min(1),
});

// Thrown inside the reservation transaction to abort + report which item failed.
class StockError extends Error {
  constructor(public title: string) {
    super(`out_of_stock:${title}`);
  }
}

export async function POST(req: NextRequest) {
  if (!flags.stripeEnabled || !stripe) {
    return NextResponse.json(
      { error: "Checkout isn't configured yet (no Stripe keys). The store is in preview mode." },
      { status: 503 }
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { items } = parsed.data;

  // Load variants + product info.
  const variants = await prisma.variant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const threshold = tunables.lowStockThreshold();

  // 1) JIT oversell guard: for low-stock items, re-check Etsy's LIVE quantity in
  //    the moment before we reserve/charge. This closes the polling-gap window.
  for (const line of items) {
    const v = byId.get(line.variantId);
    if (!v) return NextResponse.json({ error: "An item is no longer available." }, { status: 409 });
    if (isLowStock(v.quantity, threshold) || v.quantity < line.quantity) {
      const jit = await jitEtsyStockOk(
        { etsyListingId: v.etsyListingId, etsyProductId: v.etsyProductId },
        line.quantity
      );
      if (!jit.ok) {
        return NextResponse.json(
          { error: `"${v.product.title}" just sold out. We've updated the listing — sorry!` },
          { status: 409 }
        );
      }
    }
  }

  // 2) Atomic guarded reservation + pending order, all in ONE transaction.
  let orderId: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          stripeSessionId: `pending_${crypto.randomUUID()}`,
          email: "pending@checkout",
          status: "pending",
          totalCents: items.reduce((s, i) => s + (byId.get(i.variantId)!.priceCents * i.quantity), 0),
        },
      });
      for (const line of items) {
        const v = byId.get(line.variantId)!;
        const ok = await tryReserve(
          v.id,
          line.quantity,
          { reason: "site_sale", channel: "site", referenceId: created.id, note: "Reserved at checkout" },
          tx
        );
        if (!ok) throw new StockError(v.product.title); // rolls back everything
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            variantId: v.id,
            productTitle: v.product.title,
            variantName: v.name,
            quantity: line.quantity,
            unitPriceCents: v.priceCents,
          },
        });
      }
      return created;
    });
    orderId = order.id;
  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json({ error: `"${err.title}" just sold out. Please adjust your cart.` }, { status: 409 });
    }
    throw err;
  }

  // 3) Stock is now reserved -> immediately push reduced availability to Etsy so
  //    the other channel can't oversell during the payment window.
  for (const line of items) {
    const v = await prisma.variant.findUnique({ where: { id: line.variantId } });
    if (v?.etsyListingId) await queueEtsyPush(v.id, v.quantity).catch(() => {});
  }

  // 4) Create the Stripe Checkout Session.
  const flatShipping = await prisma.setting.findUnique({ where: { key: "shipping_flat_cents" } });
  const shippingCents = flatShipping ? Number(flatShipping.value) : 550; // PLACEHOLDER default $5.50

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: items.map((line) => {
      const v = byId.get(line.variantId)!;
      return {
        quantity: line.quantity,
        price_data: {
          currency: "usd",
          unit_amount: v.priceCents,
          product_data: {
            name: `${v.product.title}${v.name !== "Default" ? ` — ${v.name}` : ""}`,
          },
        },
      };
    }),
    shipping_address_collection: { allowed_countries: ["US", "CA"] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: shippingCents, currency: "usd" },
          display_name: "Standard shipping",
        },
      },
    ],
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    metadata: { orderId },
    success_url: `${siteConfig.url}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteConfig.url}/checkout/cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 30, // 30 min hold
  });

  // Link the session to the order so the webhook can finalize it.
  await prisma.order.update({ where: { id: orderId }, data: { stripeSessionId: session.id } });

  return NextResponse.json({ url: session.url });
}
