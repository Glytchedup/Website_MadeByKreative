// Pull REAL per-offering prices from Etsy (the sync flattened them to the
// listing base price). Read-only. Prints each size's true Etsy price vs. what
// we stored, so we can see the undercharge.
//
//   npx tsx --env-file=.env scripts/etsy-real-prices.ts
import { prisma } from "../src/lib/prisma";
import { getListingInventory } from "../src/lib/etsy/client";

async function main() {
  const products = await prisma.product.findMany({
    where: { etsyListingId: { not: null } },
    include: { variants: true },
    orderBy: { title: "asc" },
  });

  for (const p of products) {
    let inv: any;
    try {
      inv = await getListingInventory(p.etsyListingId!);
    } catch (e) {
      console.log(`\n## ${p.title}\n  (inventory fetch failed: ${String(e)})`);
      continue;
    }
    console.log(`\n## ${p.title}  [listing ${p.etsyListingId}]`);
    for (const prod of inv.products ?? []) {
      const size =
        (prod.property_values ?? []).flatMap((pv: any) => pv.values).join(" / ") || "Default";
      for (const off of prod.offerings ?? []) {
        const realCents = off.price
          ? Math.round((off.price.amount / off.price.divisor) * 100)
          : null;
        // what we currently have stored for the matching variant
        const v = p.variants.find(
          (vv) => vv.etsyProductId === String(prod.product_id)
        );
        const storedCents = v?.priceCents ?? null;
        const flag =
          realCents != null && storedCents != null && realCents !== storedCents ? "  <-- MISMATCH" : "";
        console.log(
          `  ${size.padEnd(18)} real $${realCents != null ? (realCents / 100).toFixed(2) : "?"}` +
            `   stored $${storedCents != null ? (storedCents / 100).toFixed(2) : "?"}` +
            `   qty ${off.quantity}${flag}`
        );
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
