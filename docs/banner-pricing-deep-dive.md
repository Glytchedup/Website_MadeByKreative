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

**Kristol's work is currently a real bargain — there's happy room to raise prices.** Today's prices
leave her about **~$9.79/hr** for her time after materials and Etsy fees (and only ~$3.23/hr on the
Birthday bunting). Since the market sells comparable items for **2–3× her prices** and hers **sell out
at a 5.7% conversion rate**, every signal says she can comfortably charge more and pay herself better.
This is good news, not bad. Realistic, market-checked targets are in the table at the bottom; the
biggest, easiest wins are the **rag garlands** and the **Birthday buntings**.

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
_Verified on the live Etsy shop (June 2026):_ banners charge **$4.99** shipping (mini banners
**$3.99**), **+$1 per additional item**; the **keychain ships free**. A light fabric garland costs
roughly **$5–6** to mail via USPS Ground Advantage (Etsy's discounted labels), so **$4.99 is about
break-even on a single banner** — slightly under on far zones and multi-item orders (the +$1
additional-item rate is too low). Because shipping roughly covers itself, it's **excluded from the
item prices below** (they're item-only). Two small fixes worth making: nudge banner shipping to
**$5.49–5.99** and the additional-item rate to **$2–3**. (True "free shipping" would mean baking
~$5–6 into every price — only worth it after the price increases below are in place.)

### Etsy fees
Built into every recommended price: **6.5% transaction + 3% processing + $0.25 + $0.20 listing ≈
9.5% + $0.45**. (If an order comes through Offsite Ads, add 15% — a reason to keep a margin cushion.)

---

## 2. What each banner earns per hour right now

This is where the opportunity shows up. Taking each current price, subtracting materials and Etsy
fees, and dividing the rest by the estimated labor time:

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
- The **Birthday bunting** has the most room — it's a full-size 73" banner with HTV lettering priced
  at $15, so a raise here is the easiest win of all.
- **Pennant buntings** (regular/medium/mini) sit around **$6–9/hr** — the category with the most
  headroom.
- **Rag garlands** earn **$9–12/hr** — they're already your bestsellers, so even a small, gentle raise
  adds up beautifully.
- The **bow garland** is priced just about right — the 36" already earns ~$19/hr. It's a lovely
  benchmark for where the others can comfortably head.

---

## 3. The market says there's room

| Product | Kristol now | Market comparables |
|---|---|---|
| Rag garland 4–6 ft | $15–20 | **$44–76** (modernragquilts, 4allseasons Star Seller) — denser/quilted, but shows the ceiling |
| Fabric pennant bunting | $14–20 | average **~$18**; larger double-sided cotton buntings commonly **$25–35** |
| Mini bunting | $10–15 | $12–20 |

Kristol sits at or **below the bottom** of every band — while running an **excellent 5.7% conversion
rate** and **selling out** of bestsellers. That combination (great value + high conversion + sell-outs)
is the textbook sign that customers happily pay more — a green light to raise with confidence.

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

### Where to spend your making hours (profit per hour at the new prices)

Because Kristol's **time is the real constraint** (handmade, no outsourcing), the smartest lens isn't
"what sells most" but "what pays best **per hour of making**." At the recommended prices, after fabric
and Etsy fees:

| Rank | Product | Profit / hour | Make-time |
|---|---|---:|---|
| 1 | Bow garland (36") | ~$19/hr | 40 min |
| 1 | Rag garland (3 ft) | ~$19/hr | 25 min |
| 1 | Bow garland (70") | ~$19/hr | 62 min |
| 4 | Rag garland (4 ft) | ~$17/hr | 32 min |
| 5 | Rag garland (5 ft) | ~$16/hr | 42 min |
| 6 | Rag garland (6 ft) | ~$15/hr | 52 min |
| 7 | Medium pennant (48"/67") | ~$14/hr | 45–62 min |
| 9 | Regular pennant (48"/67") | ~$13/hr | 55–75 min |
| 11 | Mini pennant (72") | ~$11/hr | 70 min |
| 12 | Birthday pennant (73") | ~$9/hr | 70 min |
| 13 | Mini pennant (48") | ~$8/hr | 50 min |

**The strategy writes itself:** the **rag garlands and bow garlands** are simultaneously her
**bestsellers** *and* her **highest profit-per-hour** — so making more of those is the single best use
of her time. The **mini pennants and Birthday banner** sit at the bottom even after raises; treat them
as **made-to-order**, simplify them, raise them further, or retire the weakest — don't sink stock-making
hours into them. And since she sells out, **chasing more traffic/ads adds little** — the lever is
profit per piece and per hour, not volume. (Time estimates are editable in `scripts/cost-model.ts`;
the full ranking prints when you run it.)

---

## 5. Why the conclusion holds even if my estimates are off

The takeaway ("there's room to raise, especially rag garlands and Birthday") holds up even if these
guesses are off:
- **If fabric is cheaper than $10/yd** (scraps/sales) → the value Kristol is offering is even better,
  so the case for a raise is *stronger*, not weaker.
- **If Kristol is faster than estimated** → she's earning a better hourly rate already (wonderful!),
  but the *market* comps ($44–76 rag garlands, $25–35 buntings) still sit well above her prices, so a
  raise still makes sense — just as "matching the market" rather than "paying fair labor."
- **Only if she's BOTH much faster AND much cheaper on materials** would today's prices already be
  spot-on — and even then, the sell-outs and 5.7% conversion suggest customers would happily pay a
  little more.

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
