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
  const shipping = await getPolicy(
    "policy_shipping",
    "Most orders ship within 1–3 business days via USPS. You'll receive tracking by email. (Placeholder — confirm your real turnaround and carrier in admin.)"
  );
  const returns = await getPolicy(
    "policy_returns",
    "Because items are handmade, please contact me within 7 days of delivery for any issue and I'll make it right with a replacement or refund. (Placeholder — confirm your return policy.)"
  );
  const faq = await getPolicy(
    "policy_faq",
    "Q: Are these really handmade? Yes — every piece is sewn by hand by Kristol.\nQ: Can I request a custom color? Often yes — use the contact page to ask!\n(Placeholder FAQ — edit in admin.)"
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
