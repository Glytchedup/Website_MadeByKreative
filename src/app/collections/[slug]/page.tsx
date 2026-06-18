import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveProducts, getCollectionBySlug } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) return { title: "Collection not found" };
  return {
    title: c.seoTitle || `${c.name} — Handmade Decor`,
    description: c.seoDescription || c.description || `Handmade ${c.name} fabric decor by MadeByKreative.`,
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();
  const products = await getActiveProducts({ collectionSlug: slug });

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">{collection.name}</h1>
      {collection.description && <p className="mt-2 max-w-prose text-muted">{collection.description}</p>}
      {products.length === 0 ? (
        <p className="mt-12 text-center text-muted">Nothing in this collection yet — check back soon!</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
