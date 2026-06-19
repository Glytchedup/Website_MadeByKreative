import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  const orders = await prisma.order.findMany({
    where: { status: { in: ["paid", "fulfilled", "refunded"] } },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      <p className="mt-1 text-sm text-muted">Orders placed on your website (Etsy orders stay in Etsy).</p>

      {orders.length === 0 ? (
        <p className="mt-8 text-muted">No website orders yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((o) => (
            <div key={o.id} className={`card p-4 ${o.oversellFlag ? "ring-2 ring-red-400" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{o.shippingName || o.email}</p>
                  <p className="text-xs text-muted">{o.createdAt.toLocaleString()} · {o.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-terracotta">{formatPrice(o.totalCents)}</p>
                  <span className="rounded-full bg-sage/15 px-2 py-0.5 text-xs font-semibold text-sage">{o.status}</span>
                </div>
              </div>
              <ul className="mt-2 text-sm text-muted">
                {o.items.map((i) => (
                  <li key={i.id}>{i.quantity} × {i.productTitle} ({i.variantName})</li>
                ))}
              </ul>
              {o.oversellFlag && <p className="mt-2 text-sm font-semibold text-red-600">⚠️ Possible oversell, review & refund if needed.</p>}
              {o.shippingAddress && (
                <p className="mt-2 text-xs text-muted">Ship to: {o.shippingAddress}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
