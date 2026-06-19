import { getCatalog } from "@/lib/catalog";
import { Storefront } from "@/components/storefront/Storefront";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic"; // reflect live stock & catalog

export default async function HomePage() {
  const catalog = await getCatalog();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Store",
          name: siteConfig.name,
          description: siteConfig.description,
          url: siteConfig.url,
          sameAs: [siteConfig.etsyShopUrl],
          address: { "@type": "PostalAddress", addressLocality: "Gilbert", addressRegion: "AZ", addressCountry: "US" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "5.0", reviewCount: "227" },
        }}
      />
      <Storefront catalog={catalog} />
    </>
  );
}
