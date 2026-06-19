// Bottom-up banner pricing model. Builds each banner type's price from
// materials + labor + fees, then shows (a) the price needed to pay a real
// hourly wage and (b) the hourly wage Kristol actually earns at today's price.
//
// EVERY number in ASSUMPTIONS is an estimate to confirm with real figures —
// change them and re-run:
//   npx tsx scripts/cost-model.ts > docs/banner-cost-model.csv
//
// Shipping is treated as PASS-THROUGH (buyer pays it separately, as on the
// site today), so it's excluded from the item price; see the doc for the
// free-shipping math.

// ---- ASSUMPTIONS (edit these) --------------------------------------------
const FABRIC_PER_YARD = 10.0;   // quilting cotton, mid-range retail
const TAPE_PER_YARD = 0.3;      // cotton twill tape (pennant header)
const TWINE_PER_PIECE = 0.15;   // hanging string for rag/bow garlands
const NOTIONS = 0.25;           // thread, etc. per piece
const HTV_PER_PIECE = 0.6;      // heat-transfer vinyl lettering (birthday only)
const PACKAGING = 0.85;         // poly mailer + tissue + thank-you card
const ETSY_PCT = 0.095;         // 6.5% txn + 3% processing
const ETSY_FIXED = 0.45;        // $0.25 processing + $0.20 listing
// Wage tiers to price for:
const WAGES = [15, 20, 25];
const RECOMMEND_WAGE = 20;      // the wage the "Recommended" column targets

// ---- PRODUCTS (type, size, fabric yards, labor minutes, current price) ----
type Row = {
  type: string; size: string; fabricYd: number; tapeYd: number;
  twine: boolean; htv: boolean; laborMin: number; current: number; rec: number;
};
// `rec` = the recommended price from RECOMMENDATIONS.md (cost + market triangulated).
const ROWS: Row[] = [
  // Shabby rag garland (twine base, no tape)
  { type: "Rag garland", size: "3 ft", fabricYd: 0.40, tapeYd: 0, twine: true, htv: false, laborMin: 25, current: 12, rec: 15 },
  { type: "Rag garland", size: "4 ft", fabricYd: 0.55, tapeYd: 0, twine: true, htv: false, laborMin: 32, current: 15, rec: 18 },
  { type: "Rag garland", size: "5 ft", fabricYd: 0.70, tapeYd: 0, twine: true, htv: false, laborMin: 42, current: 17.5, rec: 22 },
  { type: "Rag garland", size: "6 ft", fabricYd: 0.85, tapeYd: 0, twine: true, htv: false, laborMin: 52, current: 20, rec: 26 },
  // Regular pennant bunting (7 x 5.5), double-sided
  { type: "Regular pennant", size: "48 in (7)", fabricYd: 0.46, tapeYd: 1.5, twine: false, htv: false, laborMin: 55, current: 16, rec: 20 },
  { type: "Regular pennant", size: "67 in (10)", fabricYd: 0.66, tapeYd: 2.0, twine: false, htv: false, laborMin: 75, current: 20, rec: 28 },
  // Medium pennant (5.5 x 5)
  { type: "Medium pennant", size: "48 in (7)", fabricYd: 0.35, tapeYd: 1.5, twine: false, htv: false, laborMin: 45, current: 14, rec: 18 },
  { type: "Medium pennant", size: "67 in (11)", fabricYd: 0.54, tapeYd: 2.0, twine: false, htv: false, laborMin: 62, current: 18, rec: 24 },
  // Mini pennant (3.5 x 3)
  { type: "Mini pennant", size: "48 in (13)", fabricYd: 0.23, tapeYd: 1.5, twine: false, htv: false, laborMin: 50, current: 10, rec: 12 },
  { type: "Mini pennant", size: "72 in (19)", fabricYd: 0.34, tapeYd: 2.2, twine: false, htv: false, laborMin: 70, current: 15, rec: 20 },
  // Hand-tied bow garland
  { type: "Bow garland", size: "36 in (5)", fabricYd: 0.35, tapeYd: 0, twine: true, htv: false, laborMin: 40, current: 20, rec: 20 },
  { type: "Bow garland", size: "70 in (9)", fabricYd: 0.60, tapeYd: 0, twine: true, htv: false, laborMin: 62, current: 25, rec: 30 },
  // Birthday bunting (regular pennant + HTV lettering, single 73" size)
  { type: "Birthday pennant", size: "73 in (11)", fabricYd: 0.70, tapeYd: 2.2, twine: false, htv: true, laborMin: 70, current: 15, rec: 22 },
];

const r2 = (n: number) => Math.round(n * 100) / 100;
// round a price to a tidy retail value (.00 or .50)
const tidy = (n: number) => {
  const x = Math.round(n * 2) / 2;
  return x;
};

function materials(row: Row): number {
  return r2(
    row.fabricYd * FABRIC_PER_YARD +
      row.tapeYd * TAPE_PER_YARD +
      (row.twine ? TWINE_PER_PIECE : 0) +
      (row.htv ? HTV_PER_PIECE : 0) +
      NOTIONS +
      PACKAGING
  );
}

// Price to exactly earn `wage` $/hr after materials + Etsy fees (zero extra profit).
function priceForWage(row: Row, wage: number): number {
  const mat = materials(row);
  const labor = (row.laborMin / 60) * wage;
  return (mat + labor + ETSY_FIXED) / (1 - ETSY_PCT);
}

// Profit per hour of making time at a given price (= what each hour at the
// sewing table earns after materials + Etsy fees). This is the number to
// optimize when TIME is the bottleneck, not units sold.
function profitPerHour(row: Row, price: number): number {
  const mat = materials(row);
  const fee = ETSY_PCT * price + ETSY_FIXED;
  return (price - mat - fee) / (row.laborMin / 60);
}
// The hourly wage Kristol actually earns at her current price.
const impliedWage = (row: Row) => profitPerHour(row, row.current);

const header = [
  "Type", "Size", "Current $", "Fabric yds", "Materials $", "Labor min",
  "Etsy fee @current $", "Profit/hr now $", "Recommended $", "Profit/hr at recommended $",
  ...WAGES.map((w) => `Price to earn $${w}/hr`),
];
const lines = [header.join(",")];

for (const row of ROWS) {
  lines.push(
    [
      row.type,
      row.size,
      row.current.toFixed(2),
      row.fabricYd.toFixed(2),
      materials(row).toFixed(2),
      row.laborMin,
      (ETSY_PCT * row.current + ETSY_FIXED).toFixed(2),
      profitPerHour(row, row.current).toFixed(2),
      row.rec.toFixed(2),
      profitPerHour(row, row.rec).toFixed(2),
      ...WAGES.map((w) => priceForWage(row, w).toFixed(2)),
    ].join(",")
  );
}

console.log(lines.join("\n"));

const avgImplied = ROWS.reduce((s, r) => s + impliedWage(r), 0) / ROWS.length;
console.error(`\nAvg profit/hr at CURRENT prices: $${avgImplied.toFixed(2)}/hr`);
console.error(`\n=== Profit per hour of making time, at RECOMMENDED prices (best use of her hands) ===`);
const ranked = [...ROWS].sort((a, b) => profitPerHour(b, b.rec) - profitPerHour(a, a.rec));
for (const r of ranked) {
  console.error(
    `  $${profitPerHour(r, r.rec).toFixed(0).padStart(3)}/hr   ${r.type} ${r.size}` +
      `  (${r.laborMin} min @ $${r.rec})`
  );
}
