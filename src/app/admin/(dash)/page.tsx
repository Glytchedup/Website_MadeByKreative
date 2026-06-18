import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { flags, tunables } from "@/lib/config";
import { isConnected } from "@/lib/etsy/client";

export const dynamic = "force-dynamic";

function Stat({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: string }) {
  const inner = (
    <div className={`card p-5 ${tone || ""}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function AdminDashboard() {
  const threshold = tunables.lowStockThreshold();
  const [productCount, lowStock, openConflicts, paidOrders, pendingPushes, oversells, connected] =
    await Promise.all([
      prisma.product.count({ where: { status: "active" } }),
      prisma.variant.count({ where: { quantity: { gt: 0, lte: threshold } } }),
      prisma.syncConflict.count({ where: { status: "open" } }),
      prisma.order.count({ where: { status: "paid" } }),
      prisma.etsyPush.count({ where: { status: "pending" } }),
      prisma.order.count({ where: { oversellFlag: true } }),
      isConnected(),
    ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Welcome back, Kristol 💛</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Active products" value={productCount} href="/admin/products" />
        <Stat label="Low-stock items" value={lowStock} href="/admin/products" tone={lowStock ? "ring-2 ring-terracotta/40" : ""} />
        <Stat label="Paid orders" value={paidOrders} href="/admin/orders" />
        <Stat label="Open sync conflicts" value={openConflicts} href="/admin/sync" tone={openConflicts ? "ring-2 ring-terracotta/40" : ""} />
        <Stat label="Pending Etsy pushes" value={pendingPushes} href="/admin/sync" />
        <Stat label="⚠️ Oversell flags" value={oversells} href="/admin/sync" tone={oversells ? "ring-2 ring-red-400" : ""} />
      </div>

      <div className="mt-8 card p-5">
        <h2 className="font-bold">Etsy connection</h2>
        {!flags.etsyConfigured ? (
          <p className="mt-2 text-sm text-muted">
            Etsy API keys not set. The store runs fully standalone. Add <code>ETSY_KEYSTRING</code> and{" "}
            <code>ETSY_SHARED_SECRET</code> to <code>.env</code> to enable two-way sync.
          </p>
        ) : connected ? (
          <p className="mt-2 text-sm text-sage">✓ Connected to Etsy. Inventory syncs automatically.</p>
        ) : (
          <p className="mt-2 text-sm text-terracotta">
            Keys configured but not authorized yet.{" "}
            <Link href="/admin/sync" className="underline">Connect your Etsy shop →</Link>
          </p>
        )}
      </div>
    </div>
  );
}
