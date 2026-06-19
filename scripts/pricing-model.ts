// Generates a pricing + margin model CSV from the catalog dump.
// Reproducible: change the suggest() tiers and re-run to regenerate.
//
//   npx tsx scripts/pricing-model.ts > docs/etsy-pricing-model.csv
//
// Fee model (US, estimate):
//   Etsy transaction 6.5% + payment processing (3% + $0.25) + listing $0.20
//     => ~9.5% * price + $0.45   (free-shipping model: shipping baked into price)
//   Offsite Ads (when attributed): +15% * price
//   Own site (Stripe): 2.9% + $0.30
import * as fs from "fs";

type Cat = "rag" | "bow" | "regular" | "mini" | "medium" | "keychain";

// Map each Etsy listing id -> pricing category.
const CAT: Record<string, Cat> = {
  "4501311139": "rag",     // Halloween Shabby Rag
  "4397171839": "keychain",// Wristlet Keychain
  "4502175008": "rag",     // Halloween Spooky Rag
  "4445686548": "mini",    // Mini St Pats Bunting (3.5x3)
  "4445268586": "regular", // Easter Bunting (7x5.5)
  "4445023094": "regular", // Valentine Bunting (7x5.5)
  "4472664026": "rag",     // Spring Rag
  "4502242035": "bow",     // Fall Bow Garland
  "4502158137": "rag",     // Halloween Stripe/Dot Rag
  "4501273090": "rag",     // Fall Rag
  "4410719847": "regular", // Birthday Bunting Orange (single 73")
  "4445706905": "rag",     // St Pats Rag (3/4/5/6 ft)
  "4397754506": "medium",  // Christmas Bunting (5.5x5)
  "4397757322": "medium",  // Holiday Gingerbread Bunting (5.5x5)
  "4445266382": "regular", // St Pats Bunting Regular (7x5.5)
  "4391640839": "regular", // Birthday Bunting Lime (single 73")
};

// Suggested price in dollars by category + size label.
//
// IMPORTANT: Kristol's Etsy prices are ALREADY tiered by size (the earlier
// "flat pricing" finding was a sync bug that flattened variants to the base
// price — now fixed). So these tiers mostly MATCH her current prices; the only
// real changes are the keychain ($8->$12), the single-size Birthday banners
// ($15->$20, below her own regular-pennant line), and a few optional bumps on
// the largest sizes where there's headroom.
function suggest(cat: Cat, label: string): number {
  const lc = label.toLowerCase();
  const num = parseFloat(lc) || 0; // first number in label
  const inches = lc.includes("inch") ? num : null;
  switch (cat) {
    case "keychain":
      return 12; // was $8 — genuinely underpriced
    case "rag": {
      // Already well-priced; matches current (3/4/5/6 ft).
      const feet = lc.includes("inch") ? Math.round(num / 12) : Math.round(num);
      const map: Record<number, number> = { 3: 12, 4: 15, 5: 17.5, 6: 20 };
      return map[feet] ?? 15 + (feet - 4) * 2.5;
    }
    case "bow":
      return (inches ?? num) <= 45 ? 20 : 30; // 70in $25 -> $30 (optional bump)
    case "regular":
      if (lc === "default") return 20; // Birthday 73" banner: $15 -> $20
      return (inches ?? num) <= 50 ? 16 : 22; // 67/68in $20 -> $22 (optional)
    case "mini":
      return (inches ?? num) <= 50 ? 10 : 15; // matches current
    case "medium":
      return (inches ?? num) <= 50 ? 14 : 20; // 67in $18 -> $20 (optional)
  }
}

const etsyFee = (p: number, ads: boolean) => (ads ? 0.245 : 0.095) * p + 0.45;
const stripeFee = (p: number) => 0.029 * p + 0.3;
const m = (n: number) => n.toFixed(2);

const data = JSON.parse(fs.readFileSync("scripts/catalog-dump.json", "utf8")) as any[];

const rows: string[] = [];
rows.push(
  [
    "Product",
    "Size",
    "Current $",
    "Suggested $",
    "Change $",
    "Etsy fee (no ads) $",
    "Net after Etsy (no ads) $",
    "Etsy fee (+15% ads) $",
    "Net after Etsy (+ads) $",
    "Net on own site (Stripe) $",
    "Your material+labor cost $ (fill in)",
    "Profit on own site $ (=net - cost)",
  ].join(",")
);

let curTotal = 0;
let sugTotal = 0;
for (const p of data) {
  const cat = CAT[p.etsyListingId] ?? "regular";
  for (const v of p.variants) {
    const cur = v.priceCents / 100;
    const sug = suggest(cat, v.name);
    curTotal += cur;
    sugTotal += sug;
    const title = `"${p.title.replace(/&#39;/g, "'").replace(/"/g, "'")}"`;
    rows.push(
      [
        title,
        `"${v.name}"`,
        m(cur),
        m(sug),
        m(sug - cur),
        m(etsyFee(sug, false)),
        m(sug - etsyFee(sug, false)),
        m(etsyFee(sug, true)),
        m(sug - etsyFee(sug, true)),
        m(sug - stripeFee(sug)),
        "",
        "",
      ].join(",")
    );
  }
}

console.log(rows.join("\n"));
console.error(
  `Variants: ${rows.length - 1} | Current avg $${m(curTotal / (rows.length - 1))} | Suggested avg $${m(
    sugTotal / (rows.length - 1)
  )} | Avg uplift $${m((sugTotal - curTotal) / (rows.length - 1))}`
);
