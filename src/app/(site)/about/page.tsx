import { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Our Story",
  description: "How MadeByKreative began, a family, a diagnosis, and a love of handmade craft.",
};

export default function AboutPage() {
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-4xl font-bold">Our story</h1>
      <p className="mt-2 text-muted">Handmade with love by {siteConfig.maker} · {siteConfig.location}</p>

      <div className="prose mt-8 max-w-none space-y-4 text-lg text-charcoal/90">
        <p>
          MadeByKreative started in one of the hardest seasons of our family&apos;s life. When
          someone we love dearly was diagnosed with cancer, I picked up needle and thread and
          began making fabric masks, a small way to help and to keep my hands busy through the worry.
        </p>
        <p>
          What began as a way to cope grew into something joyful. Friends asked for garlands, then
          banners, then keychains. Five years later, MadeByKreative is a Star Seller on Etsy with
          over 1,280 sales and a 5.0★ rating across 227 reviews, but at heart it&apos;s still the
          same thing: one maker, sewing each piece by hand, packing each order with care.
        </p>
        <p>
          Every garland and banner is made to order or one of just a few, so when you buy something
          here, you&apos;re getting a genuinely handmade piece, not a factory print. Thank you for
          supporting a small, family-run business. It means the world. 💛
        </p>
        <p className="text-sm text-muted">
          <em>(Placeholder copy, Kristol, edit this anytime in the admin to tell your story in your own words, and add a photo.)</em>
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3 text-center">
        <div className="card p-5"><p className="text-2xl font-bold text-terracotta">5 yrs</p><p className="text-sm text-muted">on Etsy</p></div>
        <div className="card p-5"><p className="text-2xl font-bold text-terracotta">1,280+</p><p className="text-sm text-muted">happy customers</p></div>
        <div className="card p-5"><p className="text-2xl font-bold text-terracotta">5.0 ★</p><p className="text-sm text-muted">227 reviews</p></div>
      </div>
    </div>
  );
}
