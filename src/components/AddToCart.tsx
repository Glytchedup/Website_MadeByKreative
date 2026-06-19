"use client";

import { useState } from "react";
import { useCart } from "./cart/CartProvider";
import { formatPrice } from "@/lib/money";
import { StockBadge } from "./StockBadge";

interface VariantOpt {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
}

export function AddToCart({
  productSlug,
  title,
  image,
  variants,
}: {
  productSlug: string;
  title: string;
  image?: string;
  variants: VariantOpt[];
}) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState(variants[0]?.id);
  const [qty, setQty] = useState(1);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const soldOut = !variant || variant.quantity <= 0;

  function handleAdd() {
    if (!variant || soldOut) return;
    add({
      variantId: variant.id,
      productSlug,
      title,
      variantName: variant.name,
      priceCents: variant.priceCents,
      image,
      quantity: qty,
      maxQty: variant.quantity,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold text-terracotta">{formatPrice(variant?.priceCents ?? 0)}</span>
        {variant && <StockBadge quantity={variant.quantity} />}
      </div>

      {variants.length > 1 && (
        <div>
          <label htmlFor="variant" className="mb-1 block text-sm font-semibold">Size / option</label>
          <select
            id="variant"
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setQty(1);
            }}
            className="w-full rounded-soft border border-charcoal/20 bg-white px-3 py-2"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.quantity <= 0}>
                {v.name}, {formatPrice(v.priceCents)}
                {v.quantity <= 0 ? " (sold out)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div>
          <label htmlFor="qty" className="mb-1 block text-sm font-semibold">Qty</label>
          <input
            id="qty"
            type="number"
            min={1}
            max={Math.max(variant?.quantity ?? 1, 1)}
            value={qty}
            disabled={soldOut}
            onChange={(e) => setQty(Math.max(1, Math.min(Number(e.target.value), variant?.quantity ?? 1)))}
            className="w-20 rounded-soft border border-charcoal/20 bg-white px-3 py-2"
          />
        </div>
        <button onClick={handleAdd} disabled={soldOut} className="btn-primary flex-1">
          {soldOut ? "Sold out" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
