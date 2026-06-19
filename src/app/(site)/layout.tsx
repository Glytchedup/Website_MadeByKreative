import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// Chrome for the inner storefront pages (shop, cart, about, etc.). The homepage
// uses its own full design (own header/footer) and lives outside this group.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-terracotta focus:px-4 focus:py-2 focus:text-cream"
      >
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
