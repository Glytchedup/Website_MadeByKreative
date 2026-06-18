import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/lib/config";
import { CartProvider } from "@/components/cart/CartProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Analytics } from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Handmade Fabric Garlands, Banners & Keychains`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "handmade",
    "fabric garland",
    "rag garland",
    "bunting banner",
    "pennant banner",
    "shabby chic",
    "holiday decor",
    "fabric keychain",
    "wristlet keychain",
  ],
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    url: siteConfig.url,
    title: `${siteConfig.name} — Handmade with love in ${siteConfig.location}`,
    description: siteConfig.description,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-terracotta focus:px-4 focus:py-2 focus:text-cream"
        >
          Skip to content
        </a>
        <CartProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
