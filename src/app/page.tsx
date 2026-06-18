import Link from "next/link";
import Image from "next/image";
import { getBestSellers, getCollections, getFeaturedProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic"; // reflect live stock

export default async function HomePage() {
  const [featured, bestSellers, collections] = await Promise.all([
    getFeaturedProducts(8),
    getBestSellers(4),
    getCollections(),
  ]);

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

      {/* Hero */}
      <section className="bg-linen">
        <div className="container-page grid items-center gap-8 py-16 md:grid-cols-2">
          <div>
            <p className="mb-2 inline-block rounded-full bg-terracotta/15 px-3 py-1 text-sm font-semibold text-terracotta">
              ★ Star Seller · 1,280+ handmade sales · 5.0 rating
            </p>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              Handmade fabric garlands & banners, stitched with love
            </h1>
            <p className="mt-4 max-w-prose text-lg text-muted">
              Shabby rag garlands, holiday bunting, and fabric keychains — each piece made by hand
              by {siteConfig.maker} in {siteConfig.location}. The same craft our Etsy customers have
              loved for 5 years, now direct from the maker.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-primary">Shop the collection</Link>
              <Link href="/about" className="btn-secondary">Our story</Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-soft bg-cream shadow-card">
            {featured[0]?.images[0] ? (
              <Image src={featured[0].images[0]} alt={featured[0].title} fill className="object-cover" priority sizes="(max-width:768px) 100vw, 50vw" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">Featured product photo</div>
            )}
          </div>
        </div>
      </section>

      {/* Collections */}
      {collections.length > 0 && (
        <section className="container-page py-14">
          <h2 className="mb-6 text-2xl font-bold">Shop by season & holiday</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {collections.map((c) => (
              <Link key={c.id} href={`/collections/${c.slug}`} className="card flex items-center justify-center p-6 text-center font-semibold hover:bg-linen">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <section className="container-page py-6">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-2xl font-bold">Fresh from the studio</h2>
            <Link href="/shop" className="text-sm font-semibold text-terracotta hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Best sellers / social proof */}
      {bestSellers.length > 0 && (
        <section className="container-page py-14">
          <h2 className="mb-6 text-2xl font-bold">Customer favorites</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {bestSellers.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Trust band */}
      <section className="bg-linen">
        <div className="container-page grid gap-6 py-12 text-center sm:grid-cols-3">
          <div><p className="text-2xl">✋</p><h3 className="mt-1 font-semibold">Truly handmade</h3><p className="text-sm text-muted">Each piece made & packed by Kristol.</p></div>
          <div><p className="text-2xl">📦</p><h3 className="mt-1 font-semibold">Fast shipping</h3><p className="text-sm text-muted">Most orders ship in 1–3 business days.</p></div>
          <div><p className="text-2xl">⭐</p><h3 className="mt-1 font-semibold">5.0 ★ across 227 reviews</h3><p className="text-sm text-muted">Trusted by 1,280+ happy customers.</p></div>
        </div>
      </section>
    </>
  );
}
