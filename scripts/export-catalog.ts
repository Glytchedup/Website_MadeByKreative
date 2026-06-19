// One-off: dump all products + variants + ledger sales counts to JSON for an
// offline pricing/SEO audit. Read-only.
import { prisma } from "../src/lib/prisma";

async function main() {
  const products = await prisma.product.findMany({
    include: {
      variants: { orderBy: { priceCents: "asc" } },
      collection: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Sales velocity from the ledger (negative deltas = sold), split by channel.
  const sales = await prisma.ledgerEntry.groupBy({
    by: ["variantId", "reason"],
    _sum: { delta: true },
  });
  const soldByVariant: Record<string, { site: number; etsy: number }> = {};
  for (const s of sales) {
    if ((s._sum.delta ?? 0) >= 0) continue; // restocks/initial
    const u = -(s._sum.delta ?? 0);
    soldByVariant[s.variantId] = soldByVariant[s.variantId] ?? { site: 0, etsy: 0 };
    if (s.reason === "site_sale") soldByVariant[s.variantId].site += u;
    else if (s.reason === "etsy_sale") soldByVariant[s.variantId].etsy += u;
  }

  const out = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status,
    collection: p.collection?.name ?? null,
    collectionSeason: p.collection?.season ?? null,
    featured: p.featured,
    bestSeller: p.bestSeller,
    basePriceCents: p.basePriceCents,
    etsyListingId: p.etsyListingId,
    descriptionLength: p.description.length,
    description: p.description,
    tags: JSON.parse(p.tags || "[]"),
    tagCount: (JSON.parse(p.tags || "[]") as string[]).length,
    imageCount: (JSON.parse(p.images || "[]") as string[]).length,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    titleLength: p.title.length,
    variants: p.variants.map((v) => ({
      name: v.name,
      sku: v.sku,
      priceCents: v.priceCents,
      quantity: v.quantity,
      sold: soldByVariant[v.id] ?? { site: 0, etsy: 0 },
    })),
  }));

  console.log(JSON.stringify(out, null, 2));
}

main().finally(() => prisma.$disconnect());
