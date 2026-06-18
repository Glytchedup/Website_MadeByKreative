# Changelog

All significant decisions and build steps for the MadeByKreative storefront. Entries note
where judgment was exercised and why.

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
