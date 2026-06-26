// Mocked-client integration test for the Etsy inventory-sync loop. Injects a fake
// Etsy client (no network) via the test seam in src/lib/etsy/sync.ts and exercises
// receipt baseline, sale decrement, idempotency, unmapped-rollback, and reconcile.
//
// Usage: npm run sync:test   (runs against the dev DB; cleans up after itself)

import { PrismaClient } from "@prisma/client";
import {
  pollEtsyReceipts,
  reconcileInventory,
  __setEtsyClientForTests,
} from "../src/lib/etsy/sync";
import { addStock, verifyLedgerInvariant } from "../src/lib/inventory";

const prisma = new PrismaClient();
let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✓ PASS" : "✗ FAIL"} — ${name}`);
  if (!cond) failures++;
}

type Receipt = {
  receipt_id: number;
  created_timestamp: number;
  transactions: { transaction_id: number; listing_id: number; product_id?: number; quantity: number }[];
};

async function setCursor(ts: number | null) {
  await prisma.etsySyncState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastReceiptCreatedTs: ts },
    update: { lastReceiptCreatedTs: ts },
  });
}

async function main() {
  const stamp = Date.now();
  const listingId = 900000000 + (stamp % 1000000); // unique-ish numeric listing
  const productId = listingId + 1;
  const otherListing = listingId + 999; // never mapped

  // Snapshot sync state to restore at the end (dev DB may be shared).
  const origState = await prisma.etsySyncState.findUnique({ where: { id: "singleton" } });

  // Seed a product + variant mapped to our fake Etsy listing, with 3 in stock.
  const product = await prisma.product.create({
    data: {
      slug: `sync-test-${stamp}`,
      title: "Sync Test Product",
      description: "",
      basePriceCents: 1000,
      images: "[]",
      tags: "[]",
      etsyListingId: String(listingId),
      status: "active",
      variants: {
        create: [
          {
            name: "Default",
            priceCents: 1000,
            quantity: 0,
            etsyListingId: String(listingId),
            etsyProductId: String(productId),
            etsyLastSeenQty: 0,
          },
        ],
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0]!;
  await addStock(variant.id, 3, { reason: "initial", channel: "system", note: "sync-test seed" });
  await prisma.variant.update({ where: { id: variant.id }, data: { etsyLastSeenQty: 3 } });

  // Mutable mock state.
  let receipts: Receipt[] = [];
  let liveQty = 3;
  const PAGE = 100;

  __setEtsyClientForTests({
    isConnected: async () => true,
    getShopReceipts: async (minCreated?: number, limit = PAGE, offset = 0) => {
      const filtered = receipts
        .filter((r) => (minCreated ? r.created_timestamp >= minCreated : true))
        .sort((a, b) => a.created_timestamp - b.created_timestamp);
      return { count: filtered.length, results: filtered.slice(offset, offset + limit) } as any;
    },
    getListingInventory: async () =>
      ({ products: [{ product_id: productId, sku: "", offerings: [{ offering_id: 1, quantity: liveQty, is_enabled: true }], property_values: [] }] }) as any,
    getLiveListingQuantity: async () => liveQty,
    updateListingInventory: async () => ({}) as any,
  });

  const q = async () => (await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).quantity;

  // 1) BASELINE (firstRun): historical receipts are marked processed, NOT decremented.
  await setCursor(null);
  receipts = [{ receipt_id: stamp + 1, created_timestamp: 1000, transactions: [{ transaction_id: 1, listing_id: listingId, product_id: productId, quantity: 1 }] }];
  const baseline = await pollEtsyReceipts();
  check("baseline run does not decrement historical receipts", baseline.baseline === true && (await q()) === 3);

  // 2) NEW Etsy sale → decrement by exactly the sold quantity.
  receipts = [{ receipt_id: stamp + 2, created_timestamp: 2000, transactions: [{ transaction_id: 2, listing_id: listingId, product_id: productId, quantity: 1 }] }];
  const sale = await pollEtsyReceipts();
  check("a new Etsy receipt decrements stock by the sold qty", sale.processed === 1 && (await q()) === 2);

  // 3) IDEMPOTENCY: re-polling the same receipt is a no-op.
  const replay = await pollEtsyReceipts();
  check("re-polling the same receipt does not double-decrement", replay.processed === 0 && (await q()) === 2);

  // 4) UNMAPPED receipt: rolls back, stays unprocessed, cursor not advanced past it.
  receipts = [{ receipt_id: stamp + 3, created_timestamp: 3000, transactions: [{ transaction_id: 3, listing_id: otherListing, quantity: 1 }] }];
  const unmapped = await pollEtsyReceipts();
  const unmappedRow = await prisma.processedEtsyReceipt.findUnique({ where: { receiptId: String(stamp + 3) } });
  check("an unmapped receipt is left unprocessed (not recorded)", (unmapped.unmapped ?? 0) === 1 && unmappedRow === null);

  // 5) RECONCILE restock: Etsy live qty rose above last-seen → add the delta.
  liveQty = 5; // someone restocked on Etsy
  const beforeReconcile = await q(); // 2
  const rec = await reconcileInventory();
  check("reconcile detects an Etsy restock and adds the delta", rec.restocks === 1 && (await q()) === beforeReconcile + (5 - 2));

  // 6) Ledger invariant holds throughout.
  check("ledger invariant holds after the full sync loop", await verifyLedgerInvariant(variant.id));

  // Cleanup: created rows + processed-receipt markers, and restore sync state.
  await prisma.processedEtsyReceipt.deleteMany({ where: { receiptId: { in: [String(stamp + 1), String(stamp + 2)] } } });
  await prisma.product.delete({ where: { id: product.id } }); // cascades variant + ledger
  if (origState) {
    await prisma.etsySyncState.update({
      where: { id: "singleton" },
      data: { lastReceiptCreatedTs: origState.lastReceiptCreatedTs },
    });
  } else {
    await prisma.etsySyncState.delete({ where: { id: "singleton" } }).catch(() => {});
  }

  console.log(`\n${failures === 0 ? "✅ ALL SYNC CHECKS PASSED" : `❌ ${failures} SYNC CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
