// Confirm the real shipping setup on the Etsy shop: free shipping? what does
// postage actually cost? processing (turnaround) time? Read-only.
//   npx tsx --env-file=.env scripts/etsy-shipping-check.ts
import { prisma } from "../src/lib/prisma";
import { getShopShippingProfiles, getListingRaw } from "../src/lib/etsy/client";

async function main() {
  console.log("=== SHOP SHIPPING PROFILES ===");
  const profiles = await getShopShippingProfiles().catch((e) => ({ error: String(e) }));
  for (const p of (profiles as any).results ?? []) {
    console.log(`\nProfile: ${p.title}  (id ${p.shipping_profile_id})`);
    console.log(`  min processing: ${p.min_processing_time} ${p.processing_time_unit}, max: ${p.max_processing_time}`);
    console.log(`  origin: ${p.origin_country_iso} ${p.origin_postal_code ?? ""}`);
    for (const d of p.shipping_profile_destinations ?? []) {
      console.log(
        `  -> ${d.destination_country_iso ?? d.destination_region ?? "everywhere"}: ` +
          `primary $${d.primary_cost?.amount / (d.primary_cost?.divisor || 1)}, ` +
          `secondary $${d.secondary_cost?.amount / (d.secondary_cost?.divisor || 1)}`
      );
    }
  }

  // Per-listing free-shipping flag via includes=Shipping on a couple of listings.
  console.log("\n=== PER-LISTING SHIPPING (sample) ===");
  const sample = await prisma.product.findMany({
    where: { etsyListingId: { not: null } },
    select: { title: true, etsyListingId: true },
    take: 4,
  });
  for (const s of sample) {
    const raw = await getListingRaw(s.etsyListingId!, "Shipping").catch((e) => ({ error: String(e) }));
    const r: any = raw;
    console.log(
      `\n${s.title.slice(0, 50)}` +
        `\n  has_free_shipping: ${r.has_free_shipping}` +
        `  shipping_profile_id: ${r.shipping_profile_id}` +
        `  processing: ${r.processing_min}-${r.processing_max} days`
    );
    const dest = r.shipping_profile?.shipping_profile_destinations?.[0];
    if (dest) {
      console.log(
        `  primary ship cost: $${dest.primary_cost?.amount / (dest.primary_cost?.divisor || 1)}`
      );
    }
  }
}

main().finally(() => prisma.$disconnect());
