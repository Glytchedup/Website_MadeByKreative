import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";
import { updateProductContent } from "../../actions";

export const dynamic = "force-dynamic";

// Parse a JSON-string image array defensively (SQLite/Postgres store it as text).
function safeImages(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, collections] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: { include: { ledger: { orderBy: { createdAt: "desc" }, take: 10 } } } },
    }),
    prisma.collection.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!product) notFound();

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-muted hover:text-terracotta">← Back to products</Link>
      <h1 className="mt-2 text-2xl font-bold">{product.title}</h1>

      <form action={updateProductContent} className="card mt-4 grid gap-3 p-6 sm:grid-cols-2">
        <input type="hidden" name="id" value={product.id} />
        <label className="text-sm sm:col-span-2">Title<input name="title" required defaultValue={product.title} className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5" /></label>
        <label className="text-sm sm:col-span-2">Description<textarea name="description" defaultValue={product.description} rows={5} className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5" /></label>
        {!product.etsyListingId && (
          <label className="text-sm sm:col-span-2">Image URLs (one per line)
            <textarea
              name="images"
              defaultValue={safeImages(product.images).join("\n")}
              rows={3}
              className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5"
            />
          </label>
        )}
        <label className="text-sm">Status
          <select name="status" defaultValue={product.status} className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5">
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="text-sm">Collection
          <select name="collectionId" defaultValue={product.collectionId ?? ""} className="mt-1 w-full rounded border border-charcoal/20 px-2 py-1.5">
            <option value="">— none —</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={product.featured} /> Featured on home</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bestSeller" defaultChecked={product.bestSeller} /> Best seller</label>
        <div className="sm:col-span-2"><button type="submit" className="btn-primary">Save changes</button></div>
      </form>

      {product.etsyListingId && (
        <p className="mt-3 text-sm text-muted">
          🔗 Linked to Etsy listing {product.etsyListingId}. Content (title, photos, description) is
          mirrored from Etsy on each sync, edit those there. Inventory is two-way.
        </p>
      )}

      <h2 className="mt-8 text-lg font-bold">Inventory ledger (recent activity)</h2>
      <p className="text-sm text-muted">Every stock movement is recorded here for a full audit trail.</p>
      {product.variants.map((v) => (
        <div key={v.id} className="card mt-3 p-4">
          <p className="font-semibold">{v.name}, {v.quantity} in stock · {formatPrice(v.priceCents)}</p>
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1">When</th><th>Change</th><th>Reason</th><th>Channel</th><th>Note</th></tr></thead>
            <tbody>
              {v.ledger.map((e) => (
                <tr key={e.id} className="border-t border-charcoal/5">
                  <td className="py-1">{e.createdAt.toLocaleString()}</td>
                  <td className={e.delta < 0 ? "text-terracotta" : "text-sage"}>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
                  <td>{e.reason}</td>
                  <td>{e.channel}</td>
                  <td className="text-muted">{e.note}</td>
                </tr>
              ))}
              {v.ledger.length === 0 && <tr><td colSpan={5} className="py-2 text-muted">No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
