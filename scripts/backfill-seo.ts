// One-off backfill:
//   1) HTML-decode title/description/tags already stored (fixes "St. Patrick&#39;s").
//   2) Populate seoTitle / seoDescription per product (concise, keyword-rich meta
//      for the storefront's own SEO; not overwritten by Etsy content sync).
//
//   npx tsx --env-file=.env scripts/backfill-seo.ts
import { prisma } from "../src/lib/prisma";
import { decodeEntities } from "../src/lib/html";

// keyed by etsyListingId
const SEO: Record<string, { seoTitle: string; seoDescription: string }> = {
  "4501311139": {
    seoTitle: "Halloween Glow-in-the-Dark Spider Web Rag Garland",
    seoDescription:
      "Handmade Halloween rag garland with glow-in-the-dark spider web fabric. Shabby raw-edge banner for mantels & spooky decor. Choose your length.",
  },
  "4397171839": {
    seoTitle: "Fabric Wristlet Keychain – Handmade Cotton Key Fob",
    seoDescription:
      "Handmade cotton fabric wristlet keychain & key fob wrist strap. A cute, practical small gift for her, teachers, and new drivers.",
  },
  "4502175008": {
    seoTitle: "Spooky Black & Orange Halloween Rag Garland",
    seoDescription:
      "Handmade spooky Halloween rag garland in black & orange fabric. Shabby raw-edge banner for mantels, parties & Halloween decor.",
  },
  "4445686548": {
    seoTitle: "Mini St. Patrick's Day Shamrock Bunting Banner",
    seoDescription:
      "Handmade mini St. Patrick's Day bunting banner with shamrock fabric pennants. Green Irish mantel decor in two lengths.",
  },
  "4445268586": {
    seoTitle: "Easter Bunny Bunting Banner – Pastel Spring Decor",
    seoDescription:
      "Handmade Easter bunting banner with bunny fabric pennants. Pastel spring mantel decor & reusable Easter garland in two sizes.",
  },
  "4445023094": {
    seoTitle: "Valentine Heart Bunting Banner – Reusable Decor",
    seoDescription:
      "Handmade Valentine bunting banner with heart fabric pennants. Reusable Valentine's Day mantel decor & garland in two sizes.",
  },
  "4472664026": {
    seoTitle: "Spring Pastel Rag Garland – Shabby Tie Banner",
    seoDescription:
      "Handmade spring rag garland in pastel fabric. Shabby tie banner for Easter & spring mantel decor. Choose your length.",
  },
  "4502242035": {
    seoTitle: "Fall Bow Garland – Hand-Tied Autumn Banner",
    seoDescription:
      "Handmade fall bow garland with hand-tied fabric bows. Rustic autumn & Thanksgiving mantel decor in two lengths.",
  },
  "4502158137": {
    seoTitle: "Halloween Stripe & Dot Rag Garland Banner",
    seoDescription:
      "Handmade Halloween rag garland in stripe & dot fabric. Shabby orange & black banner for mantels and Halloween decor.",
  },
  "4501273090": {
    seoTitle: "Fall Rag Garland – Autumn Thanksgiving Banner",
    seoDescription:
      "Handmade fall rag garland in autumn fabric. Shabby tie banner for Thanksgiving & fall mantel decor. Choose your length.",
  },
  "4410719847": {
    seoTitle: "Happy Birthday Bunting Banner – Confetti Pennants",
    seoDescription:
      "Handmade Happy Birthday bunting banner with fabric pennants. Reusable party decor & birthday backdrop in orange confetti print.",
  },
  "4445706905": {
    seoTitle: "St. Patrick's Day Green Rag Garland Banner",
    seoDescription:
      "Handmade St. Patrick's Day rag garland in green fabric. Shabby shamrock tie banner for Irish mantel decor. Choose your length.",
  },
  "4397754506": {
    seoTitle: "Christmas Stocking Bunting Banner – Red & Green",
    seoDescription:
      "Handmade Christmas bunting banner with stocking fabric pennants. Red & green holiday mantel & fireplace decor in two sizes.",
  },
  "4397757322": {
    seoTitle: "Gingerbread Christmas Bunting Banner",
    seoDescription:
      "Handmade gingerbread Christmas bunting banner with fabric pennants. Holiday mantel & fireplace decor in two sizes.",
  },
  "4445266382": {
    seoTitle: "St. Patrick's Day Shamrock Bunting Banner",
    seoDescription:
      "Handmade St. Patrick's Day bunting banner with shamrock fabric pennants. Green Irish mantel decor in two lengths.",
  },
  "4391640839": {
    seoTitle: "Happy Birthday Bunting Banner – Lime Sprinkles",
    seoDescription:
      "Handmade Happy Birthday bunting banner with fabric pennants. Reusable party decor & birthday backdrop in lime sprinkles print.",
  },
};

async function main() {
  const products = await prisma.product.findMany();
  let decoded = 0;
  let seoSet = 0;

  for (const p of products) {
    const newTitle = decodeEntities(p.title);
    const newDesc = decodeEntities(p.description);
    const tagsArr = (() => {
      try {
        return JSON.parse(p.tags || "[]") as string[];
      } catch {
        return [];
      }
    })();
    const newTags = tagsArr.map(decodeEntities);

    const data: Record<string, unknown> = {};
    if (newTitle !== p.title) data.title = newTitle;
    if (newDesc !== p.description) data.description = newDesc;
    if (JSON.stringify(newTags) !== p.tags) data.tags = JSON.stringify(newTags);

    const seo = p.etsyListingId ? SEO[p.etsyListingId] : undefined;
    if (seo) {
      if (p.seoTitle !== seo.seoTitle) data.seoTitle = seo.seoTitle;
      if (p.seoDescription !== seo.seoDescription) data.seoDescription = seo.seoDescription;
    }

    if (Object.keys(data).length > 0) {
      await prisma.product.update({ where: { id: p.id }, data });
      if (data.title || data.description || data.tags) decoded++;
      if (data.seoTitle || data.seoDescription) seoSet++;
    }
  }

  console.log(`Decoded content on ${decoded} product(s); set SEO on ${seoSet} product(s).`);
}

main().finally(() => prisma.$disconnect());
