import { prisma } from "@/lib/prisma";
import { flags, tunables } from "@/lib/config";
import { isConnected } from "@/lib/etsy/client";
import { triggerSync, resolveConflict } from "../actions";

export const dynamic = "force-dynamic";

function timeAgo(d: Date | null | undefined) {
  if (!d) return "never";
  return d.toLocaleString();
}

export default async function SyncDashboard({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const [state, conflicts, pushes, logs, variants, connected] = await Promise.all([
    prisma.etsySyncState.findUnique({ where: { id: "singleton" } }),
    prisma.syncConflict.findMany({ where: { status: "open" }, include: { variant: { include: { product: true } } } }),
    prisma.etsyPush.findMany({ where: { status: "pending" }, include: { variant: { include: { product: true } } } }),
    prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.variant.findMany({ where: { etsyListingId: { not: null } }, include: { product: true }, take: 200 }),
    isConnected(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Etsy sync</h1>

      {sp.connected && <p className="mt-3 rounded bg-sage/15 p-3 text-sm text-sage">✓ Etsy connected successfully!</p>}
      {sp.error && <p className="mt-3 rounded bg-terracotta/15 p-3 text-sm text-terracotta">Connection error: {sp.error}</p>}

      {/* Connection + controls */}
      <div className="card mt-4 p-5">
        {!flags.etsyConfigured ? (
          <p className="text-sm text-muted">
            Etsy API keys not configured. The store works fully standalone. Add your Etsy app keys to
            <code> .env</code> to enable two-way inventory sync (see README).
          </p>
        ) : connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-sage">✓ Connected to Etsy</p>
            <form action={triggerSync}><button className="btn-primary px-4 py-2 text-sm">Sync now</button></form>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-terracotta">Not authorized yet.</p>
            <a href="/api/etsy/oauth" className="btn-primary px-4 py-2 text-sm">Connect Etsy shop</a>
          </div>
        )}
      </div>

      {/* Last sync times */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-3 text-sm"><p className="text-muted">Content import</p><p className="font-semibold">{timeAgo(state?.lastContentSyncAt)}</p></div>
        <div className="card p-3 text-sm"><p className="text-muted">Receipt poll (Etsy sales)</p><p className="font-semibold">{timeAgo(state?.lastReceiptPollAt)}</p></div>
        <div className="card p-3 text-sm"><p className="text-muted">Inventory reconcile</p><p className="font-semibold">{timeAgo(state?.lastInventoryPollAt)}</p></div>
        <div className="card p-3 text-sm"><p className="text-muted">Poll interval</p><p className="font-semibold">{tunables.pollIntervalSeconds()}s</p></div>
      </div>

      {/* Conflicts needing resolution */}
      <h2 className="mt-8 text-lg font-bold">Conflicts needing your decision ({conflicts.length})</h2>
      <p className="text-sm text-muted">We never silently overwrite. Pick which count is correct.</p>
      <div className="mt-3 space-y-3">
        {conflicts.length === 0 && <p className="text-sm text-muted">No conflicts 🎉</p>}
        {conflicts.map((c) => (
          <div key={c.id} className="card p-4">
            <p className="font-semibold">{c.variant.product.title} — {c.variant.name}</p>
            <p className="text-sm text-terracotta">{c.type}: {c.detail}</p>
            <p className="mt-1 text-sm">Site says <strong>{c.siteQty ?? "—"}</strong>, Etsy says <strong>{c.etsyQty ?? "—"}</strong></p>
            <form action={resolveConflict} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="conflictId" value={c.id} />
              <button name="resolution" value="use_site" className="btn-secondary px-3 py-1.5 text-sm">Keep site count → push to Etsy</button>
              <button name="resolution" value="use_etsy" className="btn-secondary px-3 py-1.5 text-sm">Accept Etsy count</button>
              <button name="resolution" value="ignore" className="btn-secondary px-3 py-1.5 text-sm">Ignore</button>
            </form>
          </div>
        ))}
      </div>

      {/* Per-product ledger vs Etsy */}
      <h2 className="mt-8 text-lg font-bold">Ledger vs Etsy ({variants.length} linked variants)</h2>
      <div className="card mt-3 overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th className="py-1">Product</th><th>Variant</th><th>Site qty (truth)</th><th>Last seen on Etsy</th></tr></thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id} className="border-t border-charcoal/5">
                <td className="py-1">{v.product.title}</td>
                <td>{v.name}</td>
                <td className="font-semibold">{v.quantity}</td>
                <td className={v.etsyLastSeenQty !== v.quantity ? "text-terracotta" : ""}>{v.etsyLastSeenQty ?? "—"}</td>
              </tr>
            ))}
            {variants.length === 0 && <tr><td colSpan={4} className="py-2 text-muted">No Etsy-linked variants yet. Run a content import after connecting.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pending pushes */}
      <h2 className="mt-8 text-lg font-bold">Pending pushes to Etsy ({pushes.length})</h2>
      <div className="mt-3 space-y-1 text-sm">
        {pushes.length === 0 && <p className="text-muted">None pending.</p>}
        {pushes.map((p) => (
          <p key={p.id} className="card px-3 py-2">{p.variant.product.title} ({p.variant.name}) → set Etsy qty to {p.targetQty}</p>
        ))}
      </div>

      {/* Recent log */}
      <h2 className="mt-8 text-lg font-bold">Recent sync activity</h2>
      <div className="card mt-3 max-h-80 overflow-y-auto p-4 text-sm">
        {logs.length === 0 && <p className="text-muted">No activity logged yet.</p>}
        {logs.map((l) => (
          <p key={l.id} className={`border-b border-charcoal/5 py-1 ${l.level === "error" ? "text-red-600" : l.level === "warn" ? "text-terracotta" : ""}`}>
            <span className="text-muted">{l.createdAt.toLocaleTimeString()}</span> [{l.direction}] {l.action}: {l.message}
          </p>
        ))}
      </div>
    </div>
  );
}
