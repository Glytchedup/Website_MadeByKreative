// Maps our DB (Prisma products/collections/variants — themselves synced from
// Etsy) into the "catalog feed" shape the storefront design consumes. This is
// the single source the homepage renders from; swap nothing else when the Etsy
// sync updates the DB and the whole storefront repopulates.

import { prisma } from "./prisma";
import { siteConfig } from "./config";

export interface CatalogVariant {
  id: string;
  label: string; // size / option name, e.g. "5 feet", "Mini"
  priceCents: number;
  quantity: number;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
  season: string; // collection name
  type: string; // "Pennant bunting" | "Shabby rag garland" | "Tied bow garland" | "Keychain" | "Banner"
  priceCents: number; // lowest variant price
  priceLabel: string; // "$18" / "$16.50"
  quantity: number; // total stock (for scarcity badge)
  images: string[];
  tags: string[]; // e.g. ["Bestseller"] / ["New"]
  sizes: string[]; // variant labels (length > 1 => show size selector)
  variants: CatalogVariant[];
  description: string;
  url: string; // Etsy listing URL (secondary CTA)
  latest: boolean;
}

export interface Catalog {
  shop: {
    rating: number;
    reviewCount: number;
    salesCount: string;
    shipDays: string;
    url: string;
  };
  seasonOrder: string[];
  products: CatalogProduct[];
}

// Compact money: "$18" when whole dollars, "$16.50" otherwise.
function money(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

// Infer the banner "form" from the title (we don't store it separately).
function classifyType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("keychain") || t.includes("wristlet") || t.includes("key fob")) return "Keychain";
  if (t.includes("bunting") || t.includes("pennant")) return "Pennant bunting";
  if (t.includes("bow garland") || t.includes("bow")) return "Tied bow garland";
  if (t.includes("rag garland") || t.includes("garland")) return "Shabby rag garland";
  return "Banner";
}

function parseList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function getCatalog(): Promise<Catalog> {
  const [collections, products] = await Promise.all([
    prisma.collection.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      where: { status: "active" },
      include: { variants: { orderBy: { priceCents: "asc" } }, collection: true },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  // Newest product (top of createdAt desc) is flagged "latest" for the hero.
  const latestId = products[0]?.id;

  const mapped: CatalogProduct[] = products.map((p) => {
    const variants = p.variants;
    const inStock = variants.filter((v) => v.quantity > 0);
    const minPrice = variants.length ? Math.min(...variants.map((v) => v.priceCents)) : p.basePriceCents;
    const totalStock = variants.reduce((s, v) => s + Math.max(v.quantity, 0), 0);
    const labels = variants.map((v) => v.name).filter((n) => n && n !== "Default");

    const tags: string[] = [];
    if (p.bestSeller) tags.push("Bestseller");
    else if (p.id === latestId || p.featured) tags.push("New");

    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      season: p.collection?.name ?? "Other",
      type: classifyType(p.title),
      priceCents: minPrice,
      priceLabel: money(minPrice),
      quantity: totalStock,
      images: parseList(p.images),
      tags,
      sizes: labels,
      variants: variants.map((v) => ({
        id: v.id,
        label: v.name,
        priceCents: v.priceCents,
        quantity: v.quantity,
      })),
      description: p.description,
      url: p.etsyListingId
        ? `https://www.etsy.com/listing/${p.etsyListingId}`
        : siteConfig.etsyShopUrl,
      latest: p.id === latestId,
    };
  });

  return {
    shop: {
      rating: 5.0,
      reviewCount: 227,
      salesCount: "1,280+",
      shipDays: "1–3 days",
      url: siteConfig.etsyShopUrl,
    },
    // Only seasons that actually have products, in collection sort order.
    seasonOrder: collections.map((c) => c.name).filter((name) => mapped.some((p) => p.season === name)),
    products: mapped,
  };
}
