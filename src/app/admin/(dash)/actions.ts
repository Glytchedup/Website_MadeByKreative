"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { addStock, queueEtsyPush, setStock, StockChangedError } from "@/lib/inventory";
import { liveEtsyQuantitySafe, runFullSync } from "@/lib/etsy/sync";

// ----- Inventory --------------------------------------------------------------

export async function restockVariant(formData: FormData) {
  await requireAdmin();
  const variantId = String(formData.get("variantId"));
  const qty = Number(formData.get("qty"));
  if (!variantId || !Number.isFinite(qty) || qty <= 0) return;
  const newQty = await addStock(variantId, qty, {
    reason: "manual_restock",
    channel: "admin",
    note: "Restocked in admin",
  });
  // Push the new authoritative count to Etsy.
  await queueEtsyPush(variantId, newQty);
  revalidatePath("/admin/products");
}

export async function correctVariantStock(formData: FormData) {
  await requireAdmin();
  const variantId = String(formData.get("variantId"));
  const absolute = Number(formData.get("absolute"));
  if (!variantId || !Number.isFinite(absolute) || absolute < 0) return;
  await setStock(variantId, absolute, {
    reason: "manual_correction",
    channel: "admin",
    note: "Corrected count in admin",
  });
  await queueEtsyPush(variantId, absolute);
  revalidatePath("/admin/products");
}

// ----- Product CRUD -----------------------------------------------------------

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const priceCents = Math.round(Number(formData.get("price") || 0) * 100);
  const quantity = Number(formData.get("quantity") || 0);
  const collectionId = String(formData.get("collectionId") || "") || null;
  const description = String(formData.get("description") || "");
  const imagesRaw = String(formData.get("images") || "");
  const images = imagesRaw.split(/\n|,/).map((s) => s.trim()).filter(Boolean);

  const product = await prisma.product.create({
    data: {
      slug: `${slugify(title)}-${Date.now().toString(36)}`,
      title,
      description,
      basePriceCents: priceCents,
      collectionId,
      images: JSON.stringify(images),
      status: "active",
      variants: { create: [{ name: "Default", priceCents, quantity: 0 }] },
    },
    include: { variants: true },
  });
  if (quantity > 0) {
    await addStock(product.variants[0].id, quantity, {
      reason: "initial",
      channel: "admin",
      note: "Initial stock at product creation",
    });
  }
  revalidatePath("/admin/products");
}

export async function updateProductContent(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "");
  const status = String(formData.get("status") || "active");
  const collectionId = String(formData.get("collectionId") || "") || null;
  const featured = formData.get("featured") === "on";
  const bestSeller = formData.get("bestSeller") === "on";
  await prisma.product.update({
    where: { id },
    data: { title, description, status, collectionId, featured, bestSeller },
  });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
}

// ----- Settings ---------------------------------------------------------------

export async function saveSetting(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key"));
  const value = String(formData.get("value") ?? "");
  if (!key) return;
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  revalidatePath("/admin/settings");
  revalidatePath("/policies");
}

// ----- Sync -------------------------------------------------------------------

export async function triggerSync() {
  await requireAdmin();
  // Manual "Sync now" forces a content import (pull listings) in addition to the
  // inventory sync, so the first connect and any on-demand run mirror Etsy fully.
  await runFullSync({ forceContent: true });
  revalidatePath("/admin/sync");
  revalidatePath("/shop");
  revalidatePath("/");
}

export async function resolveConflict(formData: FormData) {
  await requireAdmin();
  const conflictId = String(formData.get("conflictId"));
  const resolution = String(formData.get("resolution")); // "use_site" | "use_etsy" | "ignore"

  // For "accept Etsy's count", re-query Etsy LIVE before applying. The stored
  // conflict.etsyQty is a snapshot from when the conflict was raised and may be
  // stale (e.g. the item has since sold on the site or on Etsy); writing that
  // absolute number could resurrect an already-sold one-of-a-few item. We do the
  // network fetch OUTSIDE the transaction below, and capture the site quantity we
  // based the decision on so the write can be guarded against a sale that slips
  // in before it commits. Falls back to the stored snapshot only if Etsy is
  // unreachable.
  let targetEtsyQty: number | null = null;
  let expectedSiteQty: number | null = null;
  if (resolution === "use_etsy") {
    const conflict = await prisma.syncConflict.findUnique({ where: { id: conflictId } });
    if (conflict) {
      const variant = await prisma.variant.findUnique({ where: { id: conflict.variantId } });
      if (variant) {
        expectedSiteQty = variant.quantity;
        const live = await liveEtsyQuantitySafe(variant);
        targetEtsyQty = live ?? conflict.etsyQty;
      }
    }
  }

  // Claim the conflict AND apply its stock change in ONE transaction. The claim
  // (updateMany where status="open") prevents a double-submit from applying the
  // resolution twice; keeping it in the same transaction as setStock means that
  // if setStock throws (e.g. write contention, or the strict-CAS guard below),
  // the status claim rolls back too — so the conflict stays "open" and can be
  // safely retried (no "marked resolved but stock never changed" state).
  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.syncConflict.updateMany({
        where: { id: conflictId, status: "open" },
        data: { status: resolution === "ignore" ? "ignored" : "resolved", resolvedAt: new Date() },
      });
      if (claim.count === 0) return; // already resolved/ignored — nothing to do

      const conflict = await tx.syncConflict.findUnique({ where: { id: conflictId } });
      if (!conflict) return;

      if (resolution === "use_etsy" && targetEtsyQty != null && expectedSiteQty != null) {
        // Accept Etsy's (freshly re-queried) number as truth, but ONLY if the site
        // quantity is still what we based that decision on. If a sale slipped in
        // between the live fetch and now, setStock throws StockChangedError, the
        // whole transaction rolls back, and the conflict stays open for a re-decide
        // against fresh numbers — so a just-sold unit can't be resurrected.
        await setStock(conflict.variantId, Math.max(targetEtsyQty, 0), {
          reason: "reconciliation",
          channel: "admin",
          note: `Resolved conflict ${conflictId}: accepted live Etsy count`,
          expectedCurrent: expectedSiteQty,
        }, tx);
      } else if (resolution === "use_site" && conflict.siteQty != null) {
        // Keep the site count and push it to Etsy.
        await queueEtsyPush(conflict.variantId, Math.max(conflict.siteQty, 0), tx);
      }
    });
  } catch (err) {
    if (!(err instanceof StockChangedError)) throw err;
    // Stock changed under us — leave the conflict open so the maker re-decides
    // with current numbers (the transaction already rolled back the claim).
  }
  revalidatePath("/admin/sync");
}
