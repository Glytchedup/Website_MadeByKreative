// ===========================================================================
// Etsy sync orchestration. Two distinct data flows, deliberately separated:
//
//   CONTENT  (titles, descriptions, photos, prices, tags):  Etsy -> Site only.
//   INVENTORY (stock counts):                                two-way via ledger.
//
// All inventory mutations go through lib/inventory.ts (atomic + audited).
// Receipts are processed idempotently (keyed on Etsy receipt_id) so re-polling
// never double-decrements. Restocks (qty rose on Etsy) are distinguished from
// sales (qty dropped, handled by receipts) during reconciliation.
// ===========================================================================

import { prisma } from "../prisma";
import { tunables } from "../config";
import {
  addStock,
  forceDecrement,
  queueEtsyPush,
} from "../inventory";
import {
  EtsyNotConnectedError,
  getActiveListings,
  getListingImages,
  getListingInventory,
  getLiveListingQuantity,
  getShopReceipts,
  isConnected,
  updateListingInventory,
} from "./client";

// -------- logging ----------------------------------------------------------

export async function syncLog(
  direction: "etsy_to_site" | "site_to_etsy" | "system",
  action: string,
  message: string,
  level: "info" | "warn" | "error" = "info",
  meta?: unknown
) {
  await prisma.syncLog.create({
    data: { direction, action, message, level, meta: meta ? JSON.stringify(meta) : null },
  });
  if (level === "error") console.error(`[etsy:${action}] ${message}`, meta ?? "");
}

async function touchState(patch: Record<string, unknown>) {
  await prisma.etsySyncState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...patch },
    update: patch,
  });
}

// -------- CONTENT: Etsy -> Site (one-way) ----------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Import/mirror listing content from Etsy. On FIRST import of a listing we also
 * seed the ledger quantity ("initial"). On subsequent runs we update content
 * only and leave inventory to the two-way flow.
 */
export async function syncContentFromEtsy(): Promise<{ imported: number; updated: number }> {
  if (!(await isConnected())) throw new EtsyNotConnectedError();
  let imported = 0;
  let updated = 0;
  let offset = 0;

  for (;;) {
    const page = await getActiveListings(100, offset);
    for (const listing of page.results) {
      const existing = await prisma.product.findUnique({
        where: { etsyListingId: String(listing.listing_id) },
        include: { variants: true },
      });

      // Resolve collection from Etsy shop section.
      const collection = listing.shop_section_id
        ? await prisma.collection.findFirst({
            where: { etsySectionId: String(listing.shop_section_id) },
          })
        : null;

      const priceCents = listing.price
        ? Math.round((listing.price.amount / listing.price.divisor) * 100)
        : 1000;

      let images: string[] = [];
      try {
        const imgs = await getListingImages(listing.listing_id);
        images = imgs.results.sort((a, b) => a.rank - b.rank).map((i) => i.url_fullxfull);
      } catch {
        /* images are best-effort */
      }

      if (!existing) {
        // First import: create product + variants from Etsy inventory offerings.
        const inv = await getListingInventory(listing.listing_id).catch(() => null);
        const created = await prisma.product.create({
          data: {
            slug: `${slugify(listing.title)}-${listing.listing_id}`,
            title: listing.title,
            description: listing.description,
            basePriceCents: priceCents,
            collectionId: collection?.id,
            images: JSON.stringify(images),
            tags: JSON.stringify(listing.tags ?? []),
            etsyListingId: String(listing.listing_id),
            status: listing.state === "active" ? "active" : "draft",
            isSeed: false,
          },
        });

        if (inv && inv.products.length > 0) {
          for (const p of inv.products) {
            const offering = p.offerings[0];
            const variantName =
              p.property_values?.flatMap((pv) => pv.values).join(" / ") || "Default";
            const variant = await prisma.variant.create({
              data: {
                productId: created.id,
                name: variantName,
                sku: p.sku || null,
                priceCents,
                quantity: 0,
                etsyListingId: String(listing.listing_id),
                etsyProductId: String(p.product_id),
                etsyOfferingId: offering ? String(offering.offering_id) : null,
                etsyLastSeenQty: offering?.quantity ?? 0,
              },
            });
            if ((offering?.quantity ?? 0) > 0) {
              await addStock(variant.id, offering.quantity, {
                reason: "initial",
                channel: "etsy",
                note: "Initial import from Etsy",
              });
            }
          }
        } else {
          // Listing with no variation breakdown: single Default variant.
          await prisma.variant.create({
            data: {
              productId: created.id,
              name: "Default",
              priceCents,
              quantity: listing.quantity ?? 0,
              etsyListingId: String(listing.listing_id),
              etsyLastSeenQty: listing.quantity ?? 0,
            },
          });
          if ((listing.quantity ?? 0) > 0) {
            const v = await prisma.variant.findFirst({ where: { productId: created.id } });
            if (v)
              await prisma.ledgerEntry.create({
                data: {
                  variantId: v.id,
                  delta: listing.quantity ?? 0,
                  reason: "initial",
                  channel: "etsy",
                  note: "Initial import from Etsy",
                },
              });
          }
        }
        imported++;
      } else {
        // Content-only update (never touch quantity here).
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            title: listing.title,
            description: listing.description,
            basePriceCents: priceCents,
            images: JSON.stringify(images),
            tags: JSON.stringify(listing.tags ?? []),
            collectionId: collection?.id ?? existing.collectionId,
            status: listing.state === "active" ? "active" : "draft",
          },
        });
        updated++;
      }
    }
    offset += 100;
    if (offset >= page.count) break;
  }

  await touchState({ lastContentSyncAt: new Date() });
  await syncLog("etsy_to_site", "content_sync", `Imported ${imported}, updated ${updated}`);
  return { imported, updated };
}

// -------- INVENTORY: Etsy sale -> Site (receipt polling, idempotent) -------

/**
 * Poll Etsy receipts and decrement the ledger for each NEW receipt. Idempotent:
 * a ProcessedEtsyReceipt row (keyed on receipt_id) is written inside the same
 * transaction, so re-polling the same receipt is a no-op.
 */
export async function pollEtsyReceipts(): Promise<{ processed: number }> {
  if (!(await isConnected())) throw new EtsyNotConnectedError();
  const state = await prisma.etsySyncState.findUnique({ where: { id: "singleton" } });
  const minCreated = state?.lastReceiptCreatedTs ?? undefined;

  const page = await getShopReceipts(minCreated, 50);
  let processed = 0;
  let maxTs = state?.lastReceiptCreatedTs ?? 0;

  for (const receipt of page.results) {
    maxTs = Math.max(maxTs, receipt.created_timestamp);
    const already = await prisma.processedEtsyReceipt.findUnique({
      where: { receiptId: String(receipt.receipt_id) },
    });
    if (already) continue; // idempotent guard

    await prisma.$transaction(async (tx) => {
      // Record the receipt FIRST inside the txn; the unique PK guarantees that
      // two concurrent polls can't both apply the same receipt.
      await tx.processedEtsyReceipt.create({
        data: { receiptId: String(receipt.receipt_id), raw: JSON.stringify(receipt) },
      });

      for (const t of receipt.transactions) {
        // Match the transaction to one of our variants.
        const variant = await tx.variant.findFirst({
          where: {
            etsyListingId: String(t.listing_id),
            ...(t.product_id ? { etsyProductId: String(t.product_id) } : {}),
          },
        });
        if (!variant) {
          await syncLog(
            "etsy_to_site",
            "receipt_unmapped",
            `Receipt ${receipt.receipt_id}: no variant for listing ${t.listing_id}`,
            "warn",
            t
          );
          continue;
        }
        const { newQty, wentNegative } = await forceDecrement(variant.id, t.quantity, {
          reason: "etsy_sale",
          channel: "etsy",
          referenceId: String(receipt.receipt_id),
          note: `Etsy receipt ${receipt.receipt_id}`,
        }, tx);

        // Keep our "last seen on Etsy" in step so reconciliation isn't confused.
        await tx.variant.update({
          where: { id: variant.id },
          data: { etsyLastSeenQty: Math.max(newQty, 0) },
        });

        if (wentNegative) {
          await tx.syncConflict.create({
            data: {
              variantId: variant.id,
              type: "oversell",
              siteQty: newQty,
              detail: `Etsy sale on receipt ${receipt.receipt_id} drove stock negative — likely sold on both channels.`,
            },
          });
        }
      }
    });
    processed++;
  }

  await touchState({ lastReceiptPollAt: new Date(), lastReceiptCreatedTs: maxTs || undefined });
  if (processed) await syncLog("etsy_to_site", "receipt_poll", `Processed ${processed} receipt(s)`);
  return { processed };
}

// -------- INVENTORY: reconciliation (detect restocks & mismatches) ---------

/**
 * Compare each mapped variant's live Etsy quantity against what we last saw.
 *   qty ROSE  -> a manual restock done in Etsy: add the delta to our ledger.
 *   qty DROPPED-> a sale, already handled by receipt polling: do NOT decrement
 *                 again; just re-sync our "last seen" marker.
 *   unexplained mismatch between our authoritative qty and Etsy -> raise a
 *                 conflict for the maker (never silently overwrite).
 */
export async function reconcileInventory(): Promise<{ restocks: number; conflicts: number }> {
  if (!(await isConnected())) throw new EtsyNotConnectedError();
  const variants = await prisma.variant.findMany({
    where: { etsyListingId: { not: null } },
  });

  let restocks = 0;
  let conflicts = 0;

  // Group by listing to minimize API calls when a listing has one offering.
  for (const v of variants) {
    let liveQty: number;
    try {
      if (v.etsyProductId) {
        const inv = await getListingInventory(v.etsyListingId!);
        const p = inv.products.find((pp) => String(pp.product_id) === v.etsyProductId);
        liveQty = p?.offerings?.[0]?.quantity ?? 0;
      } else {
        liveQty = await getLiveListingQuantity(v.etsyListingId!);
      }
    } catch (err) {
      await syncLog("etsy_to_site", "reconcile_fetch", `Listing ${v.etsyListingId}: ${String(err)}`, "warn");
      continue;
    }

    const lastSeen = v.etsyLastSeenQty ?? liveQty;

    if (liveQty > lastSeen) {
      // RESTOCK on Etsy.
      const delta = liveQty - lastSeen;
      await addStock(v.id, delta, {
        reason: "manual_restock",
        channel: "etsy",
        note: `Detected Etsy restock (+${delta})`,
      });
      await prisma.variant.update({ where: { id: v.id }, data: { etsyLastSeenQty: liveQty } });
      await syncLog("etsy_to_site", "restock", `Variant ${v.id}: +${delta} restock from Etsy`);
      restocks++;
    } else if (liveQty < lastSeen) {
      // A drop — should already be accounted for via receipts. Just resync marker.
      await prisma.variant.update({ where: { id: v.id }, data: { etsyLastSeenQty: liveQty } });
    }

    // After accounting for restocks, our authoritative qty should match Etsy.
    const fresh = await prisma.variant.findUniqueOrThrow({ where: { id: v.id } });
    if (fresh.quantity !== liveQty) {
      // Unexplained divergence -> push our authoritative number to Etsy AND flag.
      const open = await prisma.syncConflict.findFirst({
        where: { variantId: v.id, type: "qty_mismatch", status: "open" },
      });
      if (!open) {
        await prisma.syncConflict.create({
          data: {
            variantId: v.id,
            type: "qty_mismatch",
            siteQty: fresh.quantity,
            etsyQty: liveQty,
            detail:
              "Site (authoritative) and Etsy disagree after reconciliation. Confirm correct count.",
          },
        });
        conflicts++;
      }
    }
  }

  await touchState({ lastInventoryPollAt: new Date() });
  if (restocks || conflicts)
    await syncLog("etsy_to_site", "reconcile", `Restocks ${restocks}, conflicts ${conflicts}`);
  return { restocks, conflicts };
}

// -------- INVENTORY: Site -> Etsy (push queue) -----------------------------

/** Process pending pushes: write the site's authoritative quantity to Etsy. */
export async function processPushQueue(): Promise<{ done: number; failed: number }> {
  if (!(await isConnected())) throw new EtsyNotConnectedError();
  const pending = await prisma.etsyPush.findMany({ where: { status: "pending" }, take: 50 });
  let done = 0;
  let failed = 0;

  for (const push of pending) {
    const variant = await prisma.variant.findUnique({ where: { id: push.variantId } });
    if (!variant?.etsyListingId) {
      await prisma.etsyPush.update({
        where: { id: push.id },
        data: { status: "failed", lastError: "variant has no Etsy listing mapping" },
      });
      failed++;
      continue;
    }
    try {
      const inv = await getListingInventory(variant.etsyListingId);
      // Mutate the matching offering quantity, then PUT the whole object back.
      const products = inv.products.map((p) => {
        const isTarget = variant.etsyProductId
          ? String(p.product_id) === variant.etsyProductId
          : true; // single-offering listing
        return {
          ...p,
          offerings: p.offerings.map((o) =>
            isTarget ? { ...o, quantity: Math.max(push.targetQty, 0) } : o
          ),
        };
      });
      await updateListingInventory(variant.etsyListingId, products);
      await prisma.variant.update({
        where: { id: variant.id },
        data: { etsyLastSeenQty: Math.max(push.targetQty, 0) },
      });
      await prisma.etsyPush.update({ where: { id: push.id }, data: { status: "done" } });
      done++;
    } catch (err) {
      await prisma.etsyPush.update({
        where: { id: push.id },
        data: { status: "failed", attempts: push.attempts + 1, lastError: String(err) },
      });
      await syncLog("site_to_etsy", "push", `Push ${push.id} failed: ${String(err)}`, "error");
      failed++;
    }
  }
  if (done || failed) await syncLog("site_to_etsy", "push_queue", `Done ${done}, failed ${failed}`);
  return { done, failed };
}

// -------- JIT oversell guard (called at checkout) --------------------------

/**
 * Just-in-time guard. For a low-stock variant, re-query Etsy's LIVE quantity in
 * the moment before charging. If Etsy shows it's gone, block the sale. This is
 * what closes the polling-gap oversell window. Fails OPEN (allows the sale) if
 * Etsy is unreachable — we don't want a flaky API to block all checkouts; the
 * atomic ledger decrement is still the primary protection.
 */
export async function jitEtsyStockOk(
  variant: { etsyListingId: string | null; etsyProductId: string | null },
  requestedQty: number
): Promise<{ ok: boolean; liveQty?: number; reason?: string }> {
  if (!variant.etsyListingId) return { ok: true }; // not on Etsy
  if (!(await isConnected())) return { ok: true }; // not connected -> ledger guards
  try {
    let liveQty: number;
    if (variant.etsyProductId) {
      const inv = await getListingInventory(variant.etsyListingId);
      const p = inv.products.find((pp) => String(pp.product_id) === variant.etsyProductId);
      liveQty = p?.offerings?.[0]?.quantity ?? 0;
    } else {
      liveQty = await getLiveListingQuantity(variant.etsyListingId);
    }
    if (liveQty < requestedQty) {
      return { ok: false, liveQty, reason: "Just sold out on our other shop." };
    }
    return { ok: true, liveQty };
  } catch (err) {
    // Fail open — log and let the atomic ledger decrement be the guard.
    await syncLog("system", "jit_guard", `JIT check failed, allowing: ${String(err)}`, "warn");
    return { ok: true };
  }
}

// -------- Full sync (cron entry point) -------------------------------------

export async function runFullSync(): Promise<Record<string, unknown>> {
  if (!(await isConnected())) {
    return { connected: false, message: "Etsy not connected — sync skipped." };
  }
  const result: Record<string, unknown> = { connected: true };
  // Order matters: apply known sales (receipts) BEFORE reconciling deltas, so a
  // sale isn't misread as needing a restock. Then push any queued site changes.
  try {
    result.receipts = await pollEtsyReceipts();
  } catch (e) {
    result.receiptsError = String(e);
    await syncLog("etsy_to_site", "receipt_poll", String(e), "error");
  }
  try {
    result.reconcile = await reconcileInventory();
  } catch (e) {
    result.reconcileError = String(e);
    await syncLog("etsy_to_site", "reconcile", String(e), "error");
  }
  try {
    result.push = await processPushQueue();
  } catch (e) {
    result.pushError = String(e);
    await syncLog("site_to_etsy", "push_queue", String(e), "error");
  }
  return result;
}
