// Smoke test for the critical inventory paths — runs against the local DB with
// NO external services. Verifies the atomic guarded decrement, the oversell
// guard, the ledger audit invariant, and restock. Exits non-zero on any failure.
//
// Usage: npm run smoke   (run `npm run db:seed` first)

import { PrismaClient } from "@prisma/client";
import {
  tryReserve,
  addStock,
  setStock,
  forceDecrement,
  verifyLedgerInvariant,
  StockChangedError,
} from "../src/lib/inventory";
import { releaseOrder } from "../src/lib/orders";

const prisma = new PrismaClient();
let failures = 0;

function check(name: string, cond: boolean) {
  console.log(`${cond ? "✓ PASS" : "✗ FAIL"} — ${name}`);
  if (!cond) failures++;
}

async function main() {
  const variant = await prisma.variant.findFirst({ where: { quantity: { gte: 2 } } });
  if (!variant) {
    console.error("No seeded variant with stock >= 2. Run `npm run db:seed` first.");
    process.exit(1);
  }
  const startQty = variant.quantity;
  console.log(`Testing with variant ${variant.id} (start qty ${startQty})\n`);

  // 1) Atomic reserve succeeds and decrements by exactly 1.
  const ok1 = await tryReserve(variant.id, 1, { reason: "site_sale", channel: "site", note: "smoke" });
  const afterReserve = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
  check("atomic reserve succeeds when stock available", ok1);
  check("quantity decremented by exactly 1", afterReserve.quantity === startQty - 1);

  // 2) Over-reserve beyond available stock fails and changes nothing.
  const tooMany = afterReserve.quantity + 100;
  const ok2 = await tryReserve(variant.id, tooMany, { reason: "site_sale", channel: "site", note: "smoke-over" });
  const afterOver = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
  check("over-reserve is rejected (oversell guard)", ok2 === false);
  check("rejected reserve leaves quantity unchanged", afterOver.quantity === afterReserve.quantity);

  // 3) Restock increments and writes a ledger row.
  await addStock(variant.id, 1, { reason: "manual_restock", channel: "admin", note: "smoke-restock" });
  const afterRestock = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
  check("restock returns quantity to start", afterRestock.quantity === startQty);

  // 4) Ledger audit invariant: sum of deltas == current quantity.
  const invariant = await verifyLedgerInvariant(variant.id);
  check("ledger invariant holds (sum of deltas == quantity)", invariant);

  // 5) Concurrency: fire N reserves in parallel for a 1-stock item; exactly one wins.
  const solo = await prisma.variant.create({
    data: {
      productId: variant.productId,
      name: `smoke-concurrency-${Date.now()}`,
      priceCents: 100,
      quantity: 1,
    },
  });
  await prisma.ledgerEntry.create({ data: { variantId: solo.id, delta: 1, reason: "initial", channel: "system" } });
  const results = await Promise.all(
    Array.from({ length: 5 }, () => tryReserve(solo.id, 1, { reason: "site_sale", channel: "site", note: "race" }))
  );
  const wins = results.filter(Boolean).length;
  const soloFinal = await prisma.variant.findUniqueOrThrow({ where: { id: solo.id } });
  check("exactly one of 5 concurrent reserves wins the single unit", wins === 1);
  check("concurrent test never oversells (qty == 0)", soloFinal.quantity === 0);
  await prisma.variant.delete({ where: { id: solo.id } });

  // 6) Atomic setStock under contention: an admin "set the count" racing customer
  //    reserves must NOT clobber a decrement (which would silently restore a sold
  //    unit). The ledger invariant must still hold and stock must not go negative.
  const raceVar = await prisma.variant.create({
    data: { productId: variant.productId, name: `smoke-setstock-${Date.now()}`, priceCents: 100, quantity: 0 },
  });
  await addStock(raceVar.id, 10, { reason: "initial", channel: "system", note: "setstock-race seed" });
  await Promise.all([
    ...Array.from({ length: 5 }, () =>
      tryReserve(raceVar.id, 1, { reason: "site_sale", channel: "site", note: "setstock-race" }).catch(() => false)
    ),
    setStock(raceVar.id, 10, { reason: "manual_correction", channel: "admin", note: "setstock-race" }).catch(() => 0),
  ]);
  const raceInvariant = await verifyLedgerInvariant(raceVar.id);
  const raceFinal = await prisma.variant.findUniqueOrThrow({ where: { id: raceVar.id } });
  check("setStock concurrent with reserves keeps ledger invariant (no clobber)", raceInvariant);
  check("setStock race never leaves negative stock", raceFinal.quantity >= 0);
  await prisma.variant.delete({ where: { id: raceVar.id } });

  // 7) forceDecrement records reality past zero (the Etsy-oversell case) and the
  //    ledger invariant still holds at a negative quantity.
  const negVar = await prisma.variant.create({
    data: { productId: variant.productId, name: `smoke-neg-${Date.now()}`, priceCents: 100, quantity: 0 },
  });
  await addStock(negVar.id, 1, { reason: "initial", channel: "system", note: "neg seed" });
  const dec = await forceDecrement(negVar.id, 3, {
    reason: "etsy_sale", channel: "etsy", referenceId: "smoke-neg", note: "force negative",
  });
  check("forceDecrement reports wentNegative + correct newQty past zero", dec.wentNegative === true && dec.newQty === -2);
  check("ledger invariant holds even at negative quantity", await verifyLedgerInvariant(negVar.id));
  await prisma.variant.delete({ where: { id: negVar.id } }); // cascades ledger rows

  // 8) Multi-item order: if ANY line is short, the WHOLE reservation rolls back —
  //    the in-stock line must not be decremented.
  const okVar = await prisma.variant.create({
    data: { productId: variant.productId, name: `smoke-multiok-${Date.now()}`, priceCents: 100, quantity: 0 },
  });
  await addStock(okVar.id, 5, { reason: "initial", channel: "system", note: "multi ok seed" });
  const shortVar = await prisma.variant.create({
    data: { productId: variant.productId, name: `smoke-multishort-${Date.now()}`, priceCents: 100, quantity: 0 },
  });
  await addStock(shortVar.id, 1, { reason: "initial", channel: "system", note: "multi short seed" });
  let rolledBack = false;
  try {
    await prisma.$transaction(async (tx) => {
      const a = await tryReserve(okVar.id, 2, { reason: "site_sale", channel: "site", note: "multi" }, tx);
      if (!a) throw new Error("unexpected: in-stock line failed to reserve");
      const b = await tryReserve(shortVar.id, 5, { reason: "site_sale", channel: "site", note: "multi" }, tx);
      if (!b) throw new Error("rollback"); // shortVar only has 1 — forces abort
    });
  } catch {
    rolledBack = true;
  }
  const okAfter = await prisma.variant.findUniqueOrThrow({ where: { id: okVar.id } });
  check("multi-item: a short line rolls back the whole order", rolledBack);
  check("multi-item: the in-stock line is NOT decremented after rollback", okAfter.quantity === 5);
  check(
    "multi-item: ledger invariant holds for both variants",
    (await verifyLedgerInvariant(okVar.id)) && (await verifyLedgerInvariant(shortVar.id))
  );
  await prisma.variant.delete({ where: { id: okVar.id } });
  await prisma.variant.delete({ where: { id: shortVar.id } });

  // 9) Concurrent releaseOrder: the atomic claim must restock EXACTLY once even if
  //    the Stripe expiry webhook and the cron abandon-sweeper fire for the same
  //    order simultaneously (the sweeper/webhook double-restock race).
  const relVar = await prisma.variant.create({
    data: { productId: variant.productId, name: `smoke-release-${Date.now()}`, priceCents: 100, quantity: 0 },
  });
  await addStock(relVar.id, 3, { reason: "initial", channel: "system", note: "release seed" });
  // Reserve 2 units into a pending order (mirrors what checkout does).
  const relOrder = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: { stripeSessionId: `smoke_${Date.now()}`, email: "smoke@release", status: "pending", totalCents: 200 },
    });
    await tryReserve(relVar.id, 2, { reason: "site_sale", channel: "site", referenceId: o.id, note: "smoke reserve" }, tx);
    await tx.orderItem.create({
      data: { orderId: o.id, variantId: relVar.id, productTitle: "smoke", variantName: "Default", quantity: 2, unitPriceCents: 100 },
    });
    return o;
  });
  const afterReserve2 = await prisma.variant.findUniqueOrThrow({ where: { id: relVar.id } });
  const relResults = await Promise.all([releaseOrder(relOrder.id), releaseOrder(relOrder.id)]);
  const relWins = relResults.filter(Boolean).length;
  const relFinal = await prisma.variant.findUniqueOrThrow({ where: { id: relVar.id } });
  const relOrderFinal = await prisma.order.findUniqueOrThrow({ where: { id: relOrder.id } });
  check("concurrent releaseOrder restocks exactly once (single winner)", relWins === 1);
  check("released order restores reserved stock exactly once", afterReserve2.quantity === 1 && relFinal.quantity === 3);
  check("released order ends up cancelled", relOrderFinal.status === "cancelled");
  check("released variant ledger invariant holds", await verifyLedgerInvariant(relVar.id));
  await prisma.order.delete({ where: { id: relOrder.id } }); // cascades order items
  await prisma.variant.delete({ where: { id: relVar.id } }); // cascades ledger rows

  // 10) Strict-CAS setStock (conflict "use Etsy qty"): if a sale slips in between
  //     observing the count and applying the absolute write, it must abort with
  //     StockChangedError and leave stock untouched — never resurrect a sold unit.
  const casVar = await prisma.variant.create({
    data: { productId: variant.productId, name: `smoke-cas-${Date.now()}`, priceCents: 100, quantity: 0 },
  });
  await addStock(casVar.id, 2, { reason: "initial", channel: "system", note: "cas seed" });
  // We "observed" qty=2, but a unit sells before we apply the resolution:
  await tryReserve(casVar.id, 1, { reason: "site_sale", channel: "site", note: "cas pre-sale" });
  let casThrew = false;
  try {
    await setStock(casVar.id, 2, {
      reason: "reconciliation", channel: "admin", note: "stale apply", expectedCurrent: 2,
    });
  } catch (e) {
    casThrew = e instanceof StockChangedError;
  }
  const casAfterStale = await prisma.variant.findUniqueOrThrow({ where: { id: casVar.id } });
  check("setStock strict-CAS throws when stock changed since observation", casThrew);
  check("setStock strict-CAS leaves stock untouched on a stale apply", casAfterStale.quantity === 1);
  // With the correct expected basis it applies cleanly:
  const casApplied = await setStock(casVar.id, 5, {
    reason: "reconciliation", channel: "admin", note: "fresh apply", expectedCurrent: 1,
  });
  check("setStock strict-CAS applies when the expected basis matches", casApplied === 5);
  check("setStock strict-CAS keeps ledger invariant", await verifyLedgerInvariant(casVar.id));
  await prisma.variant.delete({ where: { id: casVar.id } });

  console.log(`\n${failures === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
