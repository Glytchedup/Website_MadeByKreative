"use client";

// Single-page storefront, ported from the MadeByKreative design shell and wired
// to live data (props.catalog, mapped from our Etsy-synced DB) and our real cart
// (useCart) + on-site Stripe checkout. "Add" adds the selected variant to the
// cart; the cart button links to /cart. Etsy links remain as a secondary CTA.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import type { Catalog, CatalogProduct, CatalogVariant } from "@/lib/catalog";

const C = {
  cream: "#FBF8F3",
  ink: "#2E2A24",
  clay: "#B0683F",
  clayDark: "#99572F",
  muted: "#5A5247",
  muted2: "#8A7E6E",
  muted3: "#9A8C78",
  line: "rgba(110,90,60,0.14)",
};
const serif = "'Newsreader', Georgia, serif";
const sans = "'Hanken Grotesk', system-ui, sans-serif";
const script = "'Caveat', cursive";

function money(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function badgeFor(p: CatalogProduct): string {
  if (p.tags.includes("Bestseller")) return "Bestseller";
  if (p.tags.includes("New")) return "New";
  const q = p.quantity;
  if (q <= 0) return "Sold out";
  if (q === 1) return "Only 1 left";
  if (q <= 3) return `Only ${q} left`;
  if (q <= 5) return "Only a few left";
  return "";
}
function badgeStyle(label: string): { bg: string; fg: string } {
  if (label === "Bestseller") return { bg: "rgba(176,104,63,0.92)", fg: C.cream };
  if (label === "New") return { bg: "rgba(254,252,248,0.92)", fg: C.ink };
  if (label === "Sold out") return { bg: "rgba(120,110,98,0.92)", fg: C.cream };
  if (label === "Only 1 left") return { bg: "rgba(155,55,40,0.9)", fg: C.cream };
  return { bg: "rgba(46,42,36,0.86)", fg: C.cream };
}
const frayMask =
  "conic-gradient(from -45deg at bottom, transparent, #000 1deg 89deg, transparent 90deg) bottom/13px 100% repeat-x";

const BUNT_COLORS = ["#E0734F", "#EBD9BE", "#9CB082", "#34506B", "#D8A24A", "#C98BA0"];
const SEASON_BY_MONTH = [
  "Valentine's", "Valentine's", "St. Patrick's", "Easter", "Spring", "Patriotic",
  "Patriotic", "Fall", "Fall", "Halloween", "Christmas", "Christmas",
];

export function Storefront({ catalog }: { catalog: Catalog }) {
  const { add, count } = useCart();
  const products = catalog.products;
  const { shop, seasonOrder } = catalog;

  const [hovered, setHovered] = useState<string | null>(null);
  const [sizeSel, setSizeSel] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [seasonFilter, setSeasonFilter] = useState("All");
  const [custom, setCustom] = useState({ season: "", style: "Pennant bunting", length: "Standard" });
  const flyLayer = useRef<HTMLDivElement>(null);

  const selectedVariant = (p: CatalogProduct): CatalogVariant | undefined => {
    const chosen = p.variants.find((v) => v.id === sizeSel[p.id]);
    return chosen || p.variants.find((v) => v.quantity > 0) || p.variants[0];
  };

  function flyHeart(e: React.MouseEvent) {
    const layer = flyLayer.current;
    if (!layer || typeof document === "undefined") return;
    const h = document.createElement("div");
    h.textContent = "♥";
    h.style.cssText = `position:fixed; z-index:200; left:${e.clientX - 9}px; top:${e.clientY - 9}px; color:#C2453F; font-size:19px; pointer-events:none;`;
    document.body.appendChild(h);
    const a = h.animate(
      [
        { transform: "translateY(2px) scale(0.5)", opacity: 0 },
        { transform: "translateY(-10px) scale(1.2)", opacity: 1, offset: 0.3 },
        { transform: "translateY(-46px) scale(0.85)", opacity: 0 },
      ],
      { duration: 850, easing: "cubic-bezier(.4,0,.2,1)" }
    );
    a.onfinish = () => h.remove();
  }

  function addToCart(p: CatalogProduct, e: React.MouseEvent) {
    e.stopPropagation();
    const v = selectedVariant(p);
    if (!v || v.quantity <= 0) return;
    add({
      variantId: v.id,
      productSlug: p.slug,
      title: p.title,
      variantName: v.label,
      priceCents: v.priceCents,
      image: p.images[0],
      quantity: 1,
      maxQty: v.quantity,
    });
    flyHeart(e);
  }

  // ---- derived view data ----
  const bunting = useMemo(() => {
    const n = 18;
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const yvb = 14 + 40 * (1 - Math.pow(2 * t - 1, 2));
      return {
        color: BUNT_COLORS[i % BUNT_COLORS.length],
        delay: `-${(i * 0.16).toFixed(2)}s`,
        x: `${(2 + t * 96).toFixed(2)}%`,
        y: `${yvb.toFixed(1)}px`,
        rot: `${((2 * t - 1) * 14).toFixed(1)}deg`,
      };
    });
  }, []);

  const heroP = products.find((p) => p.latest) || products[0] || null;
  const newArrivals = products.filter((p) => p.id !== heroP?.id).slice(0, 3);

  const monthName = SEASON_BY_MONTH[new Date().getMonth()];
  const seasonNow =
    seasonOrder.find((s) => norm(s).includes(norm(monthName))) || seasonOrder[0] || "All";
  const seasonNowCount = products.filter((p) => p.season === seasonNow).length;

  const seasonCounts: Record<string, number> = {};
  products.forEach((p) => { seasonCounts[p.season] = (seasonCounts[p.season] || 0) + 1; });
  const availSeasons = seasonOrder.filter((n) => seasonCounts[n]);

  const productsShown = seasonFilter === "All" ? products : products.filter((p) => p.season === seasonFilter);
  const shopCountLabel =
    seasonFilter === "All"
      ? `${products.length} banners · sewn with love`
      : `${productsShown.length} ${seasonFilter} ${productsShown.length === 1 ? "banner" : "banners"}`;

  const trust = [
    { value: `${shop.rating.toFixed(1)} ★`, label: "Average rating" },
    { value: String(shop.reviewCount), label: "Five-star reviews" },
    { value: shop.salesCount, label: "Banners sold" },
    { value: "Star Seller", label: "Etsy recognition" },
    { value: shop.shipDays, label: "Ships from Arizona" },
  ];

  const reviews = [
    { text: "The shabby patriotic piece is sensational and is used on one of our wreaths. We love it — thank you for your patriotism and your artistry.", name: "Sue", item: "Patriotic Shabby Rag Garland", initial: "S", av: "#B0683F" },
    { text: "Love it so much. Looks absolutely perfect on my mantle.", name: "Ashley", item: "Fall Shabby Bow Garland", initial: "A", av: "#7D8B6A" },
    { text: "Love this mini flag banner! Will definitely be ordering more in the future.", name: "Sara", item: "Mini Bunting Banner", initial: "S", av: "#3E5C73" },
  ];

  const footerCols = [
    { title: "Shop", links: [{ label: "All banners", href: "/shop" }, { label: "Collections", href: "/collections" }, { label: "Custom orders", href: "#custom" }] },
    { title: "Seasons", links: availSeasons.slice(0, 5).map((s) => ({ label: s, href: "#seasons" })) },
    { title: "Help", links: [{ label: "Shipping & returns", href: "/policies" }, { label: "About Kristol", href: "/about" }, { label: "Contact", href: "/contact" }] },
  ];

  // ---- custom tool ----
  const styleChoices = ["Pennant bunting", "Shabby rag garland", "Tied bow garland"];
  const lengthChoices = ["Mini", "Standard", "Extra long"];
  const stylePrice: Record<string, number> = { "Pennant bunting": 15, "Shabby rag garland": 16, "Tied bow garland": 20 };
  const lengthAdj: Record<string, number> = { Mini: -3, Standard: 0, "Extra long": 8 };
  const cSeason = custom.season || seasonNow;
  const cPrice = (stylePrice[custom.style] || 15) + (lengthAdj[custom.length] || 0);

  // ---- modal ----
  const mp = openId ? products.find((p) => p.id === openId) : null;
  const mImgs = mp?.images || [];
  const gi = Math.max(0, Math.min(galleryIdx, mImgs.length - 1));
  const mv = mp ? selectedVariant(mp) : undefined;
  const mBadge = mp ? badgeFor(mp) : "";

  function openProduct(id: string) {
    setOpenId(id);
    setGalleryIdx(0);
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";
  }
  function closeProduct() {
    setOpenId(null);
    if (typeof document !== "undefined") document.body.style.overflow = "";
  }

  return (
    <div ref={flyLayer} style={{ minHeight: "100vh", backgroundColor: C.cream, backgroundImage: "repeating-linear-gradient(0deg, rgba(120,98,66,0.022) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(120,98,66,0.022) 0 1px, transparent 1px 3px)", color: C.ink, fontFamily: sans }}>

      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "saturate(1.1) blur(10px)", background: "rgba(251,248,243,0.82)", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <a href="#top" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ fontFamily: script, fontSize: 34, color: C.clay, lineHeight: 1 }}>MadeByKreative</span>
            <span style={{ fontFamily: sans, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted3, paddingLeft: 15, borderLeft: "1px solid rgba(110,90,60,0.2)", lineHeight: 1.55, maxWidth: 100 }}>Handmade Fabric Banners</span>
          </a>
          <nav style={{ display: "flex", alignItems: "center", gap: 30, flexWrap: "wrap" }}>
            {[["#seasons", "Shop by Season"], ["#shop", "Featured"], ["#custom", "Custom"], ["#story", "Our Story"], ["#reviews", "Reviews"]].map(([href, label]) => (
              <a key={href} href={href} style={{ textDecoration: "none", color: C.muted, fontSize: 14.5, fontWeight: 500 }}>{label}</a>
            ))}
            <Link href="/cart" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, background: C.ink, color: C.cream, border: "none", borderRadius: 999, padding: "9px 16px 9px 14px", fontFamily: sans, fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ fontSize: 15 }}>&#9788;</span>
              <span>Cart</span>
              <span style={{ background: "rgba(251,248,243,0.22)", borderRadius: 999, minWidth: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, padding: "0 6px" }}>{count}</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section id="top" style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 28px 36px" }}>
        <div style={{ position: "relative", height: 96, margin: "0 -28px 18px" }}>
          <svg viewBox="0 0 1000 80" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 80 }}>
            <path d="M20 14 Q500 94 980 14" fill="none" stroke="rgba(110,90,60,0.42)" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {bunting.map((b, i) => (
            <span key={i} style={{ position: "absolute", left: b.x, top: b.y, marginLeft: -13, transform: `rotate(${b.rot})`, transformOrigin: "top center" }}>
              <span style={{ display: "block", width: 26, height: 32, background: b.color, clipPath: "polygon(0 0, 100% 0, 50% 100%)", transformOrigin: "top center", animation: "mbkSway 3.6s ease-in-out infinite", animationDelay: b.delay, boxShadow: "inset 0 3px 0 rgba(255,255,255,0.28), inset 0 0 0 1px rgba(70,55,35,0.06)" }} />
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(32px,5vw,60px)", alignItems: "center" }}>
          <div style={{ flex: "1 1 360px", minWidth: 300 }}>
            <a href="#shop" onClick={() => setSeasonFilter(seasonNow)} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(176,104,63,0.1)", border: "1px solid rgba(176,104,63,0.28)", color: C.clayDark, padding: "7px 15px 7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
              <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: C.clay }} />
                <span style={{ position: "absolute", inset: -3, borderRadius: "50%", border: "1px solid rgba(176,104,63,0.5)", animation: "mbkPulse 2s ease-out infinite" }} />
              </span>
              In season now: {seasonNow} · {seasonNowCount} styles
            </a>
            <span style={{ fontFamily: script, fontSize: "clamp(28px,3.4vw,38px)", color: C.clay, display: "block", transform: "rotate(-2deg)", marginBottom: 6 }}>Handmade with love</span>
            <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(46px,6.4vw,82px)", lineHeight: 1.02, letterSpacing: "-0.02em", margin: "6px 0 0", color: C.ink }}>Seasonal banners,<br />stitched by hand.</h1>
            <div style={{ height: 9, width: "min(340px,80%)", marginTop: 14, backgroundImage: "radial-gradient(circle, #C2453F 1.9px, transparent 2.2px)", backgroundSize: "11px 9px", backgroundRepeat: "repeat-x", backgroundPosition: "left center" }} />
            <p style={{ fontSize: "clamp(16px,1.5vw,19px)", lineHeight: 1.65, color: C.muted, maxWidth: "42ch", margin: "22px 0 0" }}>Pennant buntings, shabby rag garlands, and tied-bow banners — raw frayed edges and all — made one stitch at a time to bring a little warmth to your mantle.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginTop: 32 }}>
              <a href="#shop" style={{ textDecoration: "none", background: C.clay, color: C.cream, padding: "16px 32px", borderRadius: 2, fontSize: 15, fontWeight: 600, letterSpacing: "0.02em", boxShadow: "0 8px 22px rgba(176,104,63,0.26)" }}>Shop the Collection</a>
              <a href="#story" style={{ textDecoration: "none", color: C.ink, fontSize: 15, fontWeight: 600, borderBottom: "1.5px solid rgba(110,90,60,0.3)", paddingBottom: 3 }}>Meet the maker &rarr;</a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 30, color: C.muted2, fontSize: 13.5 }}>
              <span style={{ color: "#C9912F", letterSpacing: 2, fontSize: 15 }}>&#9733;&#9733;&#9733;&#9733;&#9733;</span>
              <span style={{ color: C.muted }}><strong style={{ color: C.ink }}>5.0</strong> from {shop.reviewCount} reviews</span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C9B9A2" }} />
              <span>Star Seller on Etsy</span>
            </div>
          </div>

          <div style={{ position: "relative", flex: "1.2 1 460px", minWidth: 320 }}>
            <div style={{ position: "relative", aspectRatio: "25/22", overflow: "hidden", borderRadius: 3, boxShadow: "0 34px 66px rgba(60,45,25,0.2), 0 4px 14px rgba(60,45,25,0.08)", background: "#E4D7C2" }}>
              {heroP?.images[0] ? (
                <img src={heroP.images[0]} alt={heroP.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
              ) : (
                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: C.muted2 }}>A banner for every season</div>
              )}
              <span style={{ position: "absolute", top: 14, left: 14, display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(46,42,36,0.74)", color: C.cream, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 999, backdropFilter: "blur(4px)" }}><span style={{ color: "#E7A877", fontSize: 13, lineHeight: 1 }}>&#9788;</span> A banner for every season</span>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 13, background: C.cream, pointerEvents: "none", WebkitMask: frayMask, mask: frayMask }} />
            </div>
            <div style={{ position: "absolute", bottom: -18, left: -18, background: "#FEFCF8", border: `1px solid ${C.line}`, borderRadius: 2, padding: "14px 20px", boxShadow: "0 16px 30px rgba(60,45,25,0.12)", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: script, fontSize: 24, color: C.clay, lineHeight: 1 }}>one stitch at a time</span>
              <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted3 }}>Cut, knotted &amp; sewn by hand</span>
            </div>
            {heroP && (
              <button onClick={() => openProduct(heroP.id)} style={{ position: "absolute", right: -16, bottom: 44, display: "flex", alignItems: "center", gap: 11, background: "#FEFCF8", border: `1px solid ${C.line}`, borderRadius: 3, padding: "9px 15px 9px 9px", boxShadow: "0 18px 36px rgba(60,45,25,0.22)", cursor: "pointer", textAlign: "left", maxWidth: 236 }}>
                {heroP.images[0] && <img src={heroP.images[0]} alt={heroP.title} style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 2, flex: "none" }} />}
                <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.clay }}><span style={{ fontSize: 11, lineHeight: 1 }}>&#10022;</span> Just added</span>
                  <span style={{ fontFamily: serif, fontSize: 15, fontWeight: 500, color: C.ink, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{heroP.title}</span>
                  <span style={{ fontSize: 12.5, color: C.muted2, fontWeight: 600 }}>{heroP.priceLabel} &rarr;</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section style={{ maxWidth: 1240, margin: "18px auto 0", padding: "0 28px" }}>
        <div style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "22px 0", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "20px 36px" }}>
          {trust.map((t, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
              <span style={{ fontFamily: serif, fontSize: 24, fontWeight: 500, color: C.ink, lineHeight: 1 }}>{t.value}</span>
              <span style={{ fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted3 }}>{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* NEW ARRIVALS */}
      {newArrivals.length > 0 && (
        <section style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 28px 8px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 26 }}>
            <div>
              <span style={{ fontFamily: script, fontSize: 26, color: C.clay }}>just off the needle</span>
              <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", letterSpacing: "-0.01em", margin: "2px 0 0" }}>New arrivals</h2>
            </div>
            <a href="#shop" style={{ textDecoration: "none", color: C.ink, fontSize: 14, fontWeight: 600, borderBottom: "1.5px solid rgba(110,90,60,0.3)", paddingBottom: 3 }}>See all banners &rarr;</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,240px), 1fr))", gap: 18 }}>
            {newArrivals.map((n) => (
              <button key={n.id} onClick={() => openProduct(n.id)} style={{ position: "relative", display: "block", padding: 0, border: "none", cursor: "pointer", background: "#E4D7C2", borderRadius: 4, overflow: "hidden", aspectRatio: "4/3.1", boxShadow: "0 2px 10px rgba(60,45,25,0.08)", textAlign: "left" }}>
                {n.images[0] && <img src={n.images[0]} alt={n.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                <span style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(254,252,248,0.92)", color: C.ink, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, backdropFilter: "blur(4px)" }}><span style={{ color: C.clay, fontSize: 12, lineHeight: 1 }}>&#10022;</span> New</span>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(38,28,16,0.78) 0%, rgba(38,28,16,0.12) 46%, transparent 68%)" }} />
                <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, color: C.cream }}>
                  <span style={{ display: "block", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(251,248,243,0.78)", marginBottom: 3 }}>{n.season} · {n.type}</span>
                  <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontFamily: serif, fontSize: 19, fontWeight: 500, lineHeight: 1.15 }}>{n.title}</span>
                    <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, flex: "none" }}>{n.priceLabel}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* SHOP BY SEASON */}
      <section id="seasons" style={{ background: "#F4ECDE", backgroundImage: "repeating-linear-gradient(0deg, rgba(120,98,66,0.03) 0 1px, transparent 1px 4px)", marginTop: 44, borderTop: "1px solid rgba(110,90,60,0.1)", borderBottom: "1px solid rgba(110,90,60,0.1)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 28px 66px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 30 }}>
            <div>
              <span style={{ fontFamily: script, fontSize: 26, color: C.clay }}>find your season</span>
              <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.01em", margin: "2px 0 0" }}>Shop by Season</h2>
            </div>
            <p style={{ fontSize: 14.5, color: C.muted2, maxWidth: "34ch", margin: 0 }}>From spring pastels to Halloween spooks, there&apos;s a banner for every shelf, all year round.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
            {availSeasons.map((name) => {
              const hit = products.find((p) => p.season === name && p.images[0]);
              const img = hit?.images[0];
              return (
                <a key={name} href="#shop" onClick={() => setSeasonFilter(name)} style={{ textDecoration: "none", position: "relative", display: "block", aspectRatio: "3/4", borderRadius: 3, overflow: "hidden", boxShadow: "0 2px 8px rgba(60,45,25,0.08)" }}>
                  {img ? (
                    <>
                      <img src={img} alt={`${name} banners`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(40,30,18,0.62) 0%, rgba(40,30,18,0.05) 48%, transparent 70%)" }} />
                      <span style={{ position: "absolute", left: 14, bottom: 13, right: 12, fontFamily: serif, fontSize: 20, fontWeight: 500, color: "#FEFCF8", lineHeight: 1.05 }}>{name}</span>
                    </>
                  ) : (
                    <>
                      <div style={{ position: "absolute", inset: 0, backgroundColor: "#D9CDBA" }} />
                      <span style={{ position: "absolute", left: 14, bottom: 13, right: 12, fontFamily: serif, fontSize: 20, fontWeight: 500, color: C.ink, lineHeight: 1.05 }}>{name}</span>
                    </>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURED GRID */}
      <section id="shop" style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 30 }}>
          <div>
            <span style={{ fontFamily: script, fontSize: 26, color: C.clay }}>fresh off the sewing table</span>
            <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.01em", margin: "2px 0 0" }}>Featured Banners</h2>
          </div>
          <span style={{ fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted3 }}>{shopCountLabel}</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 28 }}>
          {[{ name: "All", count: products.length }, ...availSeasons.map((n) => ({ name: n, count: seasonCounts[n] }))].map((f) => {
            const active = seasonFilter === f.name;
            return (
              <button key={f.name} onClick={() => setSeasonFilter(f.name)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 999, fontFamily: sans, fontSize: 13, fontWeight: 600, cursor: "pointer", border: active ? `1px solid ${C.clay}` : "1px solid rgba(110,90,60,0.28)", background: active ? C.clay : "transparent", color: active ? C.cream : C.muted, boxShadow: active ? "0 4px 12px rgba(176,104,63,0.22)" : "none" }}>
                {f.name}<span style={{ fontSize: 11, fontWeight: 600, color: active ? "rgba(251,248,243,0.72)" : C.muted3 }}>{f.count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 24 }}>
          {productsShown.map((p) => {
            const hov = hovered === p.id;
            const v = selectedVariant(p);
            const badge = badgeFor(p);
            const bs = badgeStyle(badge);
            const imgs = p.images;
            const img = (hov && imgs[1]) ? imgs[1] : imgs[0];
            return (
              <div key={p.id} onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered((h) => (h === p.id ? null : h))} onClick={() => openProduct(p.id)} style={{ position: "relative", cursor: "pointer", background: "#FEFCF8", borderRadius: 4, border: `1px solid ${C.line}`, transition: "transform .35s cubic-bezier(.2,.7,.3,1), box-shadow .35s ease", transform: hov ? "translateY(-6px)" : "translateY(0)", boxShadow: hov ? "0 22px 44px rgba(60,45,25,0.18)" : "0 1px 4px rgba(60,45,25,0.06)" }}>
                <div style={{ position: "relative", aspectRatio: "4/5", overflow: "hidden", borderRadius: "4px 4px 0 0" }}>
                  {img ? (
                    <img src={img} alt={p.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transformOrigin: "center", transition: "transform .8s cubic-bezier(.2,.7,.3,1)", transform: hov ? "scale(1.07)" : "scale(1)" }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, backgroundColor: "#D9CDBA", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(46,42,36,0.4)" }}>&#9788;</div>
                  )}
                  {badge && <span style={{ position: "absolute", top: 12, left: 12, background: bs.bg, color: bs.fg, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, backdropFilter: "blur(4px)" }}>{badge}</span>}
                  {imgs.length > 1 && <span style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 5, background: "rgba(46,42,36,0.72)", color: C.cream, fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 999, backdropFilter: "blur(4px)" }}><span style={{ fontSize: 12, lineHeight: 1 }}>&#9635;</span>{imgs.length}</span>}
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 11, background: "#FEFCF8", WebkitMask: frayMask, mask: frayMask }} />
                </div>
                <div style={{ padding: "13px 16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted3 }}>{p.season}</span>
                    <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 13, color: "#B3A48E" }}>{p.type}</span>
                  </div>
                  <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 19, lineHeight: 1.2, margin: "5px 0 0", color: C.ink }}>{p.title}</h3>
                  <div style={{ height: 0, borderTop: "1.5px dashed rgba(120,95,60,0.32)", margin: "14px 0 13px" }} />
                  {p.variants.length > 1 && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                      {p.variants.map((sz) => {
                        const on = (sizeSel[p.id] || v?.id) === sz.id;
                        return (
                          <button key={sz.id} onClick={(e) => { e.stopPropagation(); setSizeSel((s) => ({ ...s, [p.id]: sz.id })); }} disabled={sz.quantity <= 0} style={{ flex: "1 0 auto", minWidth: 44, padding: "7px 8px", fontFamily: sans, fontSize: 12, fontWeight: 600, cursor: sz.quantity <= 0 ? "not-allowed" : "pointer", borderRadius: 2, border: on ? `1px solid ${C.ink}` : "1px solid rgba(110,90,60,0.3)", background: on ? C.ink : "transparent", color: on ? C.cream : "#6B5D4A", opacity: sz.quantity <= 0 ? 0.4 : 1 }}>{sz.label}</button>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontFamily: serif, fontSize: 26, fontWeight: 500, color: C.ink, lineHeight: 0.95 }}>{money(v?.priceCents ?? p.priceCents)}</span>
                    <button onClick={(e) => addToCart(p, e)} disabled={!v || v.quantity <= 0} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: v && v.quantity > 0 ? C.clay : "#B8AE9E", color: C.cream, border: "none", borderRadius: 2, padding: "10px 17px", fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: "0.03em", cursor: v && v.quantity > 0 ? "pointer" : "not-allowed", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.22), 0 4px 12px rgba(176,104,63,0.22)" }}><span style={{ fontSize: 13, lineHeight: 1 }}>&#10022;</span> {v && v.quantity > 0 ? "Add" : "Sold out"}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {productsShown.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: C.muted2, fontSize: 15 }}>Nothing in this season just yet. <button onClick={() => setSeasonFilter("All")} style={{ background: "none", border: "none", color: C.clay, font: "inherit", fontWeight: 600, cursor: "pointer", textDecoration: "underline", padding: 0 }}>See every banner</button></div>
        )}
      </section>

      {/* DESIGN YOUR OWN */}
      <section id="custom" style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 28px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <span style={{ fontFamily: script, fontSize: 28, color: C.clay }}>made just for you</span>
          <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(30px,4vw,46px)", letterSpacing: "-0.01em", margin: "2px 0 8px" }}>Design your own banner</h2>
          <p style={{ fontSize: 15.5, color: C.muted2, maxWidth: "46ch", margin: "0 auto" }}>Can&apos;t find the perfect match? Tell me your colors and style, and I&apos;ll stitch one up just for you.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,300px),1fr))", gap: 28, alignItems: "stretch", background: "#FEFCF8", border: `1px solid ${C.line}`, borderRadius: 5, padding: "clamp(24px,3vw,38px)", boxShadow: "0 2px 10px rgba(60,45,25,0.05)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {[
              { label: "1 · Season & colors", opts: seasonOrder.length ? seasonOrder : [seasonNow], key: "season" as const },
              { label: "2 · Style", opts: styleChoices, key: "style" as const },
              { label: "3 · Length", opts: lengthChoices, key: "length" as const },
            ].map((group) => (
              <div key={group.key}>
                <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted3 }}>{group.label}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
                  {group.opts.map((o) => {
                    const cur = group.key === "season" ? cSeason : custom[group.key];
                    const on = o === cur;
                    return (
                      <button key={o} onClick={() => setCustom((c) => ({ ...c, [group.key]: o }))} style={{ padding: "8px 13px", borderRadius: 999, fontFamily: sans, fontSize: 13, fontWeight: 600, cursor: "pointer", border: on ? `1px solid ${C.ink}` : "1px solid rgba(110,90,60,0.28)", background: on ? C.ink : "transparent", color: on ? C.cream : C.muted }}>{o}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: C.ink, borderRadius: 4, padding: "30px 28px", color: C.cream, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: script, fontSize: 25, color: "#E7A877", lineHeight: 1 }}>your custom banner</span>
            <p style={{ fontFamily: serif, fontSize: 25, lineHeight: 1.25, margin: "10px 0 0", color: C.cream }}>A {custom.length.toLowerCase()} {custom.style.toLowerCase()} in {cSeason} colors</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 16 }}>
              <span style={{ fontSize: 13, color: "#C9BCA8" }}>Estimated</span>
              <span style={{ fontFamily: serif, fontSize: 27, color: C.cream }}>~${cPrice}</span>
            </div>
            <Link href="/contact" style={{ marginTop: 22, textAlign: "center", textDecoration: "none", background: C.clay, color: C.cream, borderRadius: 2, padding: "14px 20px", fontFamily: sans, fontSize: 15, fontWeight: 600 }}>Request this custom banner &rarr;</Link>
            <span style={{ fontSize: 12, color: "#9C8F7C", textAlign: "center", marginTop: 9 }}>We&apos;ll confirm fabrics &amp; details by message before I start.</span>
          </div>
        </div>
      </section>

      {/* STORY */}
      <section id="story" style={{ position: "relative", marginTop: 72, background: "#F1E9DC", backgroundImage: "repeating-linear-gradient(0deg, rgba(120,98,66,0.04) 0 1px, transparent 1px 4px)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "clamp(48px,6vw,84px) 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "clamp(36px,5vw,68px)", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <div style={{ aspectRatio: "4/5", borderRadius: 3, overflow: "hidden", boxShadow: "0 24px 50px rgba(60,45,25,0.16)", backgroundColor: "#DCCBB3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: script, fontSize: 30, color: "#A2937F" }}>Kristol at her machine</span>
              </div>
              <div style={{ position: "absolute", top: -16, right: -14, background: C.clay, color: C.cream, width: 96, height: 96, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", transform: "rotate(8deg)", boxShadow: "0 12px 26px rgba(176,104,63,0.32)" }}>
                <span style={{ fontFamily: script, fontSize: 26, lineHeight: 0.95 }}>since</span>
                <span style={{ fontFamily: serif, fontSize: 24, lineHeight: 1 }}>2020</span>
              </div>
            </div>
            <div>
              <span style={{ fontFamily: script, fontSize: 28, color: C.clay }}>the maker&apos;s story</span>
              <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(28px,3.6vw,42px)", lineHeight: 1.12, letterSpacing: "-0.01em", margin: "6px 0 0" }}>It started with a needle, thread &amp; a lot of love.</h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.7, color: C.muted, margin: "22px 0 0" }}>I&apos;m Kristol, a quilter, reader, and ocean-lover crafting from my home in Gilbert, Arizona. This little shop began the year I started sewing masks, after someone I love dearly was diagnosed with cancer. What started as a way to care for my family grew into something I treasure.</p>
              <p style={{ fontSize: 16.5, lineHeight: 1.7, color: C.muted, margin: "16px 0 0" }}>Every banner is still cut, knotted, and stitched by hand. The frayed edges and little imperfections? Those are the parts I love most. They&apos;re the proof a real person made this, just for your home.</p>
              <span style={{ fontFamily: script, fontSize: 34, color: C.ink, display: "block", marginTop: 22 }}>Kristol</span>
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" style={{ position: "relative", background: "#5C3024", backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 4px)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "clamp(60px,6vw,90px) 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <span style={{ fontFamily: script, fontSize: 26, color: "#E7A877" }}>kind words</span>
            <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.01em", margin: "2px 0 8px", color: C.cream }}>Loved by 1,280+ homes</h2>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#D8C7B8", fontSize: 14 }}>
              <span style={{ color: "#E7C66B", letterSpacing: 2, fontSize: 16 }}>&#9733;&#9733;&#9733;&#9733;&#9733;</span>
              <span><strong style={{ color: C.cream }}>5.0</strong> · 227 reviews</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 22 }}>
            {reviews.map((r, i) => (
              <figure key={i} style={{ margin: 0, background: "#FEFCF8", border: "1px solid rgba(110,90,60,0.12)", borderRadius: 3, padding: "26px 24px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 2px 8px rgba(60,45,25,0.05)" }}>
                <span style={{ color: "#C9912F", letterSpacing: 2, fontSize: 15 }}>&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <blockquote style={{ margin: 0, fontFamily: serif, fontSize: 19, lineHeight: 1.45, color: "#3A352D" }}>&ldquo;{r.text}&rdquo;</blockquote>
                <figcaption style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: r.av, color: "#FEFCF8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, fontFamily: serif }}>{r.initial}</span>
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{r.name}</span>
                    <span style={{ fontSize: 12, color: C.muted3 }}>{r.item}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 28px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "36px 28px", paddingBottom: 40, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ minWidth: 200 }}>
            <span style={{ fontFamily: script, fontSize: 30, color: C.clay }}>MadeByKreative</span>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: C.muted2, margin: "12px 0 0", maxWidth: "30ch" }}>Handmade fabric banners, sewn one stitch at a time in Gilbert, Arizona.</p>
          </div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <h4 style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted3, margin: "0 0 14px" }}>{col.title}</h4>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map((lk) => (
                  <li key={lk.label}>
                    {lk.href.startsWith("#") ? (
                      <a href={lk.href} style={{ textDecoration: "none", color: C.muted, fontSize: 14 }}>{lk.label}</a>
                    ) : (
                      <Link href={lk.href} style={{ textDecoration: "none", color: C.muted, fontSize: 14 }}>{lk.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", paddingTop: 24 }}>
          <span style={{ fontSize: 13, color: C.muted3 }}>© {new Date().getFullYear()} MadeByKreative · Made with love by Kristol</span>
          <span style={{ fontFamily: script, fontSize: 22, color: C.clay }}>handmade with love &#9825;</span>
        </div>
      </footer>

      {/* PRODUCT MODAL */}
      {mp && (
        <div onClick={closeProduct} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(40,30,18,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", background: "#FEFCF8", borderRadius: 5, width: "100%", maxWidth: 960, maxHeight: "90vh", overflow: "auto", boxShadow: "0 40px 90px rgba(40,30,18,0.45)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}>
            <button onClick={closeProduct} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, zIndex: 5, width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(254,252,248,0.92)", color: C.ink, fontSize: 20, lineHeight: 1, cursor: "pointer", boxShadow: "0 2px 10px rgba(40,30,18,0.18)" }}>&times;</button>
            <div style={{ padding: 20, background: "#F4EDE2" }}>
              <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: 3, overflow: "hidden", background: "#E4D7C2", boxShadow: "0 6px 18px rgba(60,45,25,0.12)" }}>
                {mImgs[gi] && <img src={mImgs[gi]} alt={mp.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                <span style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(46,42,36,0.7)", color: C.cream, fontSize: 11.5, fontWeight: 600, padding: "4px 9px", borderRadius: 999, backdropFilter: "blur(4px)" }}>{gi + 1} / {mImgs.length || 1}</span>
              </div>
              {mImgs.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {mImgs.map((im, idx) => (
                    <button key={idx} onClick={() => setGalleryIdx(idx)} style={{ width: 62, height: 62, borderRadius: 3, overflow: "hidden", padding: 0, cursor: "pointer", background: "none", border: idx === gi ? `2px solid ${C.clay}` : "2px solid rgba(110,90,60,0.22)", opacity: idx === gi ? 1 : 0.7 }}>
                      <img src={im} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "30px 32px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted3 }}>{mp.season}</span>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C9B9A2" }} />
                <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 14, color: "#B3A48E" }}>{mp.type}</span>
                {mBadge && <span style={{ marginLeft: "auto", background: badgeStyle(mBadge).bg, color: badgeStyle(mBadge).fg, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 999 }}>{mBadge}</span>}
              </div>
              <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(26px,3.2vw,34px)", lineHeight: 1.12, letterSpacing: "-0.01em", margin: "8px 0 0", color: C.ink }}>{mp.title}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                <span style={{ color: "#C9912F", letterSpacing: 2, fontSize: 15 }}>&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <span style={{ fontSize: 13, color: C.muted2 }}>5.0 · Star Seller</span>
              </div>
              <span style={{ fontFamily: serif, fontSize: 28, fontWeight: 500, color: C.ink, display: "block", margin: "16px 0 0" }}>{money(mv?.priceCents ?? mp.priceCents)}</span>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: C.muted, margin: "18px 0 0", whiteSpace: "pre-line" }}>{mp.description}</p>

              {mp.variants.length > 1 && (
                <div style={{ marginTop: 20 }}>
                  <span style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted3 }}>Size</span>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {mp.variants.map((sz) => {
                      const on = (sizeSel[mp.id] || mv?.id) === sz.id;
                      return (
                        <button key={sz.id} onClick={() => setSizeSel((s) => ({ ...s, [mp.id]: sz.id }))} disabled={sz.quantity <= 0} style={{ flex: "1 0 auto", minWidth: 54, padding: "9px 8px", fontFamily: sans, fontSize: 13, fontWeight: 600, cursor: sz.quantity <= 0 ? "not-allowed" : "pointer", borderRadius: 2, border: on ? `1px solid ${C.ink}` : "1px solid rgba(110,90,60,0.3)", background: on ? C.ink : "transparent", color: on ? C.cream : "#6B5D4A", opacity: sz.quantity <= 0 ? 0.4 : 1 }}>{sz.label}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
                <button onClick={(e) => addToCart(mp, e)} disabled={!mv || mv.quantity <= 0} style={{ flex: "1 1 150px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: mv && mv.quantity > 0 ? C.ink : "#B8AE9E", color: C.cream, border: "none", borderRadius: 2, padding: "15px 22px", fontFamily: sans, fontSize: 15, fontWeight: 600, cursor: mv && mv.quantity > 0 ? "pointer" : "not-allowed" }}><span style={{ fontSize: 17, lineHeight: 1 }}>+</span> {mv && mv.quantity > 0 ? "Add to Cart" : "Sold out"}</button>
                <a href={mp.url} target="_blank" rel="noopener noreferrer" style={{ flex: "1 1 150px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textDecoration: "none", background: "transparent", color: C.ink, border: "1.5px solid rgba(110,90,60,0.32)", borderRadius: 2, padding: "15px 22px", fontFamily: sans, fontSize: 14.5, fontWeight: 600 }}>View full listing on Etsy &rarr;</a>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, color: C.muted2, fontSize: 12.5 }}>
                <span style={{ fontSize: 14 }}>&#9788;</span>
                <span>Handmade · ships from Gilbert, Arizona in {shop.shipDays}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
