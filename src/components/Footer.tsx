import Link from "next/link";
import { siteConfig } from "@/lib/config";
import { Newsletter } from "./Newsletter";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-charcoal/10 bg-linen">
      <div className="container-page grid gap-10 py-12 md:grid-cols-3">
        <div>
          <h3 className="font-display text-lg font-bold text-terracotta">{siteConfig.name}</h3>
          <p className="mt-2 max-w-xs text-sm text-muted">
            Handmade fabric garlands, banners, bunting & keychains — stitched with love by{" "}
            {siteConfig.maker} in {siteConfig.location}.
          </p>
          <p className="mt-3 text-sm">
            <a className="underline hover:text-terracotta" href={siteConfig.etsyShopUrl} target="_blank" rel="noopener noreferrer">
              Find us on Etsy ★ 5.0 (227 reviews)
            </a>
          </p>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <h4 className="mb-2 font-semibold">Explore</h4>
          <ul className="space-y-1">
            <li><Link href="/shop" className="hover:text-terracotta">Shop All</Link></li>
            <li><Link href="/collections" className="hover:text-terracotta">Collections</Link></li>
            <li><Link href="/about" className="hover:text-terracotta">Our Story</Link></li>
            <li><Link href="/policies" className="hover:text-terracotta">Shipping & Returns</Link></li>
            <li><Link href="/contact" className="hover:text-terracotta">Contact</Link></li>
          </ul>
        </nav>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Join the list</h4>
          <p className="mb-3 text-sm text-muted">New collections & restocks, no spam.</p>
          <Newsletter />
        </div>
      </div>
      <div className="border-t border-charcoal/10 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {siteConfig.name}. Made by hand, sold with care. · Secure checkout by Stripe
      </div>
    </footer>
  );
}
