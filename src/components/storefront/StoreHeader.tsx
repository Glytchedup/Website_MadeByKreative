"use client";

// Shared storefront header used by BOTH the homepage and the inner (site) pages,
// so the whole site shares one identity. Nav links use root-relative hashes
// (e.g. "/#shop") so they scroll on the homepage and navigate-then-scroll from
// inner pages. Visual design matches the original homepage chrome.

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";

const C = {
  cream: "#FBF8F3",
  ink: "#2E2A24",
  clay: "#B0683F",
  muted: "#5A5247",
  muted3: "#9A8C78",
  line: "rgba(110,90,60,0.14)",
};
const sans = "'Hanken Grotesk', system-ui, sans-serif";
const script = "'Caveat', cursive";

const NAV: [string, string][] = [
  ["/#seasons", "Shop by Season"],
  ["/#shop", "Featured"],
  ["/#custom", "Custom"],
  ["/#story", "Our Story"],
  ["/#reviews", "Reviews"],
];

export function StoreHeader() {
  const { count } = useCart();
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "saturate(1.1) blur(10px)", background: "rgba(251,248,243,0.82)", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 13 }}>
          <span style={{ fontFamily: script, fontSize: 34, color: C.clay, lineHeight: 1 }}>MadeByKreative</span>
          <span style={{ fontFamily: sans, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted3, paddingLeft: 15, borderLeft: "1px solid rgba(110,90,60,0.2)", lineHeight: 1.55, maxWidth: 100 }}>Handmade Fabric Banners</span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 30, flexWrap: "wrap" }}>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} style={{ textDecoration: "none", color: C.muted, fontSize: 14.5, fontWeight: 500 }}>{label}</Link>
          ))}
          <Link href="/cart" aria-label={`Cart, ${count} items`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, background: C.ink, color: C.cream, border: "none", borderRadius: 999, padding: "9px 16px 9px 14px", fontFamily: sans, fontSize: 13.5, fontWeight: 600 }}>
            <span style={{ fontSize: 15 }}>&#9788;</span>
            <span>Cart</span>
            <span style={{ background: "rgba(251,248,243,0.22)", borderRadius: 999, minWidth: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, padding: "0 6px" }}>{count}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
