import { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms for buying handmade goods from ${siteConfig.name}.`,
};

// DRAFT for owner review — reflects how the shop operates (handmade, low stock,
// Stripe payments, flat shipping, handmade returns). Confirm the items marked
// [confirm] and have it reviewed before launch. Not legal advice.
export default function TermsPage() {
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-4xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: on launch · Please review before going live.</p>

      <section className="mt-8 space-y-3 text-charcoal/90">
        <p>
          By placing an order with {siteConfig.name}, you agree to these terms. We&apos;re a small
          handmade shop, so a little context up front keeps things friendly and clear.
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Handmade, one-of-a-few items</h2>
        <p>
          Every piece is cut, knotted, and sewn by hand in small batches. Slight variations in
          fabric, color, and frayed edges are part of the handmade character, not defects. Because
          stock is low, an item may sell out between page views; if something sells out after you
          order, we&apos;ll contact you and issue a full refund.
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Prices &amp; payment</h2>
        <p>
          Prices are in US dollars and may change at any time. Payment is processed securely by
          Stripe at checkout. Your order is confirmed once payment succeeds and you receive a
          confirmation email.
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Shipping</h2>
        <p>
          We ship within the US and Canada. Orders typically ship within 1&ndash;3 business days with
          tracking by email. Shipping is a flat rate shown at checkout. Delivery times depend on the
          carrier. [confirm turnaround, carrier, and any free-shipping items]
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Returns &amp; exchanges</h2>
        <p>
          Because items are handmade, please contact us within 7 days of delivery with any issue and
          we&apos;ll make it right with a replacement or refund. Custom orders are made to your
          specifications and may not be returnable. See{" "}
          <Link href="/policies" className="font-semibold text-terracotta underline">Shipping &amp; Returns</Link>{" "}
          for details. [confirm return window &amp; custom-order policy]
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Custom orders</h2>
        <p>
          We confirm fabrics and details by message before starting a custom piece. Because each is
          made just for you, please review the details carefully when we confirm them.
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Intellectual property</h2>
        <p>
          All photos, designs, and site content are owned by {siteConfig.name} and may not be used
          without permission.
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Limitation of liability</h2>
        <p>
          Our products are decorative. To the fullest extent permitted by law, our liability for any
          order is limited to the amount you paid for it.
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Governing law</h2>
        <p>These terms are governed by the laws of the State of Arizona, USA. [confirm]</p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Contact</h2>
        <p>
          Questions? Reach us via the{" "}
          <Link href="/contact" className="font-semibold text-terracotta underline">contact page</Link>.
        </p>
      </section>
    </div>
  );
}
