# MadeByKreative — handmade goods storefront

A self-owned online shop for **Kristol** (Gilbert, AZ) to sell handmade fabric garlands,
banners, bunting & keychains — **alongside her existing Etsy shop**, with real **two-way
inventory sync** so the two channels never oversell the same one-of-a-few item.

Built with Next.js (App Router) + TypeScript + Tailwind + Prisma + Stripe.

---

## ✨ Quick start (5 minutes, no accounts needed)

The site runs **fully standalone** — you can browse the whole store before setting up
Stripe or Etsy. Those just enable real payments and sync.

```bash
npm install            # installs deps + generates the Prisma client
cp .env.example .env   # default values work for local dev as-is
npm run db:push        # creates the local SQLite database
npm run db:seed        # loads ~17 sample products across 9 collections
npm run dev            # http://localhost:3000
```

Visit:
- **Storefront:** http://localhost:3000
- **Admin:** http://localhost:3000/admin (password is `ADMIN_PASSWORD` from `.env`, default `change-me-please`)

Verify the critical inventory logic at any time:
```bash
npm run smoke          # tests atomic decrement, oversell guard, concurrency, ledger audit
```

---

## 🧠 How it works (the important part)

**The site owns the single source of truth for inventory.** Every product's stock count
lives on `Variant.quantity` in our database. Etsy is treated as a *second sales channel*
that reads from and writes back to that count. The two channels never independently hold
authoritative numbers — that's the whole point, because these are low-count handmade items
(often just 1–3 made) where overselling is a real, customer-facing failure.

Two data flows, deliberately separate:

| Data | Direction | Why |
|------|-----------|-----|
| **Content** (titles, photos, descriptions, prices, tags) | Etsy → Site (one-way) | Etsy stays Kristol's editing surface; the site mirrors it. |
| **Inventory** (stock counts) | Two-way via the ledger | Both channels must reflect the same finite stock. |

Four mechanisms keep stock honest (all in `src/lib/inventory.ts` + `src/lib/etsy/sync.ts`):

1. **Site sale → Etsy.** Checkout decrements stock with an *atomic guarded write*
   (`UPDATE … WHERE quantity >= n`) inside the order transaction. If it can't reserve, the
   purchase fails *before* charging. The new count is pushed to Etsy immediately.
2. **Etsy sale → Site.** A cron polls Etsy receipts every ~2.5 min and decrements the
   ledger. Each receipt is processed **idempotently** (keyed on Etsy `receipt_id`), so
   re-polling never double-counts.
3. **Just-in-time oversell guard.** For low-stock items, checkout re-queries Etsy's *live*
   quantity in the moment before charging. If it just sold out on Etsy, the sale is blocked
   gracefully. This closes the gap between polls.
4. **Restock reconciliation.** If Kristol adds stock directly in Etsy, the poller detects
   the quantity *rose* (vs. a sale, where it *drops*) and records a restock. Anything it
   can't explain becomes a **conflict** surfaced in admin for her to resolve — never
   silently overwritten.

Full architecture detail is in [`CLAUDE.md`](./CLAUDE.md).

---

## 🛠️ Daily use (for Kristol)

Everything is in the **admin** at `/admin`:

- **Products & inventory** — add products, restock (`+ Restock`) or set an exact count
  (`Set`). Inventory changes push to Etsy automatically.
- **Orders** — every website order, with shipping address. Oversell flags appear in red.
- **Etsy sync** — connect your Etsy shop, run a sync on demand, see the ledger vs. Etsy
  for every item, and resolve any conflicts.
- **Settings** — shipping rate and your Shipping / Returns / FAQ text (shown on the site).

You can keep listing and editing on Etsy exactly as you do today — the site mirrors your
content and keeps stock in step.

---

## 💳 Stripe setup (real checkout)

1. Create a free account at https://dashboard.stripe.com and grab your **test** keys from
   *Developers → API keys*.
2. Put them in `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
3. Forward webhooks locally with the Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` in `.env`.
4. Restart `npm run dev`. Checkout now works (use test card `4242 4242 4242 4242`).

Stripe Checkout handles cards, Apple Pay, Google Pay & Klarna automatically. **No card
data ever touches this app.**

---

## 🧵 Etsy setup (two-way sync)

1. Register an app at https://www.etsy.com/developers/your-apps — note the **Keystring**
   and **Shared Secret**. Find your **Shop ID** (numeric) via your shop URL or the API.
2. Add a redirect URI in the Etsy app settings that **exactly** matches:
   `http://localhost:3000/api/etsy/callback` (and your production URL when you deploy).
3. Fill in `.env`:
   ```
   ETSY_KEYSTRING=...
   ETSY_SHARED_SECRET=...
   ETSY_SHOP_ID=...
   ETSY_REDIRECT_URI=http://localhost:3000/api/etsy/callback
   ```
4. Restart, sign into `/admin`, go to **Etsy sync → Connect Etsy shop**, and authorize.
   The OAuth flow (PKCE) stores a refresh token; it renews access automatically.
5. Click **Sync now** to import your listings as content + seed inventory.

Requested scopes: `listings_r listings_w transactions_r shops_r`.

Tunables (in `.env`, also shown in admin Settings):
- `ETSY_POLL_INTERVAL_SECONDS` — how often to poll Etsy (default 150).
- `LOW_STOCK_THRESHOLD` — at/below this qty, the JIT live re-check runs (default 3).

---

## ☁️ Deploy (Vercel)

1. Push this repo to GitHub (already done) and import it in Vercel.
2. Switch the database to Postgres for production:
   - In `prisma/schema.prisma` set `provider = "postgresql"`.
   - Set `DATABASE_URL` in Vercel to your Postgres connection string (Vercel Postgres,
     Neon, Supabase, etc.). Run `npx prisma migrate deploy` (or `db push`) against it.
3. Add **all** the env vars from `.env.example` in the Vercel project settings (use your
   live Stripe keys + production Etsy redirect URI + a strong `ADMIN_PASSWORD`,
   `ADMIN_SESSION_SECRET`, and `CRON_SECRET`).
4. `vercel.json` already schedules the Etsy sync cron every 3 minutes. Vercel Cron calls
   `/api/cron/etsy-sync`; it's protected by `CRON_SECRET`.
5. Update `NEXT_PUBLIC_SITE_URL` to your real domain.

---

## 📁 Project layout

```
prisma/schema.prisma     Data model — inventory ledger is the source of truth
prisma/seed.ts           ~17 sample products + 9 collections (flagged isSeed)
src/lib/inventory.ts     Atomic guarded decrement, ledger audit, restock
src/lib/etsy/client.ts   Etsy API v3 client: OAuth (PKCE), token refresh, backoff
src/lib/etsy/sync.ts     Content import, receipt polling, reconciliation, JIT guard, pushes
src/app/                 Storefront pages, admin, API routes
src/components/          UI (cart, product card, etc.)
scripts/smoke-test.ts    Verifies the critical inventory paths
```

## Known limitations & next steps
See the end of [`CLAUDE.md`](./CLAUDE.md).
