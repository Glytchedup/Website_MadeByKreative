import { StoreHeader } from "@/components/storefront/StoreHeader";
import { StoreFooter } from "@/components/storefront/StoreFooter";

// Chrome for the inner storefront pages (shop, cart, about, etc.). Uses the same
// shared header/footer as the homepage so the whole site shares one identity.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-terracotta focus:px-4 focus:py-2 focus:text-cream"
      >
        Skip to content
      </a>
      <StoreHeader />
      <main id="main">{children}</main>
      <StoreFooter />
    </>
  );
}
