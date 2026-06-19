# Banner Pricing — Deep Dive

_What should the banners actually be priced at? This builds each price from the ground up
(materials + shipping + labor + Etsy fees), checks it against the market, and reveals what Kristol
is really earning per hour today. Numbers come from `banner-cost-model.csv` (editable — change the
assumptions and re-run `scripts/cost-model.ts`)._

> **Read this caveat first.** I don't have Kristol's real fabric costs or her actual time per banner,
> so the materials and labor figures below are **researched estimates, flagged for her to confirm.**
> The *method* is what matters — plug her real numbers into the CSV and it recalculates. Even so, the
> core conclusion is robust to wide swings in the estimates (explained at the end).

---

## The one-line answer

**Kristol is underpaying herself.** Across the banners, today's prices pay her an average of
**~$9.79/hr** for her labor (after materials and Etsy fees) — and as little as **$3.23/hr** on the
Birthday bunting. The market sells comparable items for **2–3× her prices**, and her items **sell out
at a 5.7% conversion rate** — every signal says there's room to raise. Realistic, market-checked
targets are in the table at the bottom; the biggest, safest wins are **rag garlands** and the
**Birthday buntings**.

---

## 1. How the model is built

**Price floor = Materials + Labor + Etsy fees.** Anything below that loses money. Then a healthy
handmade price adds profit on top (the standard rule is _retail = (materials + labor) × 2–4_).

### Materials (per banner) — estimated unit costs
| Input | Assumed cost | Source / note |
|---|---|---|
| Quilting cotton | **$10 / yard** | Mid-range retail ($4–20 range; designer is more, scraps/sales less) |
| Cotton twill tape (pennant header) | $0.30 / yard | $0.16–0.75/yd depending on bulk |
| Twine / string (rag & bow garlands) | $0.15 / banner | |
| HTV lettering (Birthday only) | $0.60 / banner | |
| Thread / notions | $0.25 / banner | |
| Packaging (mailer + tissue + card) | $0.85 / order | |

Fabric used per banner is estimated from the listing sizes (e.g. a 6ft rag garland ≈ 0.85 yd of
strips; a 67" regular pennant ≈ 0.66 yd for 10 double-sided pennants). All editable in the script.

### Labor
Estimated **batched** minutes per banner (cutting several at once, chain-sewing) — e.g. ~52 min for a
6ft rag garland, ~75 min for a 10-pennant 67" bunting. **This is the figure most worth Kristol
correcting** — it drives everything.

### Shipping — handled separately (not in the item price)
A fabric garland is light (~3–6 oz). **USPS Ground Advantage 2026** is ~$5.90 (4 oz, near) rising to
~$7–9 for heavier/farther zones. Kristol already charges **$5.50** shipping on the site, which
roughly covers postage — so shipping is ~break-even and is **excluded from the item prices below.**
(If she switches to Etsy "free shipping," add ~$6 to every price to keep the same take-home.)

### Etsy fees
Built into every recommended price: **6.5% transaction + 3% processing + $0.25 + $0.20 listing ≈
9.5% + $0.45**. (If an order comes through Offsite Ads, add 15% — a reason to keep a margin cushion.)

---

## 2. What Kristol earns per hour right now

This is the gut-punch. Taking each current price, subtracting materials and Etsy fees, and dividing
the rest by the estimated labor time:

| Banner | Current price | **Earned per hour now** |
|---|---:|---:|
| Birthday pennant (73") | $15.00 | **$3.23/hr** 🚩 |
| Mini pennant 48" | $10.00 | $5.70/hr |
| Mini pennant 72" | $15.00 | $6.83/hr |
| Regular pennant 67" | $20.00 | $7.48/hr |
| Medium pennant 67" | $18.00 | $8.46/hr |
| Regular pennant 48" | $16.00 | $8.60/hr |
| Rag garland 6ft | $20.00 | $9.12/hr |
| Medium pennant 48" | $14.00 | $9.56/hr |
| Rag garland 5ft | $17.50 | $10.20/hr |
| Rag garland 4ft | $15.00 | $11.95/hr |
| Rag garland 3ft | $12.00 | $12.38/hr |
| Bow garland 70" | $25.00 | $14.44/hr |
| Bow garland 36" | $20.00 | **$19.35/hr** ✅ |

**Takeaways:**
- The **Birthday bunting ($3.23/hr)** is the single worst item — full-size 73" banner + HTV work for $15.
- **Pennant buntings** (regular/medium/mini) cluster at **$6–9/hr** — the most underpriced *category*.
- **Rag garlands** pay **$9–12/hr** — modestly low, but they're the bestsellers, so even small raises
  add up fast.
- The **bow garland** is the one item priced about right — the 36" already earns ~$19/hr. Good
  benchmark for what the others *should* feel like.

---

## 3. The market says there's room

| Product | Kristol now | Market comparables |
|---|---|---|
| Rag garland 4–6 ft | $15–20 | **$44–76** (modernragquilts, 4allseasons Star Seller) — denser/quilted, but shows the ceiling |
| Fabric pennant bunting | $14–20 | average **~$18**; larger double-sided cotton buntings commonly **$25–35** |
| Mini bunting | $10–15 | $12–20 |

Kristol sits at or **below the bottom** of every band — while running an **excellent 5.7% conversion
rate** and **selling out** of bestsellers. That combination (low price + high conversion + stockouts)
is the textbook signal that prices are too low.

---

## 4. Recommended prices (cost model **and** market, triangulated)

The model's "price to earn $20/hr" is the objective anchor; where that lands above what the market
pays (true for the big pennants), I pulled the recommendation **down to the realistic market** and
note it. Where the market is far above (rag garlands), the recommendation is a **measured step up**,
not the full jump — to protect that great conversion rate while you test.

| Banner | Now | **Recommended** | Earns ~$/hr at rec. | Market check |
|---|---:|---:|---:|---|
| **Rag garland 3 ft** | $12 | **$15** | ~$19 | far below market |
| **Rag garland 4 ft** | $15 | **$18** | ~$18 | far below market |
| **Rag garland 5 ft** | $17.50 | **$22** | ~$19 | far below market |
| **Rag garland 6 ft** | $20 | **$26** | ~$17 | still well below $44+ comps |
| **Regular pennant 48"** | $16 | **$20** | ~$13 | mid-market |
| **Regular pennant 67"** | $20 | **$28** | ~$15 | top of market (model wants $37; market won't bear it) |
| **Medium pennant 48"** | $14 | **$18** | ~$14 | mid-market |
| **Medium pennant 67"** | $18 | **$24** | ~$14 | upper-mid market |
| **Mini pennant 48"** | $10 | **$12** | ~$9 | budget tier — keep affordable entry point |
| **Mini pennant 72"** | $15 | **$20** | ~$12 | mid-market |
| **Bow garland 36"** | $20 | **$20** _(keep)_ | ~$19 | already right |
| **Bow garland 70"** | $25 | **$30** | ~$18 | room exists |
| **Birthday pennant 73"** | $15 | **$22** | ~$11 | aligns to your own regular line + recovers margin |

_"Earns ~$/hr at rec." uses the same estimated labor times — so even at the recommended prices, most
banners pay $13–19/hr, still modest for skilled handmade work. These are not aggressive numbers._

### If you only change three things
1. **Birthday buntings → $22** (from $15). Worst margin in the shop; no market risk at $22.
2. **Rag garlands → $15 / $18 / $22 / $26** (3/4/5/6 ft). Your bestsellers, and you're far under
   market — this is where the real money is.
3. **Largest pennants up ~$6–8** (regular 67" → $28, medium 67" → $24, mini 72" → $20). The big
   sizes are where the labor is and where today's pricing pays the least.

### How to roll it out safely
- Raise **ahead of each season** (6–8 weeks before), when demand and search traffic rise — increases
  stick better and you're not discounting into a climbing market.
- Change the **largest size first** and watch conversion for 1–2 weeks before moving the rest. Your
  stats already show the data to judge it.
- Keep one **affordable entry size** per product (the small mini at ~$12, small rag at $15) so
  budget shoppers still convert.

---

## 5. Why the conclusion holds even if my estimates are off

The recommendation ("raise, especially rag garlands and Birthday") survives big changes to the
guesses:
- **If fabric is cheaper than $10/yd** (scraps/sales) → margins are even thinner per *dollar of
  price*, so the underpricing case gets *stronger*, not weaker.
- **If Kristol is faster than estimated** → her hourly wage at current prices is higher, but the
  *market* comps ($44–76 rag garlands, $25–35 buntings) still sit far above her prices, so the raise
  is still justified — just framed as "matching the market" rather than "paying fair labor."
- **Only if she is BOTH much faster AND much cheaper on materials** would current prices be "fine" —
  and even then, the sell-outs and 5.7% conversion say she's leaving money on the table.

To make this exact, fill your **real** fabric cost and **real** minutes-per-banner into
`scripts/cost-model.ts` (the `ASSUMPTIONS` block and `ROWS` table) and re-run — the whole table
recalculates.

---

## Sources
- Fabric cost: [By the Yard — cost of quilting](https://bytheyardcomics.com/a-new-perspective-on-the-cost-of-quilting/) ·
  [fabric price guide](https://gardensgym.com/how-much-for-a-yard-of-fabric/)
- Shipping: [USPS Ground Advantage 2026 rates (ClickPost)](https://www.clickpost.ai/blog/usps-ground-advantage) ·
  [Parcelpath USPS 2026 rate chart](https://parcelpath.com/carrier-services/usps-shipping-rates/)
- Twill tape: [Walmart binding/twill tape](https://www.walmart.com/c/kp/binding-fabric)
- Pricing formula: [Craftybase — how to price handmade](https://craftybase.com/blog/how-to-price-handmade-items) ·
  [Made Urban pricing formula](https://www.madeurban.com/blog/how-to-price-a-handmade-product/)
- Market comps: [Etsy fabric rag garland](https://www.etsy.com/market/fabric_rag_garland) ·
  [Etsy fabric pennant banners](https://www.etsy.com/market/fabric_pennant_banners) (avg ≈ €16.51)
