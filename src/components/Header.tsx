"use client";

import Link from "next/link";
import { useCart } from "./cart/CartProvider";
import { siteConfig } from "@/lib/config";

const nav = [
  { href: "/shop", label: "Shop All" },
  { href: "/collections", label: "Collections" },
  { href: "/about", label: "Our Story" },
  { href: "/policies", label: "Policies" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-charcoal/10 bg-cream/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-xl font-bold text-terracotta">
          {siteConfig.name}
        </Link>
        <nav aria-label="Primary" className="hidden gap-6 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium hover:text-terracotta">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/cart" className="relative rounded-soft p-2 hover:bg-linen" aria-label={`Cart, ${count} items`}>
          <span aria-hidden>🛒</span>
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-xs font-bold text-cream">
              {count}
            </span>
          )}
        </Link>
      </div>
      {/* mobile nav */}
      <nav aria-label="Primary mobile" className="flex gap-4 overflow-x-auto border-t border-charcoal/10 px-4 py-2 md:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap text-sm font-medium hover:text-terracotta">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
