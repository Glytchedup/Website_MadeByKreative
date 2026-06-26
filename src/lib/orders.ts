// ===========================================================================
// Order lifecycle helpers — releasing reserved stock for orders that never
// completed payment.
//
// Stock is reserved (and pushed to Etsy) at checkout, BEFORE payment, so an
// abandoned checkout would otherwise lock a one-of-a-few item out of stock on
// BOTH channels indefinitely. Two things release that reservation:
//   1) the Stripe `checkout.session.expired` / `async_payment_failed` webhook
//      (the fast path), and
//   2) `sweepAbandonedOrders` run from the cron (the backstop, in case that
//      webhook event isn't subscribed or fails to deliver).
// ===========================================================================

import { prisma } from "./prisma";
import { addStock, queueEtsyPush } from "./inventory";

// Matches the 30-minute Stripe Checkout session expiry set in /api/checkout.
const HOLD_MINUTES = 30;

/**
 * Restore reserved stock for an order that didn't complete (expired/failed/
 * abandoned) and cancel it. Returns true if THIS call performed the release.
 *
 * Race-safe: the order is claimed with an atomic guarded update
 * (`updateMany where status = "pending"`), so if the Stripe webhook and the cron
 * sweeper fire for the same order — or the same handler runs twice — exactly one
 * release happens and stock is restocked only once.
 */
export async function releaseOrder(orderId: string): Promise<boolean> {
  const released = await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: orderId, status: "pending" },
      data: { status: "cancelled" },
    });
    if (claim.count === 0) return false; // already paid, cancelled, or released elsewhere
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    for (const item of order.items) {
      await addStock(
        item.variantId,
        item.quantity,
        {
          reason: "manual_correction",
          channel: "system",
          referenceId: orderId,
          note: "Released abandoned checkout",
        },
        tx
      );
    }
    return true;
  });

  if (released) {
    // Push restored availability back to Etsy (outside the txn; best-effort).
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    for (const item of order?.items ?? []) {
      const v = await prisma.variant.findUnique({ where: { id: item.variantId } });
      if (v?.etsyListingId) await queueEtsyPush(v.id, v.quantity).catch(() => {});
    }
  }
  return released;
}

const REFUNDABLE = ["paid", "fulfilled", "shipped"];

/**
 * Mark a refundable order `refunded` and restore its inventory EXACTLY once
 * (idempotent: a second call returns false). The Stripe refund and the customer
 * email are the caller's job (the admin action); this is the inventory-safe core,
 * separated so it can be tested without Stripe or an auth context.
 */
export async function refundRestock(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || !REFUNDABLE.includes(order.status)) return false;

  const did = await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: orderId, status: { in: REFUNDABLE } },
      data: { status: "refunded" },
    });
    if (claim.count === 0) return false; // already refunded by a concurrent caller
    for (const item of order.items) {
      await addStock(
        item.variantId,
        item.quantity,
        { reason: "manual_correction", channel: "system", referenceId: orderId, note: "Refunded order — stock restored" },
        tx
      );
    }
    return true;
  });

  if (did) {
    for (const item of order.items) {
      const v = await prisma.variant.findUnique({ where: { id: item.variantId } });
      if (v?.etsyListingId) await queueEtsyPush(v.id, v.quantity).catch(() => {});
    }
  }
  return did;
}

/**
 * Backstop sweeper: release any `pending` order older than the hold window. Run
 * from the cron so a missed Stripe expiry webhook can't permanently lock stock.
 * The age threshold is past the 30-min checkout expiry (+buffer), so a session
 * that could still be paid is never cancelled out from under the customer.
 */
export async function sweepAbandonedOrders(
  maxAgeMinutes: number = HOLD_MINUTES + 10
): Promise<{ released: number }> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: { status: "pending", createdAt: { lt: cutoff } },
    select: { id: true },
  });
  let released = 0;
  for (const o of stale) {
    if (await releaseOrder(o.id)) released++;
  }
  return { released };
}
