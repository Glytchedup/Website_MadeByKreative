import Link from "next/link";
import { Metadata } from "next";
import { getActiveProducts, getCollections } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop All Handmade Goods",
  description: "Browse every handmade fabric garland, banner, bunting and keychain from MadeByKreative.",
};

type Sort = "newest" | "price-asc" | "price-desc";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string; sort?: Sort }>;
}) {
  const params = await searchParams;
  const [products, collections] = await Promise.all([
    getActiveProducts({ collectionSlug: params.collection }),
    getCollections(),
  ]);

  const sort = params.sort ?? "newest";
  const sorted = [...products].sort((a, b) => {
    if (sort === "price-asc") return a.minPrice - b.minPrice;
    if (sort === "price-desc") return b.minPrice - a.minPrice;
    return 0; // newest already from query order
  });

  const qs = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { collection: params.collection, sort, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && sp.set(k, v));
    return `/shop?${sp.toString()}`;
  };

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">Shop All</h1>
      <p className="mt-1 text-muted">{sorted.length} handmade {sorted.length === 1 ? "piece" : "pieces"}</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href={qs({ collection: undefined })} className={`rounded-full px-3 py-1 text-sm ${!params.collection ? "bg-terracotta text-cream" : "bg-white border border-charcoal/15"}`}>
          All
        </Link>
        {collections.map((c) => (
          <Link key={c.id} href={qs({ collection: c.slug })} className={`rounded-full px-3 py-1 text-sm ${params.collection === c.slug ? "bg-terracotta text-cream" : "bg-white border border-charcoal/15"}`}>
            {c.name}
          </Link>
        ))}
        <span className="ml-auto flex gap-2 text-sm">
          <Link href={qs({ sort: "newest" })} className={sort === "newest" ? "font-bold text-terracotta" : "text-muted hover:text-terracotta"}>Newest</Link>
          <Link href={qs({ sort: "price-asc" })} className={sort === "price-asc" ? "font-bold text-terracotta" : "text-muted hover:text-terracotta"}>Price ↑</Link>
          <Link href={qs({ sort: "price-desc" })} className={sort === "price-desc" ? "font-bold text-terracotta" : "text-muted hover:text-terracotta"}>Price ↓</Link>
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-12 text-center text-muted">No products yet. Run <code>npm run db:seed</code> to load sample data, or connect Etsy to import your listings.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {sorted.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
