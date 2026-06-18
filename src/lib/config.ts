// Centralized, typed access to environment configuration + feature flags.
// Every integration degrades gracefully when its env vars are missing.

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "MadeByKreative",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  description:
    "Handmade fabric garlands, banners, bunting & keychains — made with love in Gilbert, Arizona by Kristol.",
  maker: "Kristol",
  location: "Gilbert, Arizona",
  etsyShopUrl: "https://www.etsy.com/shop/MadeByKreative",
};

export const flags = {
  stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
  etsyConfigured: Boolean(process.env.ETSY_KEYSTRING && process.env.ETSY_SHARED_SECRET),
  emailEnabled: Boolean(process.env.RESEND_API_KEY),
  analyticsEnabled: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
};

export function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const tunables = {
  pollIntervalSeconds: () => intEnv("ETSY_POLL_INTERVAL_SECONDS", 150),
  lowStockThreshold: () => intEnv("LOW_STOCK_THRESHOLD", 3),
};
