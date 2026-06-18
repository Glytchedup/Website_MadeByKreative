"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

export interface CartItem {
  variantId: string;
  productSlug: string;
  title: string;
  variantName: string;
  priceCents: number;
  image?: string;
  quantity: number;
  maxQty: number; // available stock snapshot (validated again server-side at checkout)
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (item: CartItem) => void;
  setQty: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "mbk_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, quantity: Math.min(i.quantity + item.quantity, item.maxQty) }
            : i
        );
      }
      return [...prev, { ...item, quantity: Math.min(item.quantity, item.maxQty) }];
    });
    setOpen(true);
  }, []);

  const setQty = useCallback((variantId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(Math.max(quantity, 0), i.maxQty) } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const subtotalCents = items.reduce((s, i) => s + i.quantity * i.priceCents, 0);
    return { items, count, subtotalCents, add, setQty, remove, clear, isOpen, setOpen };
  }, [items, add, setQty, remove, clear, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
