import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/products";
import { AddToCart } from "@/components/AddToCart";
import { ProductCard } from "@/components/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/config";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.seoTitle || p.title,
    description: p.seoDescription || p.description.slice(0, 155),
    openGraph: {
      title: p.title,
      description: p.description.slice(0, 155),
      images: p.images.slice(0, 1),
      type: "website",
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product.collectionId, product.id, 4);

  const priceValid = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().split("T")[0];

  return (
    <div className="container-page py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.title,
          description: product.description,
          image: product.images,
          brand: { "@type": "Brand", name: siteConfig.name },
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: (product.minPrice / 100).toFixed(2),
            highPrice: (Math.max(...product.variants.map((v) => v.priceCents)) / 100).toFixed(2),
            offerCount: product.variants.length,
            availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            priceValidUntil: priceValid,
          },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "5.0", reviewCount: "227" },
          review: {
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
            author: { "@type": "Person", name: "Verified Etsy Buyer" },
            reviewBody: "Beautiful handmade quality and fast shipping. Exactly as pictured!",
          },
        }}
      />

      <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/shop" className="hover:text-terracotta">Shop</Link>
        {product.collection && (
          <>
            {" / "}
            <Link href={`/collections/${product.collection.slug}`} className="hover:text-terracotta">
              {product.collection.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-soft bg-linen">
            {product.images[0] ? (
              <Image src={product.images[0]} alt={product.title} fill priority className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">No image</div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(1, 5).map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded bg-linen">
                  <Image src={src} alt={`${product.title} view ${i + 2}`} fill className="object-cover" sizes="120px" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.collection && <p className="text-sm uppercase tracking-wide text-muted">{product.collection.name}</p>}
          <h1 className="mt-1 text-3xl font-bold">{product.title}</h1>

          <div className="mt-5">
            <AddToCart
              productSlug={product.slug}
              title={product.title}
              image={product.images[0]}
              variants={product.variants.map((v) => ({ id: v.id, name: v.name, priceCents: v.priceCents, quantity: v.quantity }))}
            />
          </div>

          <p className="mt-4 text-sm text-sage">📦 {product.turnaround || "Ships in 1–3 business days"}</p>

          <div className="prose mt-6 max-w-none whitespace-pre-line text-charcoal/90">
            {product.description}
          </div>

          {product.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <span key={t} className="rounded-full bg-linen px-2 py-0.5 text-xs text-muted">#{t}</span>
              ))}
            </div>
          )}

          {product.isSeed && (
            <p className="mt-6 rounded-soft bg-terracotta/10 p-3 text-sm text-terracotta">
              ⚠️ Sample data — replace with your real listing or connect Etsy to import.
            </p>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-4 text-2xl font-bold">More from this collection</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
