"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatPrice } from "@/lib/money";

export default function CartPage() {
  const { items, subtotalCents, setQty, remove } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start checkout.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted">Find something handmade to love.</p>
        <Link href="/shop" className="btn-primary mt-6">Browse the shop</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <ul className="space-y-4 lg:col-span-2">
          {items.map((i) => (
            <li key={i.variantId} className="card flex gap-4 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-linen">
                {i.image && <Image src={i.image} alt={i.title} fill className="object-cover" sizes="80px" />}
              </div>
              <div className="flex-1">
                <Link href={`/products/${i.productSlug}`} className="font-semibold hover:text-terracotta">{i.title}</Link>
                <p className="text-sm text-muted">{i.variantName}</p>
                <div className="mt-2 flex items-center gap-3">
                  <label className="sr-only" htmlFor={`q-${i.variantId}`}>Quantity</label>
                  <input
                    id={`q-${i.variantId}`}
                    type="number"
                    min={1}
                    max={i.maxQty}
                    value={i.quantity}
                    onChange={(e) => setQty(i.variantId, Number(e.target.value))}
                    className="w-16 rounded border border-charcoal/20 px-2 py-1"
                  />
                  <button onClick={() => remove(i.variantId)} className="text-sm text-muted underline hover:text-terracotta">Remove</button>
                </div>
              </div>
              <div className="font-bold text-terracotta">{formatPrice(i.priceCents * i.quantity)}</div>
            </li>
          ))}
        </ul>

        <aside className="card h-fit p-6">
          <h2 className="text-lg font-bold">Order summary</h2>
          <div className="mt-4 flex justify-between text-sm"><span>Subtotal</span><span>{formatPrice(subtotalCents)}</span></div>
          <p className="mt-1 text-xs text-muted">Shipping calculated at checkout.</p>
          {error && <p className="mt-3 rounded bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p>}
          <button onClick={checkout} disabled={loading} className="btn-primary mt-4 w-full">
            {loading ? "Starting checkout…" : "Checkout securely"}
          </button>
          <p className="mt-2 text-center text-xs text-muted">🔒 Secure payment by Stripe</p>
        </aside>
      </div>
    </div>
  );
}
