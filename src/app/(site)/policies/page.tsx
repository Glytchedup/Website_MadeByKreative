import { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping, Returns & FAQ",
  description: "Shipping times, returns & exchanges, and frequently asked questions for MadeByKreative.",
};

// Policies are editable via the Setting table (admin). Falls back to sensible
// placeholder defaults the maker should confirm.
async function getPolicy(key: string, fallback: string) {
  const row = await prisma.setting.findUnique({ where: { key } }).catch(() => null);
  return row?.value ?? fallback;
}

export default async function PoliciesPage() {
  // Default drafts (editable in admin → Settings). Kept clean & customer-ready —
  // the maker should confirm turnaround/carrier/return-window and Save to override.
  const shipping = await getPolicy(
    "policy_shipping",
    "Most orders ship within 1–3 business days, with tracking sent to your email. We ship within the US and Canada at a flat rate shown at checkout. Because each piece is handmade in small batches, please allow a little extra time during busy seasons."
  );
  const returns = await getPolicy(
    "policy_returns",
    "Every item is handmade, so small variations are part of the charm. If anything arrives damaged or isn't right, contact us within 7 days of delivery and we'll make it right with a replacement or refund. Custom orders are made to your specifications and may not be returnable."
  );
  const faq = await getPolicy(
    "policy_faq",
    "Q: Are these really handmade?\nYes — every piece is cut, knotted, and sewn by hand by Kristol in Gilbert, Arizona.\n\nQ: Can I request a custom color or size?\nOften, yes! Use the contact page to tell us what you're picturing and we'll confirm before starting.\n\nQ: Do you restock sold-out items?\nMany seasonal pieces come back — follow us on Etsy or join the newsletter for restocks."
  );

  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-4xl font-bold">Shipping, returns & FAQ</h1>
      <section className="mt-8">
        <h2 className="text-2xl font-bold text-terracotta">Shipping</h2>
        <p className="mt-2 whitespace-pre-line text-charcoal/90">{shipping}</p>
      </section>
      <section className="mt-8">
        <h2 className="text-2xl font-bold text-terracotta">Returns & exchanges</h2>
        <p className="mt-2 whitespace-pre-line text-charcoal/90">{returns}</p>
      </section>
      <section className="mt-8">
        <h2 className="text-2xl font-bold text-terracotta">FAQ</h2>
        <p className="mt-2 whitespace-pre-line text-charcoal/90">{faq}</p>
      </section>
    </div>
  );
}
