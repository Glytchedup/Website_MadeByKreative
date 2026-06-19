// Data-access helpers for the storefront. Parses the JSON-string columns
// (images, tags) into real arrays and computes display fields.

import type { Collection, Product, Variant } from "@prisma/client";
import { prisma } from "./prisma";
import { decodeEntities } from "./html";
import { cleanTitle } from "./display";

export type ProductView = Awaited<ReturnType<typeof getProductBySlug>>;

type RawProduct = Product & { variants: Variant[]; collection: Collection | null };

function parseList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function decorate(p: RawProduct) {
  const images = parseList(p.images);
  const tags = parseList(p.tags);
  const totalStock = p.variants.reduce((s, v) => s + Math.max(v.quantity, 0), 0);
  const minPrice = p.variants.length
    ? Math.min(...p.variants.map((v) => v.priceCents))
    : 0;
  // displayTitle is the clean, human-facing name; the raw `title` is kept for
  // Etsy/SEO. description is decoded for display (Etsy returns HTML entities).
  const displayTitle = cleanTitle(p.title);
  const description = decodeEntities(p.description);
  return { ...p, images, tags, totalStock, minPrice, inStock: totalStock > 0, displayTitle, description };
}

export async function getActiveProducts(opts?: { collectionSlug?: string }) {
  const products = await prisma.product.findMany({
    where: {
      status: "active",
      ...(opts?.collectionSlug ? { collection: { slug: opts.collectionSlug } } : {}),
    },
    include: { variants: true, collection: true },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });
  return products.map(decorate);
}

export async function getFeaturedProducts(limit = 6) {
  const products = await prisma.product.findMany({
    where: { status: "active", featured: true },
    include: { variants: true, collection: true },
    take: limit,
  });
  return products.map(decorate);
}

export async function getBestSellers(limit = 4) {
  const products = await prisma.product.findMany({
    where: { status: "active", bestSeller: true },
    include: { variants: true, collection: true },
    take: limit,
  });
  return products.map(decorate);
}

export async function getProductBySlug(slug: string) {
  const p = await prisma.product.findUnique({
    where: { slug },
    include: { variants: { orderBy: { priceCents: "asc" } }, collection: true },
  });
  if (!p) return null;
  return decorate(p);
}

export async function getCollections() {
  return prisma.collection.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getCollectionBySlug(slug: string) {
  return prisma.collection.findUnique({ where: { slug } });
}

export async function getRelatedProducts(collectionId: string | null, excludeId: string, limit = 4) {
  if (!collectionId) return [];
  const products = await prisma.product.findMany({
    where: { status: "active", collectionId, id: { not: excludeId } },
    include: { variants: true, collection: true },
    take: limit,
  });
  return products.map(decorate);
}
