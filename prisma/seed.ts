// Seeds collections + ~17 sample products mirroring the live Etsy shop's range
// (titles/prices/collections are realistic placeholders flagged isSeed=true).
// Replace these with your real listings, or connect Etsy to import automatically.
//
// Run: npm run db:seed   (safe to re-run; it upserts collections and only seeds
// products if none exist yet).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const IMG = "/placeholder.svg";

const collections = [
  { slug: "halloween", name: "Halloween", season: "Halloween", description: "Spooky-cute handmade garlands & banners.", etsySectionId: null, sortOrder: 10 },
  { slug: "fall-autumn", name: "Fall / Autumn", season: "Fall", description: "Warm, cozy decor for the harvest season.", etsySectionId: null, sortOrder: 20 },
  { slug: "christmas-holiday", name: "Christmas / Holiday", season: "Christmas", description: "Festive bunting & garlands for the holidays.", etsySectionId: null, sortOrder: 30 },
  { slug: "valentines", name: "Valentine's", season: "Valentine", description: "Sweet handmade decor full of love.", etsySectionId: null, sortOrder: 40 },
  { slug: "st-patricks-day", name: "St. Patrick's Day", season: "StPatrick", description: "A little luck of the Irish, handmade.", etsySectionId: null, sortOrder: 50 },
  { slug: "easter", name: "Easter", season: "Easter", description: "Pastel garlands for spring celebrations.", etsySectionId: null, sortOrder: 60 },
  { slug: "spring", name: "Spring", season: "Spring", description: "Fresh, floral handmade decor.", etsySectionId: null, sortOrder: 70 },
  { slug: "patriotic", name: "Patriotic", season: "Patriotic", description: "4th of July & Memorial Day red-white-blue decor.", etsySectionId: null, sortOrder: 80 },
  { slug: "birthday", name: "Birthday", season: "Birthday", description: "Celebrate with handmade party banners.", etsySectionId: null, sortOrder: 90 },
];

// [title, collectionSlug, productType, priceDollars, featured, bestSeller]
// productType drives variants: "banner" => mini/medium/regular; else single.
type Seed = {
  title: string;
  collection: string;
  type: "garland" | "banner" | "bow" | "keychain";
  price: number;
  qty: number; // default-variant qty (banners spread across variants)
  featured?: boolean;
  bestSeller?: boolean;
  tags: string[];
};

const products: Seed[] = [
  { title: "Shabby Rag Garland — Halloween Orange & Black", collection: "halloween", type: "garland", price: 18, qty: 2, featured: true, bestSeller: true, tags: ["handmade", "rag garland", "halloween", "fabric", "shabby chic"] },
  { title: "Halloween Pennant Banner — Spooky Fabric Bunting", collection: "halloween", type: "banner", price: 16, qty: 5, tags: ["handmade", "banner", "bunting", "halloween", "pennant"] },
  { title: "Fall Rag Garland — Rustic Autumn Tones", collection: "fall-autumn", type: "garland", price: 18, qty: 3, featured: true, tags: ["handmade", "rag garland", "fall", "autumn", "farmhouse"] },
  { title: "Autumn Bunting Banner — Pumpkin & Plaid", collection: "fall-autumn", type: "banner", price: 16, qty: 4, bestSeller: true, tags: ["handmade", "bunting", "fall", "plaid", "banner"] },
  { title: "Christmas Rag Garland — Red, Green & Cream", collection: "christmas-holiday", type: "garland", price: 20, qty: 2, featured: true, bestSeller: true, tags: ["handmade", "rag garland", "christmas", "holiday", "mantel"] },
  { title: "Holiday Pennant Banner — Buffalo Plaid Bunting", collection: "christmas-holiday", type: "banner", price: 17, qty: 6, tags: ["handmade", "bunting", "christmas", "buffalo plaid", "banner"] },
  { title: "Christmas Shabby Bow Garland — Farmhouse", collection: "christmas-holiday", type: "bow", price: 19, qty: 1, tags: ["handmade", "bow garland", "christmas", "farmhouse", "shabby"] },
  { title: "Valentine's Rag Garland — Pink & Red Hearts", collection: "valentines", type: "garland", price: 16, qty: 3, featured: true, tags: ["handmade", "rag garland", "valentines", "hearts", "love"] },
  { title: "Valentine Fabric Wristlet Keychain — Heart Print", collection: "valentines", type: "keychain", price: 9, qty: 8, tags: ["handmade", "keychain", "wristlet", "valentines", "fabric"] },
  { title: "St. Patrick's Day Rag Garland — Green & Gold", collection: "st-patricks-day", type: "garland", price: 16, qty: 2, tags: ["handmade", "rag garland", "st patricks day", "green", "shamrock"] },
  { title: "Easter Bunting Banner — Pastel Pennant", collection: "easter", type: "banner", price: 15, qty: 4, tags: ["handmade", "bunting", "easter", "pastel", "banner"] },
  { title: "Easter Shabby Bow Garland — Spring Pastels", collection: "easter", type: "bow", price: 17, qty: 2, bestSeller: true, tags: ["handmade", "bow garland", "easter", "pastel", "spring"] },
  { title: "Spring Floral Rag Garland — Fresh Brights", collection: "spring", type: "garland", price: 17, qty: 3, featured: true, tags: ["handmade", "rag garland", "spring", "floral", "decor"] },
  { title: "Patriotic Rag Garland — Red White & Blue", collection: "patriotic", type: "garland", price: 18, qty: 4, bestSeller: true, tags: ["handmade", "rag garland", "patriotic", "4th of july", "memorial day"] },
  { title: "Patriotic Pennant Banner — Stars & Stripes Bunting", collection: "patriotic", type: "banner", price: 16, qty: 5, tags: ["handmade", "bunting", "patriotic", "4th of july", "banner"] },
  { title: "Birthday Pennant Banner — Bright Fabric Bunting", collection: "birthday", type: "banner", price: 15, qty: 6, tags: ["handmade", "bunting", "birthday", "party", "banner"] },
  { title: "Fabric Wristlet Keychain — Assorted Prints", collection: "birthday", type: "keychain", price: 8, qty: 10, featured: true, tags: ["handmade", "keychain", "wristlet", "fabric", "gift"] },
];

function variantsFor(s: Seed) {
  if (s.type === "banner") {
    // Mini / Medium / Regular sizing, priced relative to base.
    const base = Math.round(s.price * 100);
    const spread = Math.max(1, Math.floor(s.qty / 3));
    return [
      { name: "Mini", priceCents: base - 400, quantity: spread },
      { name: "Medium", priceCents: base, quantity: spread },
      { name: "Regular", priceCents: base + 400, quantity: s.qty - 2 * spread },
    ];
  }
  return [{ name: "Default", priceCents: Math.round(s.price * 100), quantity: s.qty }];
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

async function main() {
  console.log("Seeding collections…");
  const collectionIds: Record<string, string> = {};
  for (const c of collections) {
    const row = await prisma.collection.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder },
    });
    collectionIds[c.slug] = row.id;
  }

  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log(`Products already exist (${existing}); skipping product seed.`);
    return;
  }

  console.log(`Seeding ${products.length} sample products…`);
  for (const s of products) {
    const variants = variantsFor(s);
    const minPrice = Math.min(...variants.map((v) => v.priceCents));
    const product = await prisma.product.create({
      data: {
        slug: `${slugify(s.title)}`,
        title: s.title,
        description:
          `${s.title}. Lovingly handmade by Kristol in Gilbert, Arizona. ` +
          `Made from quality fabrics, perfect for decorating your home for the season. ` +
          `Each piece is made by hand, so slight variations make yours one of a kind.\n\n` +
          `★ 5-star rated · Star Seller · Fast shipping`,
        basePriceCents: minPrice,
        collectionId: collectionIds[s.collection],
        images: JSON.stringify([IMG, IMG]),
        tags: JSON.stringify(s.tags),
        featured: Boolean(s.featured),
        bestSeller: Boolean(s.bestSeller),
        turnaround: "Ships in 1–3 business days",
        status: "active",
        isSeed: true,
        seoTitle: `${s.title} | Handmade by MadeByKreative`,
        seoDescription: `${s.title} — handmade fabric decor by MadeByKreative. Star Seller, 5.0★, fast shipping.`,
        variants: { create: variants },
      },
      include: { variants: true },
    });

    // Write initial ledger entries so the audit invariant (sum == qty) holds.
    for (const v of product.variants) {
      if (v.quantity > 0) {
        await prisma.ledgerEntry.create({
          data: { variantId: v.id, delta: v.quantity, reason: "initial", channel: "system", note: "Seed data" },
        });
      }
    }
  }
  console.log("✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
