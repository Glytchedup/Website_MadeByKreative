import Link from "next/link";
import { Metadata } from "next";
import { getCollections } from "@/lib/products";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collections",
  description: "Shop handmade decor by season and holiday, Halloween, Fall, Christmas, Valentine's and more.",
};

export default async function CollectionsPage() {
  const collections = await getCollections();
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">Collections</h1>
      <p className="mt-1 text-muted">Handmade decor for every season & celebration.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => (
          <Link key={c.id} href={`/collections/${c.slug}`} className="card p-6 hover:bg-linen">
            <h2 className="text-xl font-bold text-terracotta">{c.name}</h2>
            {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
