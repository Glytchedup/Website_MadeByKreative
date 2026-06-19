// Customer-facing scarcity cue, aligned with the homepage badge: only shown for
// genuinely low stock (<=2) so it stays meaningful and honest on one-of-a-few
// handmade items (no "in stock" badge on everything). The separate operational
// threshold for admin low-stock alerts / checkout JIT lives in
// tunables.lowStockThreshold and is intentionally not used here.
export function StockBadge({ quantity }: { quantity: number }) {
  if (quantity <= 0) {
    return <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-xs font-semibold text-muted">Sold out</span>;
  }
  if (quantity <= 2) {
    return (
      <span className="rounded-full bg-terracotta/15 px-2 py-0.5 text-xs font-semibold text-terracotta">
        Only {quantity} left
      </span>
    );
  }
  return null;
}
