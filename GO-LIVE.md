# GO-LIVE.md — MadeByKreative launch runbook

Everything the **code** needs for launch is done, tested, and committed (see
`CHANGELOG.md` 0.5.x). What remains are the **owner-only steps** the engineering
work was deliberately gated behind — live credentials, real money, legal sign-off,
and DNS. Each is pre-staged so it's a few minutes of work. Do them in order.

> The app **fails fast in production** if Stripe keys are test-mode or
> `ADMIN_SESSION_SECRET` is missing — so a half-configured deploy won't quietly
> take fake orders. Until these steps are done the store still runs in preview
> (browse + admin), it just can't take real money or sync the live shop.

## 0. Provision (one-time)
- [ ] **Postgres** (Neon/Vercel Postgres). Set `DATABASE_URL` (pooled) and
      `DATABASE_URL_UNPOOLED` (direct) in Vercel.
- [ ] **Apply the schema** once (no migrations folder — this project uses db push):
      `DATABASE_URL=… DATABASE_URL_UNPOOLED=… npx prisma db push`
- [ ] **Seed nothing** — the catalog imports from Etsy (step 4). Do not run `db:seed` against prod.

## 1. Secrets in Vercel (Production env)
- [ ] `ADMIN_PASSWORD` — strong, unique.
- [ ] `ADMIN_SESSION_SECRET` — 64 hex chars (`openssl rand -hex 32`).
- [ ] `CRON_SECRET` — random; Vercel Cron uses it to authorize `/api/cron/etsy-sync`.
- [ ] `NEXT_PUBLIC_SITE_URL` — your real domain (drives canonicals + Stripe redirect URLs).

## 2. Payments — Stripe (GATE: real money)
- [ ] Verify the Stripe account is live-ready.
- [ ] Set **live** `STRIPE_SECRET_KEY` (`sk_live_…`) + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`).
- [ ] Add the webhook endpoint in Stripe: `https://<domain>/api/stripe/webhook`,
      events: `checkout.session.completed`, `checkout.session.expired`,
      `checkout.session.async_payment_failed`. Paste its signing secret as
      `STRIPE_WEBHOOK_SECRET` (`whsec_…`).  *(All three events are required — the
      expired/failed events release reserved stock; the cron sweeper is the backstop.)*
- [ ] Decide **sales tax**: if you must collect, enable Stripe Tax (origin address +
      product tax codes) and set Setting `sales_tax_enabled = true` in admin. Otherwise leave off.
- [ ] Confirm **shipping**: default is **$4.99** flat (the real Etsy rate). Change via
      admin Settings `shipping_flat_cents` if needed (keychain free / mini $3.99 would
      need per-item rates — not yet built).
- [ ] **Test before trusting:** with test keys in a preview deploy, run a full
      checkout with card `4242 4242 4242 4242`, confirm the order goes `paid`, the
      confirmation email logs/sends, stock decrements, and a **refund** from
      `/admin/orders` restores stock. Then go live and run ONE small real purchase +
      refund.

## 3. Email — Resend
- [ ] Verify your sending domain in Resend (DNS records).
- [ ] Set `RESEND_API_KEY`, `EMAIL_FROM` (verified domain), and
      `MAKER_NOTIFICATION_EMAIL` (your real address — oversell/contact alerts go here).
      *(Without these, all emails just log to the server console — nothing breaks.)*

## 4. Etsy — live two-way sync (GATE: writes to your live listings)
- [ ] Set `ETSY_KEYSTRING`, `ETSY_SHARED_SECRET`, `ETSY_SHOP_ID`, and
      `ETSY_REDIRECT_URI = https://<domain>/api/etsy/callback` (add that exact URI in
      the Etsy app settings too). The admin **Sync** page names any missing var.
- [ ] In `/admin → Etsy sync`, click **Connect Etsy shop** and authorize (OAuth/PKCE).
- [ ] Click **Sync now** — imports listings as content + seeds inventory; the first
      receipt poll establishes a baseline (historical sales are not double-counted).
- [ ] **Confirm mapping:** for any listing with multiple offerings, the sync log warns
      ("multi_offering") — verify the variant↔offering mapping is right.
- [ ] **Validate in staging first** against the real shop before relying on it: import →
      make a test Etsy sale → confirm the site decrements → confirm a site sale pushes
      back to Etsy → confirm a manual Etsy restock reconciles.

## 5. Content & brand (GATE: your facts)
- [ ] Admin → Settings: confirm/replace `policy_shipping`, `policy_returns`,
      `policy_faq` (clean drafts are in place; edit to your real turnaround/returns).
- [ ] Review `/privacy` and `/terms` drafts — fill the `[confirm]` spots (retention,
      contact email, return window, governing law) and have them reviewed. Not legal advice.
- [ ] Confirm the About story + the homepage stats (5.0★ / 227 / 1,280+).
- [ ] Brand colors are placeholders in `tailwind.config.ts` — confirm the palette
      (re-run a contrast check after changing).

## 6. Launch
- [ ] Point DNS to Vercel; confirm HTTPS.
- [ ] Smoke the prod site: home, shop, product modal (keyboard + mouse), cart,
      checkout (live, the small test purchase above), `/admin` (307 → login),
      `/robots.txt`, `/sitemap.xml`, `/privacy`, `/terms`, a 404.
- [ ] Run Lighthouse; confirm cookie banner appears and GA sets no `_ga` cookie until accepted.
- [ ] Announce — but note: customer emails / social posts are your call to send.

## What's intentionally deferred (non-blocking)
- Mirror Etsy CDN images to own storage (resilience if Etsy rotates URLs).
- Per-variant Offer JSON-LD + breadcrumb schema, GA4 ecommerce events (SEO/analytics polish).
- Tiered/per-item shipping rates; switch the in-memory rate limiter to Upstash if you scale to multiple instances.
