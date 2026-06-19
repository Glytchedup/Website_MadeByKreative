// One-off: repair variant prices that the old sync flattened to the listing
// base price. Pulls each size's REAL price from Etsy and writes it to the
// matching variant; updates each product's basePriceCents to the lowest size.
// Prices only — never touches quantity/ledger.
//
//   npx tsx --env-file=.env scripts/fix-variant-prices.ts
import { prisma } from "../src/lib/prisma";
import { getListingInventory } from "../src/lib/etsy/client";

const cents = (p?: { amount: number; divisor: number } | null) =>
  p && p.divisor ? Math.round((p.amount / p.divisor) * 100) : null;

async function main() {
  const products = await prisma.product.findMany({
    where: { etsyListingId: { not: null } },
    include: { variants: true },
  });

  let fixedVariants = 0;
  let fixedProducts = 0;

  for (const p of products) {
    let inv: any;
    try {
      inv = await getListingInventory(p.etsyListingId!);
    } catch (e) {
      console.log(`! ${p.title}: inventory fetch failed (${String(e)})`);
      continue;
    }
    const offeringPrices: number[] = [];
    for (const ip of inv.products ?? []) {
      const c = cents(ip.offerings?.[0]?.price);
      if (c == null) continue;
      offeringPrices.push(c);
      const res = await prisma.variant.updateMany({
        where: { productId: p.id, etsyProductId: String(ip.product_id) },
        data: { priceCents: c },
      });
      // count only the ones that actually changed
      const v = p.variants.find((vv) => vv.etsyProductId === String(ip.product_id));
      if (v && v.priceCents !== c) fixedVariants += res.count;
    }
    if (offeringPrices.length) {
      const base = Math.min(...offeringPrices);
      if (base !== p.basePriceCents) {
        await prisma.product.update({ where: { id: p.id }, data: { basePriceCents: base } });
        fixedProducts++;
      }
    }
  }

  console.log(`Repaired ${fixedVariants} variant price(s) across ${fixedProducts} product base price(s).`);
}

main().finally(() => prisma.$disconnect());
