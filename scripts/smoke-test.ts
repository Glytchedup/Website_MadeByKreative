// Smoke test for the critical inventory paths — runs against the local DB with
// NO external services. Verifies the atomic guarded decrement, the oversell
// guard, the ledger audit invariant, and restock. Exits non-zero on any failure.
//
// Usage: npm run smoke   (run `npm run db:seed` first)

import { PrismaClient } from "@prisma/client";
import { tryReserve, addStock, verifyLedgerInvariant } from "../src/lib/inventory";

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

  console.log(`\n${failures === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
