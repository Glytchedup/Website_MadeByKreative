import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";
import { tunables } from "@/lib/config";
import { createProduct, restockVariant, correctVariantStock } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const threshold = tunables.lowStockThreshold();
  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      include: { variants: true, collection: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.collection.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Products & inventory</h1>
      <p className="mt-1 text-sm text-muted">
        Inventory counts here are the single source of truth. Changes sync to Etsy automatically.
      </p>

      <div className="mt-6 space-y-4">
        {products.map((p) => (
          <div key={p.id} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Link href={`/admin/products/${p.id}`} className="font-semibold hover:text-terracotta">{p.title}</Link>
                <p className="text-xs text-muted">
                  {p.collection?.name || "No collection"} · {p.status}
                  {p.etsyListingId ? " · 🔗 Etsy" : ""}
                  {p.isSeed ? " · sample" : ""}
                </p>
              </div>
              <Link href={`/admin/products/${p.id}`} className="btn-secondary px-3 py-1.5 text-sm">Edit</Link>
            </div>

            <div className="mt-3 divide-y divide-charcoal/5 border-t border-charcoal/5">
              {p.variants.map((v) => {
                const low = v.quantity > 0 && v.quantity <= threshold;
                return (
                  <div key={v.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="w-28 text-sm font-medium">{v.name}</span>
                    <span className="text-sm text-muted">{formatPrice(v.priceCents)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.quantity <= 0 ? "bg-charcoal/10 text-muted" : low ? "bg-terracotta/15 text-terracotta" : "bg-sage/15 text-sage"}`}>
                      {v.quantity} in stock
                    </span>
                    <form action={restockVariant} className="flex items-center gap-1">
                      <input type="hidden" name="variantId" value={v.id} />
                      <input name="qty" type="number" min={1} defaultValue={1} className="w-16 rounded border border-charcoal/20 px-2 py-1 text-sm" aria-label="Restock quantity" />
                      <button className="btn-secondary px-2 py-1 text-xs" type="submit">+ Restock</button>
                    </form>
                    <form action={correctVariantStock} className="flex items-center gap-1">
                      <input type="hidden" name="variantId" value={v.id} />
                      <input name="absolute" type="number" min={0} placeholder="set to" className="w-20 rounded border border-charcoal/20 px-2 py-1 text-sm" aria-label="Set exact quantity" />
                      <button className="btn-secondary px-2 py-1 text-xs" type="submit">Set</button>
                    </form>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Create new product */}
      <div className="card mt-8 p-6">
        <h2 className="text-lg font-bold">Add a product</h2>
        <form action={createProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Title<input name="title" required className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5" /></label>
          <label className="text-sm">Price ($)<input name="price" type="number" step="0.01" min="0" required className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5" /></label>
          <label className="text-sm">Starting quantity<input name="quantity" type="number" min="0" defaultValue={1} className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5" /></label>
          <label className="text-sm">Collection
            <select name="collectionId" className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5">
              <option value="">— none —</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">Image URLs (one per line)<textarea name="images" rows={2} className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5" /></label>
          <label className="text-sm sm:col-span-2">Description<textarea name="description" rows={3} className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5" /></label>
          <div className="sm:col-span-2"><button type="submit" className="btn-primary">Add product</button></div>
        </form>
      </div>
    </div>
  );
}
