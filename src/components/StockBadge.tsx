import { tunables } from "@/lib/config";

// Scarcity cue. Low-count handmade items: "only X left" drives conversion AND
// sets honest expectations (these are one-of-a-few, not made-to-order).
export function StockBadge({ quantity }: { quantity: number }) {
  const threshold = tunables.lowStockThreshold();
  if (quantity <= 0) {
    return <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-xs font-semibold text-muted">Sold out</span>;
  }
  if (quantity <= threshold) {
    return (
      <span className="rounded-full bg-terracotta/15 px-2 py-0.5 text-xs font-semibold text-terracotta">
        Only {quantity} left
      </span>
    );
  }
  return <span className="rounded-full bg-sage/15 px-2 py-0.5 text-xs font-semibold text-sage">In stock</span>;
}
