# CLAUDE.md — architecture & operations guide

Context for anyone (human or AI) working on this codebase. Keep it current.

## What this is
A direct-to-customer storefront for **MadeByKreative** (Kristol, Gilbert AZ) selling
handmade fabric goods, designed to run **alongside her established Etsy shop** with
**two-way inventory sync**. The defining constraint: items are physically handmade in
low counts (often 1–3), not made-to-order, so **overselling across channels is the failure
mode the whole design exists to prevent.**

## Stack & rationale
- **Next.js 15 (App Router) + TypeScript** — one framework for storefront, admin, and API
  routes; server components keep stock reads fresh; easy Vercel deploy.
- **Tailwind CSS** — fast, consistent, warm craft aesthetic. Brand colors in
  `tailwind.config.ts` are PLACEHOLDERS to confirm with Kristol.
- **Prisma + SQLite (dev) / Postgres (prod)** — the DB *is* the inventory source of truth;
  switching providers is a one-line schema change, no app code changes.
- **Stripe Checkout** — PCI handled by Stripe; cards/Apple Pay/Google Pay/Klarna; no card
  data touches the app.
- **Resend** — transactional order emails + newsletter capture; logs to console when unset.
- **Custom HMAC-cookie admin auth** — single trusted operator, zero extra dependencies.

Every integration **degrades gracefully**: with no Stripe/Etsy/email keys the store still
fully runs (browse, admin, inventory), and the sync dashboard shows a clear "not connected"
state.

## Inventory architecture (the core)

### Source of truth
`Variant.quantity` is the **single authoritative count**. Each channel's availability is a
projection of it. **All mutations go through `src/lib/inventory.ts`** so every change is
atomic and writes an append-only `LedgerEntry` audit row. Feature code must never write
`Variant.quantity` directly.

### The atomic guard
`tryReserve()` uses `prisma.variant.updateMany({ where: { id, quantity: { gte: n } }, data:
{ quantity: { decrement: n } } })`. This compiles to a single
`UPDATE … SET quantity = quantity - n WHERE id = ? AND quantity >= ?` — atomic at the row
level, **no read-then-write race**. `count === 0` ⇒ insufficient stock, nothing changed.
The smoke test fires 5 concurrent reserves at a 1-stock item and asserts exactly one wins.

### Two data flows
- **Content** (`syncContentFromEtsy`): Etsy → Site only. Mirrors title/description/photos/
  price/tags; maps Etsy `shop_section_id` → our `Collection.etsySectionId`. On first import
  it seeds the ledger (`initial`); afterwards it touches content only, never quantity.
- **Inventory**: two-way, reconciled through the ledger.

### Inventory mechanisms (`src/lib/etsy/sync.ts`)
1. **Site sale → Etsy** (`/api/checkout`): JIT guard → `tryReserve` inside the order
   transaction → on success, `queueEtsyPush(newQty)`. On failure, abort before charging.
   Reserved stock is released (`addStock`) if the Stripe session expires/fails (webhook).
2. **Etsy sale → Site** (`pollEtsyReceipts`): polls receipts since a cursor
   (`lastReceiptCreatedTs`); each receipt is applied inside a transaction that *first*
   writes a `ProcessedEtsyReceipt` row (PK = `receipt_id`) — the idempotency guard, so
   re-polling and concurrent polls can't double-decrement. Uses `forceDecrement` (allows
   negative) so reality is recorded even past zero; negative ⇒ `oversell` conflict.
3. **JIT oversell guard** (`jitEtsyStockOk`): for low-stock variants, re-queries Etsy's live
   quantity right before charge. Blocks if gone. **Fails open** if Etsy is unreachable (the
   atomic ledger decrement remains the primary protection — a flaky API shouldn't halt all
   sales).
4. **Reconciliation** (`reconcileInventory`): compares live Etsy qty to `etsyLastSeenQty`.
   *Rose* ⇒ restock (`addStock`, reason `manual_restock`). *Dropped* ⇒ a sale already
   handled by receipts (just re-sync the marker — do NOT decrement again). Residual
   unexplained divergence ⇒ a `qty_mismatch` conflict for the maker. **Order matters:**
   `runFullSync` polls receipts *before* reconciling, so a sale isn't misread as a restock.
5. **Push queue** (`processPushQueue` / `EtsyPush`): writes the authoritative qty to Etsy;
   newest push supersedes older pending ones for the same variant.

### Resilience
Token refresh with a 60s safety margin; exponential backoff on 429/5xx (`etsyFetch`);
idempotent receipt writes; structured `SyncLog` rows; conflicts never auto-resolve.

## Order lifecycle
`/api/checkout` creates a `pending` order + reserves stock atomically + creates the Stripe
session (30-min expiry) with `orderId` in metadata. The webhook
(`/api/stripe/webhook`): `checkout.session.completed` → mark `paid`, capture
email/address, send confirmation, re-confirm Etsy push. `expired`/`async_payment_failed` →
`releaseOrder` restocks the reserved units and cancels the order.

## Auth
`src/lib/auth.ts` — signed (HMAC-SHA256, timing-safe) httpOnly cookie. `requireAdmin()`
(`src/lib/admin.ts`) gates every page under `src/app/admin/(dash)/` and all server actions.
`/admin/login` sits outside that route group. Cron endpoint accepts the admin session OR a
`CRON_SECRET` bearer / Vercel cron header.

## Data model notes
- `Variant` is the inventory unit; single-option products get a `Default` variant. Etsy
  mapping fields: `etsyListingId` / `etsyProductId` / `etsyOfferingId` + `etsyLastSeenQty`.
- `LedgerEntry` is append-only; invariant: `sum(delta) == Variant.quantity` (smoke-tested).
- Singletons (`id = "singleton"`): `EtsyToken`, `EtsySyncState`.
- `images`/`tags` are JSON strings (SQLite has no array type); parsed in `src/lib/products.ts`.

## Where judgment was exercised
See `CHANGELOG.md` — every assumption (shipping rate, turnaround, brand colors, auth
approach, reserve-at-checkout vs at-payment, JIT fail-open) is logged there with reasoning.

## Verifying
- `npm run smoke` — atomic decrement, oversell rejection, restock, ledger invariant, and a
  5-way concurrency race (exactly one wins, never oversells).
- `npm run build` — full typecheck + production build (passing; 17 routes).
- Manual: server returns 200 on storefront routes, 307 (→ login) on `/admin`, and a graceful
  503 from `/api/checkout` when Stripe is unconfigured.

## Known limitations & next steps
- **Etsy variation mapping** is implemented at the offering level but real listings with
  multiple variations may need the maker to confirm the variant↔offering mapping after the
  first import. Listings with a single offering sync fully automatically.
- **Live Etsy API not exercised end-to-end** here (no real credentials in this build). The
  client, OAuth, polling, reconciliation and push logic are complete and structured against
  Etsy Open API v3; validate against a real shop in staging before go-live.
- **Admin chrome**: admin pages currently render inside the storefront header/footer (shared
  root layout). Cosmetic only; could be split into a separate layout.
- **No product image upload UI** yet — products take image URLs (paste Etsy CDN URLs or host
  your own). Add an uploader (e.g. Vercel Blob/S3) as a next step.
- **Reviews** are represented via aggregate JSON-LD (5.0★/227) carried from Etsy; a native
  review system could be added later.
- **Tests**: the smoke test covers inventory; add unit tests around `reconcileInventory`
  edge cases and a Stripe webhook integration test before scaling.
- Switch `DATABASE_URL` to Postgres and run migrations before production (see README).
