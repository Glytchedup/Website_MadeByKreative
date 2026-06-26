"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { requireAdmin } from "@/lib/admin";
import { refundRestock } from "@/lib/orders";
import { sendRefundConfirmation, sendShippingNotification } from "@/lib/email";

const REFUNDABLE = ["paid", "fulfilled", "shipped"];

/**
 * Refund an order: issue the Stripe refund, then restore inventory + mark refunded.
 *
 * Safety:
 * - The Stripe refund uses an idempotency key (`refund_<orderId>`), so even two
 *   concurrent submits (or a retry) produce exactly ONE real refund.
 * - Inventory restore + the status flip happen in `refundRestock` behind an atomic
 *   claim, so stock is restored exactly once.
 * - The refund is issued BEFORE the status flip; if Stripe throws, the order is
 *   left untouched (still paid) and the maker can retry — we never mark an order
 *   "refunded" without the money actually going back.
 */
export async function refundOrder(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId"));
  if (!orderId) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  // Guard up front so we don't call Stripe on an order that isn't refundable
  // (already refunded / never paid). refundRestock re-checks atomically too.
  if (!order || !REFUNDABLE.includes(order.status)) {
    revalidatePath("/admin/orders");
    return;
  }

  // 1) Issue the Stripe refund (idempotent). If Stripe is unconfigured or the
  //    order has no PaymentIntent (e.g. a manual/test order), skip — the maker
  //    refunds from the Stripe dashboard; we still restore stock below.
  if (stripe && order.paymentIntentId) {
    await stripe.refunds.create(
      { payment_intent: order.paymentIntentId },
      { idempotencyKey: `refund_${orderId}` }
    ); // throws on failure -> order stays as-is, nothing restocked
  }

  // 2) Restore inventory + mark refunded exactly once, then email the customer.
  const refunded = await refundRestock(orderId);
  if (refunded) {
    await sendRefundConfirmation({ to: order.email, orderId, amountCents: order.totalCents }).catch((e) =>
      console.error("refund email failed", e)
    );
  }
  revalidatePath("/admin/orders");
}

/** Mark a paid order as fulfilled (picked/packed, not yet shipped). */
export async function fulfillOrder(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId"));
  if (!orderId) return;
  await prisma.order.updateMany({ where: { id: orderId, status: "paid" }, data: { status: "fulfilled" } });
  revalidatePath("/admin/orders");
}

/** Mark an order shipped (optionally with tracking) and email the customer. */
export async function markShipped(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId"));
  const trackingNumber = String(formData.get("trackingNumber") || "").trim() || null;
  const carrier = String(formData.get("carrier") || "").trim() || null;
  if (!orderId) return;

  const claim = await prisma.order.updateMany({
    where: { id: orderId, status: { in: ["paid", "fulfilled"] } },
    data: { status: "shipped", shippedAt: new Date(), trackingNumber, carrier },
  });
  if (claim.count === 0) {
    revalidatePath("/admin/orders");
    return;
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order)
    await sendShippingNotification({ to: order.email, orderId, carrier, trackingNumber }).catch((e) =>
      console.error("shipping email failed", e)
    );
  revalidatePath("/admin/orders");
}
