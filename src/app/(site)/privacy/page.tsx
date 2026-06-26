import { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects your information.`,
};

// DRAFT for owner review. Reflects how the app actually works (Stripe, Resend,
// optional GA4 with consent, Etsy sync). Kristol should confirm the business
// details marked [confirm] and have it reviewed before launch — this is not legal
// advice.
export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-12 prose-policy">
      <h1 className="text-4xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: on launch · Please review before going live.</p>

      <section className="mt-8 space-y-3 text-charcoal/90">
        <p>
          {siteConfig.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a small handmade-goods shop run by
          {" "}{siteConfig.maker} in {siteConfig.location}. We respect your privacy and collect only
          what we need to fulfill your order and run the shop.
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">What we collect</h2>
        <ul className="list-disc pl-6">
          <li><strong>Order details:</strong> your name, email, and shipping address, collected through Stripe Checkout when you buy.</li>
          <li><strong>Messages:</strong> anything you send via the contact form or newsletter sign-up (name, email, message).</li>
          <li><strong>Payment information:</strong> handled entirely by Stripe. We never see or store your card number.</li>
          <li><strong>Analytics (optional):</strong> if you accept cookies, anonymized usage data via Google Analytics 4 (IP anonymization on). No analytics cookies are set unless you opt in.</li>
        </ul>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Who we share it with</h2>
        <p>We share data only with the processors that make the shop work:</p>
        <ul className="list-disc pl-6">
          <li><strong>Stripe</strong> — payment processing.</li>
          <li><strong>Resend</strong> — order, shipping, and refund emails.</li>
          <li><strong>Etsy</strong> — inventory is synced with our Etsy shop; Etsy orders are governed by Etsy&apos;s own privacy policy.</li>
          <li><strong>Vercel / our database host</strong> — site hosting and order records.</li>
          <li><strong>Google Analytics</strong> — only if you opt in to analytics cookies.</li>
        </ul>
        <p>We never sell your personal information.</p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">How long we keep it</h2>
        <p>
          We keep order records as long as needed for accounting, warranty, and legal obligations,
          then delete or anonymize them. You can ask us to delete your data at any time (subject to
          records we&apos;re required to keep). [confirm retention period]
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Your rights</h2>
        <p>
          Depending on where you live (including under CCPA/CPRA and GDPR), you may have the right to
          access, correct, delete, or export your personal data, and to opt out of analytics. To make
          a request, reach us through the <Link href="/contact" className="font-semibold text-terracotta underline">contact page</Link>.
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Cookies</h2>
        <p>
          Essential cookies keep your cart and session working. Analytics cookies are set only after
          you accept them in the cookie banner; you can decline and still use the whole store.
        </p>

        <h2 className="mt-6 text-2xl font-bold text-terracotta">Contact</h2>
        <p>
          Questions about your privacy? Message us via the{" "}
          <Link href="/contact" className="font-semibold text-terracotta underline">contact page</Link>.
          [confirm a dedicated privacy contact email and business mailing address]
        </p>
      </section>
    </div>
  );
}
