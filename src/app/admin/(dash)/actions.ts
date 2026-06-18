"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { addStock, queueEtsyPush, setStock } from "@/lib/inventory";
import { runFullSync } from "@/lib/etsy/sync";

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
  const conflict = await prisma.syncConflict.findUnique({ where: { id: conflictId } });
  if (!conflict) return;

  if (resolution === "use_etsy" && conflict.etsyQty != null) {
    // Accept Etsy's number as truth: correct the ledger to match.
    await setStock(conflict.variantId, conflict.etsyQty, {
      reason: "reconciliation",
      channel: "admin",
      note: `Resolved conflict ${conflictId}: accepted Etsy count`,
    });
  } else if (resolution === "use_site" && conflict.siteQty != null) {
    // Keep the site count and push it to Etsy.
    await queueEtsyPush(conflict.variantId, Math.max(conflict.siteQty, 0));
  }
  await prisma.syncConflict.update({
    where: { id: conflictId },
    data: { status: resolution === "ignore" ? "ignored" : "resolved", resolvedAt: new Date() },
  });
  revalidatePath("/admin/sync");
}
