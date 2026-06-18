// ===========================================================================
// Inventory ledger — the single source of truth.
//
// Variant.quantity is authoritative. EVERY mutation goes through this module so
// that the change is atomic and an append-only LedgerEntry audit row is written.
// Feature code must never write Variant.quantity directly.
//
// The cornerstone is `tryReserve`: an ATOMIC GUARDED DECREMENT implemented with
// `updateMany({ where: { id, quantity: { gte: n } } })`. Prisma compiles this to
//   UPDATE Variant SET quantity = quantity - n WHERE id = ? AND quantity >= ?
// which is atomic at the row level — there is no read-then-write race. If the
// returned count is 0, stock was insufficient and nothing changed.
// ===========================================================================

import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

export type LedgerReason =
  | "site_sale"
  | "etsy_sale"
  | "manual_restock"
  | "manual_correction"
  | "import"
  | "reconciliation"
  | "initial";

export type LedgerChannel = "site" | "etsy" | "admin" | "system";

// A Prisma client OR an interactive transaction client.
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Atomically decrement stock for a variant by `qty`, IF at least `qty` is
 * available. Returns true on success (stock reserved + ledger written), false
 * if there was not enough stock (no change made).
 *
 * Pass an existing transaction client `db` to run this inside a larger
 * transaction (e.g. order creation). The guarded decrement + ledger write are
 * always performed together.
 */
export async function tryReserve(
  variantId: string,
  qty: number,
  opts: { reason: LedgerReason; channel: LedgerChannel; referenceId?: string; note?: string },
  db: Db = prisma
): Promise<boolean> {
  if (qty <= 0) throw new Error("tryReserve: qty must be positive");

  const result = await db.variant.updateMany({
    where: { id: variantId, quantity: { gte: qty } },
    data: { quantity: { decrement: qty } },
  });

  if (result.count === 0) return false; // insufficient stock — nothing changed

  await db.ledgerEntry.create({
    data: {
      variantId,
      delta: -qty,
      reason: opts.reason,
      channel: opts.channel,
      referenceId: opts.referenceId,
      note: opts.note,
    },
  });
  return true;
}

/**
 * Decrement stock allowing the count to go negative (used when we DISCOVER a
 * sale after the fact — e.g. an Etsy receipt — and must record reality even if
 * our projection was already at zero). Negative stock surfaces as an oversell
 * conflict for the maker. Always writes a ledger row.
 */
export async function forceDecrement(
  variantId: string,
  qty: number,
  opts: { reason: LedgerReason; channel: LedgerChannel; referenceId?: string; note?: string },
  db: Db = prisma
): Promise<{ newQty: number; wentNegative: boolean }> {
  const updated = await db.variant.update({
    where: { id: variantId },
    data: { quantity: { decrement: qty } },
  });
  await db.ledgerEntry.create({
    data: {
      variantId,
      delta: -qty,
      reason: opts.reason,
      channel: opts.channel,
      referenceId: opts.referenceId,
      note: opts.note,
    },
  });
  return { newQty: updated.quantity, wentNegative: updated.quantity < 0 };
}

/** Increase stock (restock or positive correction). Always writes a ledger row. */
export async function addStock(
  variantId: string,
  qty: number,
  opts: { reason: LedgerReason; channel: LedgerChannel; referenceId?: string; note?: string },
  db: Db = prisma
): Promise<number> {
  if (qty <= 0) throw new Error("addStock: qty must be positive");
  const updated = await db.variant.update({
    where: { id: variantId },
    data: { quantity: { increment: qty } },
  });
  await db.ledgerEntry.create({
    data: {
      variantId,
      delta: qty,
      reason: opts.reason,
      channel: opts.channel,
      referenceId: opts.referenceId,
      note: opts.note,
    },
  });
  return updated.quantity;
}

/**
 * Set stock to an absolute value (admin "correct the count" action). Computes
 * the delta vs current and records it. Use sparingly — prefer add/reserve.
 */
export async function setStock(
  variantId: string,
  absoluteQty: number,
  opts: { reason: LedgerReason; channel: LedgerChannel; note?: string },
  db: Db = prisma
): Promise<number> {
  if (absoluteQty < 0) throw new Error("setStock: quantity cannot be negative");
  const current = await db.variant.findUniqueOrThrow({ where: { id: variantId } });
  const delta = absoluteQty - current.quantity;
  if (delta === 0) return current.quantity;
  await db.variant.update({ where: { id: variantId }, data: { quantity: absoluteQty } });
  await db.ledgerEntry.create({
    data: { variantId, delta, reason: opts.reason, channel: opts.channel, note: opts.note },
  });
  return absoluteQty;
}

/** Queue a quantity push to Etsy (deduped: replaces any pending push). */
export async function queueEtsyPush(variantId: string, targetQty: number, db: Db = prisma) {
  // Cancel superseded pending pushes for this variant, then enqueue the latest.
  await db.etsyPush.updateMany({
    where: { variantId, status: "pending" },
    data: { status: "failed", lastError: "superseded by newer push" },
  });
  await db.etsyPush.create({ data: { variantId, targetQty, status: "pending" } });
}

export function isLowStock(quantity: number, threshold: number): boolean {
  return quantity > 0 && quantity <= threshold;
}

/** Invariant check used by the smoke test: ledger sum == current quantity. */
export async function verifyLedgerInvariant(variantId: string): Promise<boolean> {
  const variant = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } });
  const agg = await prisma.ledgerEntry.aggregate({
    where: { variantId },
    _sum: { delta: true },
  });
  return (agg._sum.delta ?? 0) === variant.quantity;
}
