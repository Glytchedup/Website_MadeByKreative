# Changelog

All significant decisions and build steps for the MadeByKreative storefront. Entries note
where judgment was exercised and why.

## [0.5.1] — Independent (Codex) review round: 4 fixes + preventative hardening

An independent adversarial review (Codex) of the `[0.5.0]` changes surfaced four issues. A first
fix pass closed two and **only partially** closed the other two; a second Codex pass caught the
gaps, which were then reworked and **re-confirmed RESOLVED with no new issues**. `next build` clean
(17 routes); `npm run smoke` → **23/23** (added concurrent-`releaseOrder` + strict-CAS cases).

- **(HIGH) Webhook revival is now atomic** (`api/stripe/webhook`). The revive-a-cancelled-order
  path previously marked the order `paid` and *then* re-reserved stock in a loop outside any
  transaction — a crash in between left a paid-but-unreserved order, and a Stripe retry skipped the
  reserve. Now the claim (`cancelled`→`paid`) **and** all re-reserve / `forceDecrement` /
  `oversellFlag` writes commit in **one transaction**; email/Etsy-push/oversell-alert fire only
  after commit. Crash-safe and idempotent against duplicate deliveries.
- **(HIGH) Receipt polling fetches the COMPLETE set** (`etsy/sync` + `etsy/client`).
  `getShopReceipts` gained an `offset`; `fetchAllReceiptsSince()` pages (size 100) until the source
  is naturally exhausted, for both the first-run baseline and normal polling. Previously only the
  first page was read, so >100 sales between polls — or an **established shop's** first connect —
  silently dropped everything past it. *(First fix attempt kept a page cap that truncated and still
  advanced the cursor — the same bug in disguise; Codex caught it.)* The cap is now a pure
  infinite-loop backstop that **throws** (`ReceiptPageGuardError`) so the cursor is left unadvanced
  and the next poll retries — fail-loud, never silent-drop. Because the full set is fetched, the
  cursor advance is safe regardless of Etsy's result ordering (no reliance on an unconfirmed
  `sort_on` param).
- **(MEDIUM) Conflict "use Etsy qty" is race-safe** (`inventory` + `admin/actions`). It re-queries
  the **live** Etsy quantity at resolution time (the stored `etsyQty` snapshot could resurrect a
  since-sold item), AND — the part the first attempt missed — guards the write: `setStock` gained an
  `opts.expectedCurrent` **strict compare-and-swap** that throws `StockChangedError` if a sale slips
  in between the observation and the commit, rolling back the whole resolution (conflict stays open)
  rather than resurrecting a unit. Preventative: a single shared `liveEtsyQuantitySafe` /
  `fetchLiveEtsyQuantity` helper now backs reconcile, the JIT guard, and conflict resolution
  (removing three copies of the same fetch that could drift).
- **(LOW) Concurrent polls no longer abort on a unique-key clash** (`etsy/sync`). If two polls race
  the same new receipt, the loser's `ProcessedEtsyReceipt` insert now fails with P2002, which is
  caught and treated as already-processed (skip + continue) instead of throwing out of the whole
  poll. Safe because Postgres blocks the second insert until the first txn commits, so the receipt
  is genuinely applied by then.
- **Preventative: `ProcessedStripeEvent` idempotency table** (new model + `api/stripe/webhook`).
  Defense-in-depth fast-path + audit log keyed on Stripe `event.id`. Written **after** successful
  processing (a duplicate/redelivery is skipped up front; a crash mid-handler safely re-runs, since
  the handlers are already idempotent) — deliberately *not* record-before, which would risk an
  at-most-once hole. Applied to the DB via `prisma db push`.

## [0.5.0] — Phase 0 launch audit + four inventory/sync correctness fixes

- **`AUDIT.md`**: full Phase-0 launch-readiness audit (8 dimensions, adversarially verified;
  4 plausible-but-wrong findings refuted) with a 35-row prioritized punch list and a 7-item
  human-gate checklist. Verdict: engine is launch-ready; remaining work is prod config +
  legal/policy content + a few robustness fixes. No launch blocker is an architecture defect.
- Implemented the four highest-risk **reversible** correctness fixes from the audit:
  1. **Unmapped Etsy receipt no longer loses its decrement** (`etsy/sync.ts`). A receipt is now
     applied **all-or-nothing**: an unmapped transaction throws `UnmappedReceiptError`, rolling
     back the whole receipt (including the `ProcessedEtsyReceipt` row), and the poll cursor is
     **not advanced past it** (`cursor = min(maxTs, earliestUnmapped-1)`), so it retries once the
     listing↔variant mapping exists. Previously the receipt was marked processed and the sale was
     silently dropped — defeating oversell prevention during the first-import window.
  2. **Oversell detection now alerts the maker** (`etsy/sync.ts` + `email.ts`). When a receipt
     drives stock negative, the affected order's `oversellFlag` is set and `sendOversellAlert`
     fires (previously dead code — the flag was never set and the email never called). Alerts are
     sent after the DB txn; oversells from a rolled-back receipt are not alerted.
  3. **Stale-order sweeper** (new `lib/orders.ts`; wired into the cron). Abandoned checkouts
     (stock is reserved *before* payment) are released after 40 min (30-min Stripe expiry + 10
     buffer) as a backstop for a missed `checkout.session.expired` webhook — previously such an
     order locked a one-of-a-few unit out of stock on both channels forever. `releaseOrder` now
     **atomically claims** the order (`updateMany where status='pending'`) so the webhook and the
     sweeper can't double-restock; the webhook was refactored to share it. The sweep runs in the
     cron **before** `runFullSync` and independent of Etsy connectivity.
  4. **`setStock()` is now atomic** (`lib/inventory.ts`). Replaced the read-then-write (TOCTOU)
     with a compare-and-swap loop inside a transaction (`updateMany where quantity = expected`,
     re-read + retry on contention). An admin count-correction racing a customer reserve can no
     longer clobber the decrement and silently restore a sold unit. `resolveConflict` now wraps
     its claim + stock change in **one transaction** (same root cause): if `setStock` throws, the
     "resolved" status rolls back too, so the conflict stays open and is safely retryable.
- **Review-driven hardening:** a multi-agent adversarial review of the four fixes confirmed two
  self-introduced regressions, both fixed and re-verified:
  - The abandon-sweeper could cancel an order whose `checkout.session.completed` webhook was
    delayed past the buffer, leaving a *paid* order marked cancelled (and its stock wrongly
    restocked). The webhook now finalizes via a conditional update that detects the exact prior
    state: a normal `pending` order, or a sweeper-cancelled one it **revives and re-reserves** —
    flagging an oversell + alerting the maker if a unit sold elsewhere in the gap. Fully
    idempotent against Stripe's duplicate/retried events.
  - `resolveConflict` previously marked the conflict resolved *before* applying `setStock`
    (fixed by the single-transaction wrap above). The unmapped-receipt and oversell-alert fixes
    were reviewed clean (the unmapped-receipt cursor stall on a permanently-unmappable receipt is
    the intended retry-until-mapped behavior).
- **Tests:** added 3 smoke cases — concurrent `setStock` vs reserves keeps the ledger invariant,
  `forceDecrement` past zero reports `wentNegative` with the invariant intact, and a multi-item
  order rolls back fully when one line is short. `npm run smoke` → **15/15 pass**; `next build`
  clean (17 routes).

## [0.4.6] — Phone-friendly guide + interactive profit calculator

- `docs/kristol-guide.html`: a **single self-contained, mobile-responsive** page (no app/account, works
  offline) generated from `RECOMMENDATIONS.md` via `scripts/build-guide.sh` (pandoc + a head include
  for mobile CSS and an after-body include for the widget).
- Built-in **profit calculator**: pick a banner, type real fabric $/yd + minutes + price, and it shows
  materials, Etsy fees, "you keep," and **profit per hour** (color-coded) plus the price needed to
  earn $20/hr. Verified in a 390px viewport: bow 36" → $19/hr (green), mini 48" → $8/hr (flagged).
- Sources: `scripts/guide-head.html`, `scripts/guide-calculator.html`.
- **Hosted** at `website-madebykreative.vercel.app/guide.html` (copied into `public/` by
  `build-guide.sh`) so Kristol can open it from a phone link.

## [0.4.5] — Reframe strategy around profit-per-hour (time is the constraint)

- Kristol makes everything by hand and won't outsource, so her **time is the real limit**, not demand.
  Reframed the advice from volume/traffic toward **profit per piece and per hour of making**.
- `scripts/cost-model.ts` now computes **profit-per-hour at the recommended prices** and prints a
  ranking; `banner-cost-model.csv` gained "Profit/hr now" + "Profit/hr at recommended" columns.
  Finding: rag garlands & bow garlands are her **best $/hr (~$15–19) AND bestsellers**; mini pennants
  and the Birthday banner are time-sinks (~$8–11) even after raises.
- Added "Make your time count" to `RECOMMENDATIONS.md` (what to sew more of, what to make-to-order/
  simplify/retire, batch-to-save-time, and don't pay for volume you can't fulfill) and a profit-per-
  hour ranking + strategy to `banner-pricing-deep-dive.md`. Reframed the optimization doc's
  "constraints" from traffic/stock to making-time/profit-per-hour.

## [0.4.4] — Fact-check vs live Etsy: shipping, seasonality, fix offer advice

- **Verified shipping against the live shop** (API shipping-profiles + Playwright). Banners charge
  **$4.99** (mini $3.99, +$1/additional); **only the keychain is free shipping** — banners are NOT
  free. Postage ≈ $5–6, so $4.99 ~break-even (slightly under on far/multi-item). Added a "shipping
  fact-check" to `RECOMMENDATIONS.md` and corrected the deep-dive + optimization docs (which had
  wrongly assumed free shipping / $5.50). Verified processing time = **1 day**.
- **Seasonality:** advice is now date-aware (June 2026 → prep **Fall/Halloween**; don't restock
  St. Patrick's until Jan–Feb; patriotic just sold out → make extra *next spring*). Calendar marked
  "you are here." Removed the "restock St. Pat's now" to-do.
- **Fixed counterintuitive offer advice:** dropped the "turn on abandoned-cart / favorited-item
  offers" recommendation — they're discounts, pointless on items that already sell out. Reframed
  toward supply + email list, scoped offers to genuinely slow listings only. Kept everything
  novice-appropriate.
- client.ts: added `getShopShippingProfiles` / `getListingRaw`; `scripts/etsy-shipping-check.ts`.
  `npx tsc --noEmit` passes.

## [0.4.3] — Roll pricing into checklist + competitor comparison

- Folded the banner deep-dive targets into `RECOMMENDATIONS.md` (+ PDF) so Kristol has one
  consolidated to-do: recommended new prices per banner type/size, "if you only do three things,"
  and a safe roll-out plan.
- Added a **"How your prices compare on Etsy"** section: verified comps (rag-garland shops $44–76),
  typical ranges, and clickable live Etsy search links per product type so she can compare current
  competitor prices herself (Etsy blocks bulk price scraping, so live browse links are the reliable
  comparison tool).

## [0.4.2] — Banner pricing deep dive (bottom-up cost model)

- `docs/banner-pricing-deep-dive.md` (+ PDF) and `docs/banner-cost-model.csv` (from
  `scripts/cost-model.ts`): builds each banner's price from estimated materials + labor + shipping +
  Etsy fees, cross-checks against market comps, and reverse-engineers the hourly wage Kristol earns
  at current prices. Finding: avg **~$9.79/hr** (Birthday bunting just $3.23/hr; bow garland ~$19/hr
  is the one well-priced item). Market comps run 2–3× her prices. Recommended measured increases —
  biggest/safest wins are rag garlands and the Birthday buntings. All assumptions are flagged
  estimates and editable in the script (real fabric cost + minutes-per-banner → recalculates).

## [0.4.1] — Fix per-size price flattening (website undercharge)

- **Bug:** the content sync stored every variant at the listing's *base* (lowest) price, so all sizes
  showed one price. Etsy actually prices each size offering separately, so the storefront
  **undercharged** for larger sizes (e.g. a 6ft rag garland sold for $15 instead of $20). The earlier
  "flat pricing is the #1 problem" finding was an artifact of this bug, not Kristol's real pricing.
- **Fix:** `EtsyInventory.offerings[]` now carries `price`; `syncContentFromEtsy` reads each
  offering's price for the variant on import **and** refreshes variant prices on every content sync;
  `basePriceCents` = lowest offering. One-off `scripts/fix-variant-prices.ts` repaired the 20
  mispriced variants from live Etsy data (`scripts/etsy-real-prices.ts` audits real vs stored).
- **Docs corrected:** `etsy-optimization.md` / `RECOMMENDATIONS.md` / CSV / PDF now reflect that
  prices are already tiered; real remaining opportunity is small (keychain $8→$12; Birthday banners
  $15→$20; a few optional large-size bumps). `npx tsc --noEmit` passes.

## [0.4.0] — Pricing/SEO optimization + content fixes

- **Etsy optimization report** (`docs/etsy-optimization.md`) + a reproducible per-variant pricing &
  margin model (`docs/etsy-pricing-model.csv`, generated by `scripts/pricing-model.ts` from
  `scripts/export-catalog.ts`). Grounded in real Etsy Shop Manager stats pulled 2026-06-18:
  YTD 2,620 visits / 149 orders / **5.7% conversion** / $2,913 revenue. Key finding: patriotic/4th
  of July items are ~70% of revenue and all sold out (and absent from the site since they'd ended on
  Etsy at sync time); the shabby rag garland is the hero form across seasons; conversion is well
  above the Etsy norm, so traffic + in-stock inventory are the real constraints. Top pricing lever:
  every multi-size listing is priced flat regardless of size — tiering lifts avg ~$3.10/item.
- **HTML-entity decode on Etsy import.** Etsy's API returns HTML-encoded text ("St. Patrick&#39;s");
  added `src/lib/html.ts` (`decodeEntities`) and applied it to title/description/tags in
  `syncContentFromEtsy` (both create + update paths) so future syncs store clean text.
- **One-off backfill** (`scripts/backfill-seo.ts`): decoded the 4 already-affected products and set
  concise, keyword-rich `seoTitle`/`seoDescription` on all 16 (consumed by the product-page
  metadata; not overwritten by content sync). `npx tsc --noEmit` passes.

## [0.3.0] — Deploy to Vercel (free) on Neon Postgres

- **Database → Postgres (Neon).** Switched the Prisma provider from sqlite to postgresql
  (SQLite can't persist on Vercel's serverless filesystem). Added `directUrl` so migrations
  use the unpooled connection while runtime uses the pooled (pgbouncer) one. Local dev now
  also uses the same Neon DB.
- **Decision:** local + prod share one Neon database for this test deploy — simplest, and it
  means a local sync populates production. Re-ran Etsy OAuth + content sync against Neon
  (16 products / 41 variants / receipts baselined).
- **Cron → daily.** Vercel's free (Hobby) plan caps cron at once/day, so the Etsy poll
  schedule changed from every-3-min to `0 8 * * *`. Real-time protection at checkout is
  unaffected (the just-in-time oversell guard still runs live); use admin "Sync now" for
  on-demand syncs, or upgrade/host elsewhere for frequent polling.
- Stripe stays in **test mode** in production; a production webhook (dashboard → live URL)
  replaces the local Stripe CLI listener.

## [0.2.0] — New storefront design (the "shell")

Adopted the provided MadeByKreative design shell as the homepage and wired it to live data.

- **`lib/catalog.ts`** maps our DB (Etsy-synced products/collections/variants) into the
  shell's feed shape: `{ shop, seasonOrder, products[] }` with season (collection), inferred
  `type` (pennant/rag/bow/keychain), price, total stock (for scarcity badges), images, tags,
  sizes (variant labels), and per-variant ids so Add-to-cart targets the right variant.
- **`components/storefront/Storefront.tsx`** ports the full design (hero with swaying bunting,
  trust strip, new arrivals, shop-by-season, featured grid + season filter, custom-banner
  tool, maker's story, reviews, footer, product modal) as a client component. Fonts
  (Newsreader / Hanken Grotesk / Caveat) loaded in the layout `<head>`.
- **Decision:** "Add to cart" wires to our real `CartProvider` + on-site Stripe checkout
  (keeping customers on-site — the whole point), NOT the prototype's Etsy links. The Etsy
  "View full listing" remains as a secondary CTA in the modal; the custom-banner CTA points
  to our /contact. The prototype's `support.js`/DCLogic runtime is not used.
- **Decision:** the design is a one-page storefront with its own header/footer, so inner
  pages (shop, cart, about, policies, contact, collections, products, checkout) moved into a
  `(site)` route group whose layout supplies the existing Header/Footer; the homepage renders
  the full design standalone. URLs are unchanged.
- **Assumptions (placeholders):** maker portrait is a styled placeholder block (no photo
  yet); reviews are 3 representative quotes; custom-banner price estimate uses simple
  style/length math. Verified: Add-to-cart increments the real cart (0→1), build passes,
  all routes 200.

## [0.1.2] — Full content sync: collections + auto-archive

Made Etsy → site content sync truly complete so new products and photos flow in
automatically and land in the right place:

- **Etsy sections → site collections.** `syncContentFromEtsy` now mirrors the shop's
  Etsy sections into Collections (`getShopSections`, new `syncCollectionsFromEtsy`),
  matching on `etsySectionId` and creating new collections as sections appear. Every
  imported (and future) listing is auto-categorized from its `shop_section_id`. Result:
  13/16 products categorized (the other 3 are unsectioned on Etsy itself).
- **Auto-archive removed listings.** Products whose Etsy listing is no longer in the
  active set are set `status=archived` (hidden from the storefront) rather than deleted,
  preserving their inventory ledger; reactivating on Etsy un-archives them.
- Photos already imported correctly (full-res `i.etsystatic.com` URLs via next/image).
- One-time cleanup: removed the 9 leftover empty seed collections.

## [0.1.1] — Live Etsy integration (first real connect)

Connected the real MadeByKreative Etsy shop (shop_id 23502696) end to end and fixed
three issues found only against the live API:

- **Etsy `x-api-key` format.** The live API rejects the bare keystring with
  *"Shared secret is required in x-api-key header."* — it requires the combined value
  `keystring:shared_secret`. Fixed in `src/lib/etsy/client.ts` (`apiKeyHeader()`). OAuth
  token exchange still uses the bare keystring as `client_id`.
- **First-run receipt baseline.** Imported quantities already reflect all past Etsy sales,
  so the initial receipt poll must NOT decrement for historical receipts (that would
  double-count). `pollEtsyReceipts` now detects the first run, marks recent receipts as
  processed, sets the cursor forward, and decrements nothing. Verified: 50 historical
  receipts baselined, 0 erroneous decrements; site qty matched Etsy on all 41 variants.
- **Transaction timeout.** Per-receipt `$transaction` now uses `{ timeout: 15000 }` (SQLite
  was hitting the 5s default). Manual "Sync now" forces a content import; the cron stays
  inventory-only and content refresh is throttled to ≤1×/hour to respect Etsy's call budget.

Also: removed the 17 isSeed sample products now that the 16 real listings are imported.

## [0.1.0] — Initial autonomous build

### Foundation
- Scaffolded Next.js 15 (App Router) + TypeScript + Tailwind + Prisma.
- **Decision:** SQLite for dev, Postgres for prod (one-line provider switch). Rationale:
  zero-config clean-clone startup; the DB is the inventory source of truth so it must be
  trivial to stand up locally.
- **Decision:** Tailwind v3 (not v4) and CSS-variable font stacks instead of `next/font`.
  Rationale: avoid a build-time Google Fonts download so `npm run build` works offline.
- **Assumption (PLACEHOLDER):** brand palette (terracotta/sage/cream) in
  `tailwind.config.ts`. Flagged for Kristol to confirm.

### Inventory ledger (core architecture)
- `Variant.quantity` is the single authoritative count; all mutations go through
  `src/lib/inventory.ts`, which writes an append-only `LedgerEntry` audit row.
- **Atomic guarded decrement** via `updateMany … where quantity >= n` — no read-then-write
  race. `forceDecrement` (allows negative) for after-the-fact Etsy sales; `addStock`,
  `setStock` for restocks/corrections.
- **Decision:** reserve stock **at checkout** (inside the order transaction), not at payment
  capture. Rationale: for 1-of-a-few handmade items, briefly holding stock during a 30-min
  checkout window is far safer than risking an oversell; abandoned/expired sessions are
  auto-released via the Stripe webhook.

### Etsy integration
- `src/lib/etsy/client.ts`: Etsy Open API v3 client — OAuth 2.0 **PKCE**, token refresh with
  60s margin, exponential backoff on 429/5xx, endpoints for listings/inventory/receipts.
- `src/lib/etsy/sync.ts`: content import (Etsy→Site one-way), idempotent receipt polling
  (keyed on `receipt_id`), restock-vs-sale reconciliation, JIT live-quantity oversell guard,
  and a push queue (Site→Etsy).
- **Decision:** content is one-way (Etsy→Site), inventory is two-way. Rationale: keeps Etsy
  as Kristol's familiar editing surface while still preventing cross-channel oversell.
- **Decision:** receipt polling order — `runFullSync` polls receipts *before* reconciling,
  so a sale (qty drop) isn't misclassified as a restock.
- **Decision:** the JIT guard **fails open** if Etsy is unreachable. Rationale: a flaky Etsy
  API should not block every checkout; the atomic ledger decrement is still the primary
  protection, and any true oversell is caught and flagged afterward.
- **Decision:** conflicts (`qty_mismatch`, `oversell`, unmapped listing) are surfaced in
  admin and never auto-resolved — matches the "never silently overwrite" requirement.
- **Assumption:** poll interval 150s and low-stock threshold 3 (env-tunable).

### Storefront
- Pages: home, shop (filter/sort + scarcity cues), collections + per-collection,
  product detail (gallery, variant selector, live stock, cross-sell), cart, about (mask
  origin story), policies (editable), contact, checkout success/cancelled, 404.
- SEO: per-page metadata, OpenGraph, JSON-LD (`Store`, `Product`/`AggregateOffer`/`Review`),
  dynamic `sitemap.xml`, `robots.txt`. Etsy keyword patterns carried into seed tags.
- Accessibility: skip link, visible focus states, labeled controls, semantic landmarks, alt
  text, `next/image` optimization.
- **Assumption (PLACEHOLDER):** "Ships in 1–3 business days" turnaround and reviews count
  (5.0★/227) from the brief; flagged in UI/About for confirmation.

### Cart & checkout
- Client cart (localStorage) with stock-capped quantities; Stripe Checkout session with
  US/CA shipping address collection and a flat shipping rate.
- **Assumption (PLACEHOLDER):** flat shipping $5.50, editable in admin Settings
  (`shipping_flat_cents`). Flagged for Kristol to set real rates.
- Order confirmation + maker oversell-alert emails (Resend; console fallback when unset).

### Admin (for a non-technical maker)
- HMAC-cookie auth, plain-language UI. Dashboard (KPIs + connection state), Products &
  inventory (CRUD, restock/set-count, per-variant ledger view), Orders (with oversell
  flags), **Etsy sync dashboard** (connect, sync-now, last-sync times, ledger-vs-Etsy table,
  pending pushes, conflict resolution, activity log), Settings (shipping + policies).
- **Decision:** custom HMAC-cookie auth instead of NextAuth/Clerk. Rationale: single trusted
  operator; no external dependency or signup. Documented as swappable.

### Data, docs, verification
- Seeded 9 collections + 17 sample products (price $8–$20, low counts, `isSeed=true`),
  matching the live shop's product range. Initial ledger rows written so the audit invariant
  holds.
- `scripts/smoke-test.ts` verifies atomic decrement, oversell rejection, restock, ledger
  invariant, and a **5-way concurrency race** (exactly one reserve wins, never oversells) —
  **all passing**.
- `npm run build` passes (full typecheck, 17 routes). Runtime check: storefront 200, admin
  307→login, checkout 503 graceful in preview mode, product pages 200.
- Wrote `README.md` (non-developer setup walkthroughs), `CLAUDE.md` (architecture),
  `.env.example` (all secrets), `vercel.json` (3-min sync cron).

### Fixes during build
- Fixed a TypeScript generic-spread inference issue in `src/lib/products.ts` (`images`
  stayed typed as `string` after the JSON parse) by using concrete Prisma types in
  `decorate()`.
- Switched `db:seed`/`smoke`/`etsy:sync` scripts to `tsx --env-file=.env` so `DATABASE_URL`
  loads when run outside the Prisma CLI.
