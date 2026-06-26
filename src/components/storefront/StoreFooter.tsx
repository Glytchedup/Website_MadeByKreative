"use client";

// Shared storefront footer used by BOTH the homepage and the inner (site) pages.
// Visual design matches the original homepage footer; adds the newsletter signup
// and the Etsy social-proof link from the inner footer.

import Link from "next/link";
import { Newsletter } from "@/components/Newsletter";
import { siteConfig } from "@/lib/config";

const C = {
  clay: "#B0683F",
  muted: "#5A5247",
  muted2: "#6B6358", // darkened for AA on cream (5.6:1)
  muted3: "#6E665C", // darkened for AA on cream (5.3:1)
  line: "rgba(110,90,60,0.14)",
};
const sans = "'Hanken Grotesk', system-ui, sans-serif";
const script = "'Caveat', cursive";

const COLS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  { title: "Shop", links: [
    { label: "Featured", href: "/#shop" },
    { label: "Collections", href: "/collections" },
    { label: "Custom orders", href: "/#custom" },
  ] },
  { title: "Explore", links: [
    { label: "Shop by Season", href: "/#seasons" },
    { label: "Our Story", href: "/about" },
    { label: "Reviews", href: "/#reviews" },
  ] },
  { title: "Help", links: [
    { label: "Shipping & Returns", href: "/policies" },
    { label: "Contact", href: "/contact" },
    { label: "Find us on Etsy", href: siteConfig.etsyShopUrl, external: true },
  ] },
  { title: "Legal", links: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ] },
];

export function StoreFooter() {
  return (
    <footer style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 28px 48px", fontFamily: sans }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "36px 28px", paddingBottom: 40, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ minWidth: 200 }}>
          <span style={{ fontFamily: script, fontSize: 30, color: C.clay }}>MadeByKreative</span>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: C.muted2, margin: "12px 0 0", maxWidth: "30ch" }}>Handmade fabric banners, sewn one stitch at a time in {siteConfig.location}.</p>
          <p style={{ fontSize: 14, margin: "12px 0 0" }}>
            <a href={siteConfig.etsyShopUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.clay, textDecoration: "none", fontWeight: 600 }}>Find us on Etsy &#9733; 5.0 (227 reviews)</a>
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted3, margin: "0 0 14px" }}>{col.title}</h4>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {col.links.map((lk) => (
                <li key={lk.label}>
                  {lk.external ? (
                    <a href={lk.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: C.muted, fontSize: 14 }}>{lk.label}</a>
                  ) : (
                    <Link href={lk.href} style={{ textDecoration: "none", color: C.muted, fontSize: 14 }}>{lk.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div style={{ minWidth: 200 }}>
          <h4 style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted3, margin: "0 0 14px" }}>Join the list</h4>
          <p style={{ fontSize: 14, color: C.muted2, margin: "0 0 12px" }}>New collections &amp; restocks, no spam.</p>
          <Newsletter />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", paddingTop: 24 }}>
        <span style={{ fontSize: 13, color: C.muted3 }}>&copy; {new Date().getFullYear()} MadeByKreative &middot; Made with love by {siteConfig.maker}</span>
        <span style={{ fontFamily: script, fontSize: 22, color: C.clay }}>handmade with love &#9825;</span>
      </div>
    </footer>
  );
}
