# AUDIT.md — MadeByKreative Storefront (Phase 0)

> Phase 0 deliverable per `MADEBYKREATIVE_LAUNCH_BRIEF.md`. No code was changed to produce this audit.
> Findings below are adversarially verified: claims were checked against source, the database, and `CHANGELOG.md`; refuted items are explicitly noted so they are not re-litigated downstream.

---

## 1. Executive summary

The codebase is **architecturally strong and largely launch-ready in its engine**, but it is **not yet launch-ready as a live, public store**. The hard, customer-money/safety-critical paths — atomic inventory reservation, Stripe Checkout, the order state machine, and the Etsy sync design (OAuth, idempotent receipt polling, reconcile-after-receipts, push supersession) — are genuinely well built and, for inventory, proven by a 5-way concurrency smoke test. What stands between this and go-live is almost entirely **(a) one-time production configuration** (live Stripe keys + live webhook secret, real Etsy OAuth connect, production URL/domain, admin password, Resend email), **(b) required customer-facing content** (Privacy + Terms pages do not exist; shipping/returns/FAQ and About still render literal `(Placeholder...)` text), and **(c) a small set of real but non-blocking robustness fixes** (no refund path, an unmapped-Etsy-receipt decrement that is lost, `setStock()` TOCTOU, no stale-order sweeper).

The single biggest *risk to the project's stated mission* (never oversell handmade one-offs) is that **none of the Etsy two-way sync has been exercised against a live shop**, and the oversell **maker-alert email path is dead code** (`sendOversellAlert` is never called). Neither breaks the primary atomic protection, but both must be closed before relying on automation. Several auditor claims were **refuted** during verification (seed products/collections already removed from the DB; `ADMIN_SESSION_SECRET` already strong; `etsyLastSeenQty` NULL self-corrects) — see each dimension.

**Overall readiness: major-gaps — engine ready, launch config + legal content + a few robustness fixes outstanding. No hard blocker is a code-architecture defect.**

| Dimension | Readiness | One-liner |
|---|---|---|
| Stack & versions / deploy | Ready (deploy needs one step) | Modern, pinned, strict TS; only gap is no schema-apply step in the deploy pipeline and no Node pin. |
| Etsy integration | Major gaps (untested live) | Design is sound and verified in source, but never run against a real shop; one missed bug loses unmapped-receipt decrements. |
| Payments & order lifecycle | Major gaps | Sandbox flow solid; no refund/cancel path, no stale-order sweeper, dead oversell-alert; live keys are a human gate. |
| Inventory core (anti-oversell) | Ready (1 fix advised) | True atomic guard + concurrency-proven; only real defect is non-atomic `setStock()` (admin path), not the sales path. |
| Catalog & content state | Ready (content TODO) | Products/images/collections are real Etsy data; remaining work is the maker entering policy/shipping/about copy. |
| Config & secrets | Major gaps (config) | Well-structured, degrades gracefully; needs prod env vars set in Vercel — several are launch-blocking config. |
| Legal & policy pages | Critical gaps | Privacy and Terms pages are entirely missing; placeholder policy copy is customer-visible. |
| a11y / perf / security | Minor gaps | Solid baseline; keyboard-inoperable featured product grid is the top fix; rest are hardening. |

---

## 2. Stack

- **Framework:** Next.js `^15.5.19` (App Router), React `19.0.0` + react-dom `19.0.0` (pinned).
- **Language:** TypeScript `5.7.3`; `tsconfig` is genuinely strict (`strict`, `noEmit`, `target ES2022`, `lib dom/esnext`, `bundler` resolution, `@/*` path alias).
- **Data:** Prisma + `@prisma/client` `6.3.1` (pinned). `schema.prisma` **already** uses `provider = "postgresql"` with a pooled `url` (`DATABASE_URL`) + `directUrl` (`DATABASE_URL_UNPOOLED`) — the CLAUDE.md note "switch DATABASE_URL to Postgres" is outdated; that switch is done.
- **Payments:** Stripe `17.5.0` (hosted Checkout). **Email:** Resend `4.1.2`. **Validation:** Zod `3.24.1`. **Styling:** Tailwind + autoprefixer (standard PostCSS).
- **Hosting/deploy target:** Vercel (cron in `vercel.json`, Neon Postgres). `next.config.mjs` sets three security headers and image `remotePatterns` for `i.etsystatic.com` / `**.etsystatic.com` / Unsplash.
- **Reproducibility:** `package-lock.json` present.

**Build / run / verify commands**

```bash
npm run dev      # local dev
npm run build    # "prisma generate && next build" (typecheck + prod build; 17 routes)
npm run start    # serve production build
npm run smoke    # inventory smoke test (atomic decrement, oversell reject, restock, ledger invariant, 5-way race)
npm run db:push  # apply schema to the DB (no migrations folder; db-push workflow)
npm run db:seed  # seed placeholders — DO NOT run against prod
```

**Deploy gaps (real, low/medium, not blockers):**
- **No schema-apply step in the deploy chain.** `package.json` build is `prisma generate && next build` only, and `prisma/` has **no migrations folder** (db-push workflow). A fresh prod DB gets **no tables** unless someone manually runs `prisma db push` against the prod `directUrl` before first traffic. Document this in the runbook or add a guarded release step.
- **No `engines.node` pin** and no `.nvmrc` — prod Node version is left to the Vercel default and can drift from dev (`@types/node` 22.x). Add `"engines": { "node": ">=20" }`.

---

## 3. Etsy integration

**What syncs / is built (verified in source):** OAuth2 with PKCE; token refresh with a 60s safety margin; exponential backoff on 429/5xx (`etsyFetch`, max 4 attempts); content sync Etsy→Site (title/description/photos/price/tags, `shop_section_id` → `Collection.etsySectionId`); two-way inventory via the ledger; idempotent receipt polling keyed on `receipt_id` (`ProcessedEtsyReceipt` PK written **first** in the txn); first-run baseline protection; reconcile-runs-after-receipts ordering; push-queue supersession; JIT fail-open guard. Multi-variant **listings** ARE handled — `syncContentFromEtsy` loops all `inv.products` and creates one `Variant` per Etsy product (`sync.ts:155-170`), and receipts match on `etsyProductId`.

**What is stubbed / unverified:**
- **(LAUNCH BLOCKER, human gate) Live Etsy API never exercised end-to-end.** CLAUDE.md:109-111 confirms "no real credentials in this build." Everything is structurally complete but unrun against a live shop. Connecting writes authoritative quantities to the maker's **live** listings → this is an irreversible-data gate.

**Gaps (verified):**
- **(HIGH — missed by original auditor) An unmapped receipt transaction is marked processed and its decrement is lost forever.** In `pollEtsyReceipts`, `ProcessedEtsyReceipt` is written first (`sync.ts:351-353`); if a transaction matches no variant it logs `receipt_unmapped` and `continue`s **without** decrementing (`sync.ts:363-372`), yet the receipt stays permanently processed. A real Etsy sale that happens before the variant mapping is confirmed is **never** applied, even after the mapping is fixed — directly defeating oversell prevention during the first-import window. **Fix:** don't fully mark a receipt processed if any transaction was unmapped (per-transaction tracking, or a `needs_attention` queue + `SyncConflict`).
- **(medium) Only `offerings[0]` is read within a single product** (`sync.ts:132,156,160,227,432,561`). Relevant only to the rare multiple-offerings-in-one-product case; common single-offering listings sync fully. Keep the CLAUDE.md note: maker confirms variant↔offering mapping after first import.
- **(medium) Failed Etsy pushes are never auto-retried** (`processPushQueue` selects only `pending`, sets `failed` on error). Mitigated: `etsyFetch` already retried transient 429/5xx, and a failed push does **not** update `etsyLastSeenQty`, so `reconcileInventory` later raises a `qty_mismatch` conflict — diverged state is **surfaced, not silent**. **Fix:** bounded re-queue while `attempts < N`.
- **(medium) Receipt polling is single-page (limit 50), no pagination.** If >50 paid receipts accrue between polls, some can be skipped depending on Etsy's sort order. Low likelihood for a low-volume handmade shop. **Fix:** paginate by offset, or poll with a small overlap window and lean on the idempotency guard; request ascending `created` order.
- **(medium) No integration test of the sync loop** (receipts + reconcile + push). Overlaps the untested-live blocker. **Fix:** mocked-client integration tests.
- **(low) Sync admin page shows a generic "keys not configured"** without naming the missing var (`ETSY_REDIRECT_URI` / `ETSY_SHOP_ID` are never validated/surfaced; `flags.etsyConfigured` checks only KEYSTRING+SHARED_SECRET).
- **REFUTED — `etsyLastSeenQty` NULL spurious conflicts:** it is always seeded on import (`sync.ts:171`, `:191`) and the fallback `?? liveQty` (`sync.ts:441`) neutralizes any NULL (no restock, no conflict). No change needed.

**What a human must confirm:** connect a real Etsy shop in staging (KEYSTRING / SHARED_SECRET / REDIRECT_URI / SHOP_ID), run admin OAuth, verify token stored; confirm listing+image+price import, receipt-poll decrement, push write-back, and reconcile-on-manual-restock; confirm the `x-api-key` `keystring:shared_secret` format is accepted; confirm variant↔offering mapping for any multi-offering listing.

---

## 4. Payments

**What works (sandbox, verified):** hosted Stripe Checkout (no raw card data); atomic stock reservation inside a transaction **before** the session is created (`checkout/route.ts:64-94`); guarded `UPDATE … WHERE quantity >= n` decrement; signature-verified webhooks; clear `pending → paid / cancelled` state machine; graceful 503 when Stripe is unset. Immediate capture (`mode:'payment'`) is the correct design for in-stock handmade goods.

**What's missing / gaps:**
- **(HIGH — LAUNCH BLOCKER, human gate) No refund/cancel path.** Grep finds only the `refunded` enum, display strings, and policy copy — no `stripe.refunds.create()`, no admin refund route; `orders/page.tsx` is read-only. This is an explicit Phase-2 brief deliverable (lines 58-59). **Interim:** refunds can be issued from the Stripe dashboard, but **inventory will NOT auto-restock** that way — document this. **Fix:** admin-authed action that refunds the payment_intent, sets `status='refunded'`, restocks via `addStock` + `queueEtsyPush` (mirror `releaseOrder`), and emails the customer.
- **(HIGH — recommended pre-launch) Oversell detection never alerts the maker (dead path).** `oversellFlag` is **never set true** anywhere; `sendOversellAlert` (`email.ts:47-62`) is **never called**. When `pollEtsyReceipts` drives stock negative (`sync.ts:386-395`) it creates a `SyncConflict` but does not link the order or set the flag, so the order-level "possible oversell" banner can never fire and no email is sent. Mitigated only by `SyncConflict` rows showing in the sync dashboard. **Fix:** in the oversell branch, resolve the affected order(s), set `oversellFlag=true`, and call `sendOversellAlert` (needs `MAKER_NOTIFICATION_EMAIL`).
- **(medium — missed by auditor) No stale-order sweeper.** `releaseOrder()` runs **only** from the Stripe `checkout.session.expired` / `async_payment_failed` webhook. Checkout reserves stock AND pushes reduced qty to Etsy **before** payment. If that event isn't subscribed (or fails to deliver), an abandoned checkout **permanently locks a one-of-a-kind unit out of stock on BOTH channels**. **Fix:** extend the existing cron to release `pending` orders older than the 30-min hold; document that those two events MUST be subscribed.
- **(medium) Webhook idempotency relies only on the `order.status` check** (`webhook/route.ts:53`). Handles Stripe's normal sequential retries; worst case on rare concurrent duplicate delivery is a duplicate confirmation email + a redundant (idempotent) Etsy push — **no double charge, no double decrement**. **Fix (hardening):** `ProcessedStripeEvent` table with a UNIQUE `event.id`, written before side effects.
- **(medium — business decision) No sales tax.** `automatic_tax:{enabled:false}` (`checkout/route.ts:140`); no `tax` field on `Order`. No UI claims tax is calculated (cart copy refers to shipping). **Confirm with Kristol/advisor** whether AZ / destination-state nexus collection is required; if yes, enable Stripe Tax and persist `amount_tax`.
- **(low) No test-vs-live key prefix guard** (`stripe.ts` instantiates without checking `sk_test_`/`sk_live_`). Defensive hardening, not a blocker; the brief's safeguard is sandbox test transactions.
- **(low) Single flat shipping rate** (`shipping_flat_cents`, default $5.50). Deliberate, admin-configurable MVP choice — see catalog dimension for the $4.99 discrepancy.
- **(low, accepted) US/CA shipping whitelist; 30-min session expiry hardcoded.** Reasonable for MVP.
- **REFUTED:** capture/authorization workflow (auto-capture is correct here) and "no webhook retry/timeout in code" (Stripe manages retries; duplicates the idempotency item).

**The live-key gate:** switching to `sk_live_`/`pk_live_` + generating the **live-mode** webhook signing secret requires Stripe account verification, a manual live test transaction, and explicit human approval before keys enter Vercel. A wrong/test webhook secret in prod silently leaves orders stuck `pending`.

---

## 5. Inventory core (anti-oversell guarantee)

**Assessment: the guarantee holds on the production sales path.** `tryReserve()` (`inventory.ts:49-54`) is a true single-statement atomic guarded decrement (`UPDATE … SET quantity = quantity - n WHERE id = ? AND quantity >= n`); `count === 0` ⇒ insufficient stock, nothing changed. The checkout transaction is all-or-nothing; `ProcessedEtsyReceipt` gives idempotent receipt application; the smoke test fires 5 concurrent reserves at a 1-stock item and proves exactly one wins, never oversells. All mutations route through `inventory.ts` and append a `LedgerEntry` (invariant `sum(delta) == quantity`).

**The one real defect:**
- **(HIGH — fix advised, not a blocker) `setStock()` non-atomic read-then-write (TOCTOU).** `inventory.ts:134-137` reads current qty, computes a delta, then writes the **absolute** value + a ledger row as **two non-transactional statements**. If an admin correction (`correctVariantStock`, `actions.ts:31`; `resolveConflict`, `actions.ts:130`) races a customer `tryReserve`, the absolute write can clobber the concurrent decrement — breaking the ledger invariant **and silently restoring a sold unit** (the exact oversell mode). Trigger is rare (single trusted operator, low volume) and SQLite serializes writes so it never appears in dev/smoke; it's a Postgres-prod concern. **Fix:** wrap read+update+ledger in one `$transaction` with a compare-and-swap (`updateMany WHERE quantity = expectedCurrent`, retry on `count==0`); prefer delta-based `addStock`/`forceDecrement` over absolute writes.

**Secondary (confirmed):**
- **(medium) Single-offering import seeding is not atomic** (`sync.ts:184-206`): variant created with `quantity=N`, then a separate `ledgerEntry.create`. If the ledger insert fails, invariant breaks. The multi-offering path (`:161-180`) is safe (creates qty 0, then atomic `addStock`). **Fix:** mirror the safe path.
- **(medium) `resolveConflict` inherits the `setStock` race + has no already-resolved guard** (`actions.ts:121-144`) — same root cause as above; add `updateMany WHERE status='open'` to claim atomically.

**Working-as-designed (do not "fix"):**
- `forceDecrement()` allows **unbounded negative** by design — it records reality past zero and raises a `SyncConflict.oversell`; a `maxNegative` cap would be **harmful**. Negative stock blocking further site sales is the *safe* behavior.
- JIT Etsy check **fails open** by design (a flaky Etsy API must not halt all checkouts; atomic ledger remains primary protection).
- Stripe webhook is already idempotent via the `order.status` guard; the missing event table is optional hardening (low).

**Test coverage gaps (real, low/medium):** smoke imports only `tryReserve`, `addStock`, `verifyLedgerInvariant`. Add: (1) `setStock` concurrent with `tryReserve` (would expose the clobber), (2) `forceDecrement`-to-negative asserts `wentNegative` + `SyncConflict.oversell` and that re-applying a `receiptId` is a no-op, (3) multi-item order where one item is out of stock asserts full rollback + other item not decremented.

**Net: no inventory item is a hard launch blocker; none requires a human gate. Priority fix is making `setStock()` atomic, then the seeding transaction and the new smoke cases.**

---

## 6. Catalog state

**Ground truth (queried from `prisma/dev.db`, not inferred from `seed.ts`):**
- **16 products, ALL `isSeed=0`**, all with `etsyListingId` and real `i.etsystatic.com` image URLs. **0 seed products.**
- **7 collections, all Etsy-derived** (Birthday, Valentines Day, Patriotic, St. Patricks Day, Spring, Fall, Halloween), all with `etsySectionId`. **0 seed collections.** 3 products are intentionally uncategorized (matching CHANGELOG [0.1.2] "13/16 categorized").
- CHANGELOG.md:174 and :154 explicitly document removal of the 17 seed products and 9 seed collections after the real import. `seed.ts` also short-circuits when any product exists.

**REFUTED auditor claims:** "17 seed products coexist with real listings", "placeholder.svg images / unclear real URLs", and "9 seed collections may diverge" — all false against the live DB. Products/images/collections are **launch-ready**.

**What must be replaced before publish (root cause: the `Setting` table is empty — 0 rows):**
- **(HIGH — LAUNCH BLOCKER, human gate) Policies page shows literal `(Placeholder...)` to customers.** `policies/page.tsx:19-30` falls back to strings containing `(Placeholder, confirm your real turnaround and carrier in admin.)` etc. With `Setting` empty, `policy_shipping`/`policy_returns`/`policy_faq` all render the placeholder copy publicly. **Fix:** enter real values via admin Settings; verify `/policies` contains no "Placeholder".
- **(medium — human gate) About page placeholder + hardcoded stats.** `about/page.tsx:33` renders `(Placeholder copy, Kristol, edit this anytime in the admin...)`; stats (5 yrs / 1,280+ / 5.0 / 227) are hardcoded JSX. **There is no admin editor for About** — the in-copy "edit in admin" instruction is misleading; this needs a **code edit**. Confirm copy/stats with Kristol and against the live Etsy shop.
- **(medium — human gate) Shipping default $5.50 vs real Etsy $4.99.** `checkout/route.ts:111-112` defaults `shipping_flat_cents` to 550; `Setting` is empty so live checkout charges **$5.50**, overcharging real customers $0.51, and the flat model can't express the free-keychain / $3.99-mini cases (CHANGELOG [0.4.4]). **Fix:** set `shipping_flat_cents=499` and decide on per-item cases; verify a test checkout.
- **(low — by design) No image upload UI.** `products/page.tsx:82` is a URL textarea. Synced products never need manual entry (content is one-way Etsy→Site); only maker-authored custom products need pasted URLs. Acceptable for launch.
- **(low — added) All images hotlinked from Etsy's CDN, no self-hosted copy.** If Etsy purges/rotates a URL or blocks hotlinking, images silently break to a "No image" fallback. Acceptable initially; plan to mirror to Vercel Blob/S3 during sync.

---

## 7. Config / secrets

Config is well-built: typed, centralized (`src/lib/config.ts`), degrades gracefully. **Most gaps are "set the right value in Vercel," not code defects.** Never print/commit values; manage prod secrets via Vercel env vars. Verified via `git ls-files`: only `.env.example` (placeholders) is tracked; `.env` is gitignored and **not committed**, and its Stripe keys are **test-mode**.

| Env var | Controls | Degrades if missing | Must set for prod |
|---|---|---|---|
| `DATABASE_URL` | Prisma pooled connection (Postgres) | App cannot read/write — runtime failure | **Yes** (Neon integration auto-populates) |
| `DATABASE_URL_UNPOOLED` | Prisma `directUrl` for `db push`/migrations | Schema apply fails | **Yes** |
| `NEXT_PUBLIC_SITE_URL` | Canonicals, Stripe success/cancel URLs (`checkout/route.ts:142-143`) | Currently `http://localhost:3000` → broken redirects + wrong SEO | **Yes — blocker** |
| `ADMIN_PASSWORD` | Admin login (`auth.ts:34-39`) | Defaults to `change-me-please` → trivially guessable | **Yes — blocker** |
| `ADMIN_SESSION_SECRET` | HMAC cookie signing | Falls back to insecure dev secret if unset | **Yes** (a strong value is in local `.env`; set it in Vercel too) |
| `STRIPE_SECRET_KEY` | Server Stripe client | Checkout returns graceful 503; **test key cannot take real money** | **Yes — live-key human gate** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client Stripe | Checkout UI degraded | **Yes — live-key gate** |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verify (`webhook/route.ts:36-45`) | Wrong/test secret in prod → events 400 → orders stuck `pending` | **Yes — blocker, payment gate** |
| `ETSY_KEYSTRING` / `ETSY_SHARED_SECRET` | Etsy app creds; gate all sync | Sync shows "not connected" | **Yes** (live-connect human gate) |
| `ETSY_REDIRECT_URI` | OAuth callback | OAuth fails; not surfaced in UI | **Yes** (must match Etsy app + prod domain) |
| `ETSY_SHOP_ID` | Shop-scoped endpoints | Sync calls fail | **Yes** |
| `CRON_SECRET` | Authorizes scheduled sync (`cron/etsy-sync/route.ts:14-19`) | Daily cron returns 401 → no unattended sync (manual still works) | **Yes — blocker** (unattended sync is the oversell backbone) |
| `RESEND_API_KEY` | Transactional + alert email | `email.ts` only `console.log`s | **Yes — blocker** (silences oversell alert) |
| `EMAIL_FROM` | Sender address | Sends fail if domain unverified | **Yes** (verify DNS in Resend) |
| `MAKER_NOTIFICATION_EMAIL` | Oversell alerts + contact form (`email.ts:51,65`) | Placeholder `kristol@example.com` → alerts go nowhere | **Yes** (Kristol's real address) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 analytics | Analytics disabled (graceful) | Optional (see cookie consent) |

**Corrections to prior audit:** `ADMIN_SESSION_SECRET` is **already a strong 64-hex value** (not the dev fallback) — REFUTED as a gap; only `ADMIN_PASSWORD` is the real admin issue. Secrets-in-`.env` is **low** (gitignored, untracked, test keys). "DATABASE_URL is a dev account" is unverifiable — `.env.example` notes Neon is used for both dev and prod, so it may already be the intended prod DB; treat as a confirm-and-set step. No pre-commit secret scanner (low; `.env` already untracked).

---

## 8. Launch blockers

- **SSL / domain / DNS:** Vercel provides HTTPS automatically. `NEXT_PUBLIC_SITE_URL` and `ETSY_REDIRECT_URI` are still `localhost` — **blocker** until set to the prod domain (and the Etsy app callback re-registered). Publishing/DNS is a human gate.
- **Legal:** **Privacy Policy and Terms of Service pages do not exist** (no `/privacy`, no `/terms` route; not linked in `StoreFooter.tsx`). Brief line 63 lists both as required. **Critical blockers, human gate** (need Kristol's facts + human/legal review). Placeholder shipping/returns/FAQ copy is **customer-visible** — blocker.
- **Analytics:** GA4 wired (`Analytics.tsx`, `anonymize_ip`) and gated on the env var — fine. But it sets `_ga` cookies with **no consent banner** anywhere (brief: "Add cookie/consent if needed"). Medium, conditional on GA being enabled in prod; at minimum disclose in Privacy.
- **SEO:** Product/Offer JSON-LD exists (`JsonLd.tsx`), but it injects Etsy-sourced descriptions via `dangerouslySetInnerHTML` **without escaping `<`** — a low-exploitability script-context XSS (operator-controlled content). Escape `<`/`>`/`&`. (Sitemap/robots/meta should be confirmed in Phase 3.)
- **404:** confirm a real 404 page exists in Phase 3.
- **a11y:** **(HIGH)** the primary **Featured Banners** product cards are `<div onClick>` with no `role`/`tabIndex`/`onKeyDown` (`Storefront.tsx:413`) — the detail/gallery modal **cannot be opened by keyboard** (New Arrivals correctly uses `<button>`). Not a hard blocker but the top a11y fix. Plus: unlabeled gallery thumbnail buttons (medium), missing `aria-pressed` on selection chips/size buttons, no skip link, modal doesn't restore focus on close (all low).
- **Perf:** 8 raw `<img>` in the homepage `Storefront` shell (hero/portrait/grids/gallery) bypass `next/Image` (LCP + CLS risk). The dedicated product page already uses `next/Image` with `priority`+`sizes`. Migrate hero/portrait (priority) and lazy-load below-fold grids.
- **Security:** JSON-LD escaping (above); add `ProcessedStripeEvent` idempotency table as defense-in-depth. No critical security defect found.

---

## 9. Prioritized punch list

Sorted critical→low, grouped by phase. "LB" = launch blocker; "HG" = requires human gate.

| # | Item | Severity | Phase | LB? | HG? |
|---|---|---|---|---|---|
| **Phase 1 — Etsy connection & inventory sync** | | | | | |
| 1 | Connect & validate a real Etsy shop end-to-end (OAuth, import, receipt decrement, push, reconcile) | critical | 1 | **Yes** | **Yes** (writes live Etsy qty) |
| 2 | Fix unmapped-receipt decrement loss (don't mark receipt processed if any txn unmapped) | high | 1 | No | No |
| 3 | Make single-offering import seeding atomic (`sync.ts:184-206`) | medium | 1 | No | No |
| 4 | Bounded retry / reconcile re-enqueue for `failed` Etsy pushes | medium | 1 | No | No |
| 5 | Paginate receipt polling (or overlap window + idempotency); request ascending order | medium | 1 | No | No |
| 6 | Add mocked-client integration tests for receipts + reconcile + push | medium | 1 | No | No |
| 7 | Confirm/set `DATABASE_URL` + `DATABASE_URL_UNPOOLED` in Vercel; run `db push` (no schema-apply in pipeline) | high | 1 | **Yes** | No |
| 8 | Surface specific missing Etsy env vars on the sync admin page | low | 1 | No | No |
| **Phase 2 — Checkout & payments** | | | | | |
| 9 | Build refund/cancel path (refund → status → restock → email); note manual dashboard refunds don't restock | high | 2 | **Yes** | **Yes** (moves money + comms) |
| 10 | Switch to live Stripe keys + live webhook signing secret in Vercel | critical | 2 | **Yes** | **Yes** (live payment / real money) |
| 11 | Wire oversell detection → set `oversellFlag` + call `sendOversellAlert` (dead path) | high | 2 | No | No |
| 12 | Add stale-`pending`-order sweeper (cron) + document required Stripe webhook events | medium | 2 | No | No |
| 13 | Make `setStock()` atomic (txn + compare-and-swap); fixes `resolveConflict` race too | high | 2 | No | No |
| 14 | Add `ProcessedStripeEvent` idempotency table (defense-in-depth) | medium | 2 | No | No |
| 15 | Add `resolveConflict` already-resolved guard (`updateMany WHERE status='open'`) | medium | 2 | No | No |
| 16 | Decide & implement sales tax (business/legal decision) | medium | 2 | No | **Yes** (business decision) |
| 17 | Set `shipping_flat_cents=499` + decide free-keychain / $3.99-mini handling | medium | 2 | No | **Yes** (real-money rate) |
| 18 | Add inventory smoke cases (concurrent setStock, forceDecrement-negative, multi-item rollback) | medium | 2 | No | No |
| 19 | Test-vs-live Stripe key prefix guard at startup | low | 2 | No | No |
| **Phase 3 — Launch readiness** | | | | | |
| 20 | Create Privacy Policy page (`/privacy`) + footer link; draft for human review | critical | 3 | **Yes** | **Yes** (legal/comms) |
| 21 | Create Terms of Service page (`/terms`) + footer link; draft for human review | critical | 3 | **Yes** | **Yes** (legal/comms) |
| 22 | Enter real `policy_shipping` / `policy_returns` / `policy_faq` in admin Settings (remove placeholder copy) | high | 3 | **Yes** | **Yes** (public content + facts) |
| 23 | Set `NEXT_PUBLIC_SITE_URL` + `ETSY_REDIRECT_URI` to prod domain; register Etsy callback | critical | 3 | **Yes** | No |
| 24 | Set strong `ADMIN_PASSWORD` (+ `ADMIN_SESSION_SECRET`) in Vercel | critical | 3 | **Yes** | No |
| 25 | Configure `RESEND_API_KEY` + verify `EMAIL_FROM` DNS + set real `MAKER_NOTIFICATION_EMAIL` | high | 3 | **Yes** | No |
| 26 | Set `CRON_SECRET` in Vercel (unattended sync = oversell backbone) | medium | 3 | **Yes** | No |
| 27 | Remove About-page placeholder note + confirm copy/stats (code edit) | medium | 3 | No | **Yes** (public content) |
| 28 | Fix keyboard-inoperable Featured product cards (`<button>` / role+tabIndex+onKeyDown) | high | 3 | No | No |
| 29 | Escape `<`/`>`/`&` in JSON-LD injection (`JsonLd.tsx:6`) | low | 3 | No | No |
| 30 | Cookie consent banner (or documented US-only stance) gating GA4 | medium | 3 | No | No |
| 31 | Migrate homepage `Storefront` `<img>` to `next/Image`; lazy-load grids | medium | 3/4 | No | No |
| 32 | Add `aria-label` to gallery thumbnails; `aria-pressed` on selection buttons; skip link; restore modal focus | low | 3 | No | No |
| 33 | Add `engines.node` pin + `.nvmrc` | low | 3 | No | No |
| 34 | Mirror Etsy CDN images to own storage during sync (resilience) | low | 4 | No | No |
| 35 | Pre-commit secret scanner (gitleaks/detect-secrets) | low | 3 | No | No |

---

## 10. Human-gate checklist

Per brief operating principle 2, these are the irreversible / money / legal / public-comms actions that **require Kristol's explicit approval** before proceeding. Each is to be brought to her **100% prepped** so she only reviews and approves.

1. **Go live with Stripe (live keys + live webhook secret).** *Prepped state:* sandbox end-to-end tests (success / decline / refund) documented; refund path built and tested; a go-live payment checklist drafted. *Human action:* verify Stripe account, approve inserting `sk_live_`/`pk_live_` + the live-mode webhook signing secret into Vercel, and authorize one real live test transaction.
2. **Connect the live Etsy shop (two-way sync writes authoritative quantities to live listings).** *Prepped state:* staging-validated OAuth + import + receipt decrement + push + reconcile; variant↔offering mapping reviewed; `ETSY_*` env vars staged. *Human action:* complete OAuth on the real shop and confirm direction (Etsy = source of truth) before enabling write-back.
3. **Publish the Privacy Policy and Terms of Service.** *Prepped state:* both pages drafted (data collected, GA4 cookies, Stripe/Resend processors, retention, GDPR/CCPA rights, contact email; handmade returns/warranty/liability/disputes), footer-linked, ready to render. *Human action:* review/edit for accuracy (not legal advice) and approve publish.
4. **Approve real operational/policy copy & rates.** *Prepped state:* admin Settings ready for `policy_shipping`/`policy_returns`/`policy_faq`; About copy + stats drafted; `shipping_flat_cents` proposed at 499 with the free-keychain/$3.99-mini question surfaced. *Human action:* supply real turnaround/carrier/return-window facts, confirm stats, approve shipping rate.
5. **Sales-tax decision.** *Prepped state:* implementation ready to toggle (Stripe Tax + persist `amount_tax`) pending the answer. *Human action:* confirm with a tax advisor whether collection is required at her volume.
6. **Publish to production / change DNS / make the store publicly reachable.** *Prepped state:* full pre-launch checklist green (HTTPS, prod env vars set, legal pages live, no placeholder text, Lighthouse run, 404 verified). *Human action:* approve go-live and DNS cutover.
7. **Any customer email / public post** (newsletter, launch announcement, social). *Prepped state:* copy drafted and queued. *Human action:* approve before send/post.
