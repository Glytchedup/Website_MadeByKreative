# MadeByKreative — Autonomous Storefront Launch Brief

> Paste this as your task, or drop it in the repo root as `LAUNCH_BRIEF.md` and point Claude Code at it.

## Role & mission
You are the lead engineer for the **MadeByKreative** online storefront (handmade fabric banners & garlands; Etsy shop owner: Kristol). Your mission, end to end:

1. Audit every aspect of the site.
2. Get it fully connected and in sync with Etsy (inventory, prices, images, variations).
3. Finish and verify the checkout/payment flow.
4. Get the site launch-ready.
5. Build the on-site + content foundation to drive traffic.

Work **as autonomously as possible**. Do all reversible work without asking. Stop for human approval **only** at the few irreversible / money-spending / legally significant gates defined below — and at each gate, do 100% of the prep so the human just reviews and approves.

## Operating principles
1. **Discover before you change.** Map the current state first; assume nothing about the stack.
2. **Autonomy with hard gates.** STOP and request explicit approval before any of:
   - (a) publishing to production / changing DNS / making the store publicly reachable;
   - (b) switching any payment provider from test/sandbox to **live** keys, or capturing a real payment;
   - (c) spending money (ads, paid tools, paid plans);
   - (d) emailing/texting real customers or posting to any public/social channel;
   - (e) deleting or overwriting data in Etsy or any production datastore.
3. **Secrets.** Never print, log, or commit secrets. Use the existing env/secret store. If a needed credential is missing, list it and pause — don't hardcode.
4. **Etsy is the source of truth** for products, prices, images, variations, and quantities unless told otherwise. The site must **never oversell** Etsy stock.
5. **Verify everything.** Nothing is "done" until tested. Use test/sandbox modes for all transactions and run real end-to-end checks.
6. **Keep records.** Maintain `CHANGELOG.md` (dated entry per meaningful change) and keep `CLAUDE.md` current (architecture, integrations, env vars, run/deploy steps). Update as you go, not at the end.
7. **Small, reviewable commits** on a working branch. No force-push. Open a PR per phase if a remote exists.

After the Phase 0 audit, **continue automatically through Phases 1–3**, pausing only at the gates above.

---

## Phase 0 — Audit (no changes yet)
Produce `AUDIT.md` covering:
- **Stack:** framework, language, hosting/deploy target, package manager, build/run commands.
- **Etsy integration:** present? API version (Etsy Open API v3?), auth method, what syncs today, gaps.
- **Payments:** provider(s), test vs live, what works, what's missing.
- **Catalog state:** products on site vs on Etsy (counts + mismatches).
- **Config/secrets:** required env vars, which are set vs missing.
- **Launch blockers:** SSL/domain, legal pages, analytics, broken links, accessibility, performance.
- **Prioritized punch list** mapped to the phases below.

Post the audit summary, then proceed into Phase 1.

## Phase 1 — Etsy connection & inventory sync
- Establish/repair a working **Etsy API v3** connection (OAuth2, refresh-token handling, rate limits + 429 backoff).
- Reconcile catalog: every active Etsy listing → site product with title, description, price, currency, photos, variations/options, SKUs, and available quantity. **Flag mismatches; never silently delete site products** — list them for review.
- Implement sync: default **one-way Etsy → site** on a schedule (and/or webhook if available). Make it **idempotent** and safe to re-run. Decrement availability so the site can't sell more than Etsy stock. If two-way write-back is needed, **gate it** and confirm direction first.
- Handle edge cases: sold-out, renewed/expired/deleted listings, draft vs active, multi-quantity variations.
- Deliver integration tests (or a dry-run mode) + a reconciliation report.

## Phase 2 — Checkout & payments (sandbox only)
- Use a **hosted/embedded** integration (e.g., Stripe Checkout / Payment Element, or PayPal) so raw card data never touches our servers and PCI scope stays minimal. **Do not build custom card fields.**
- Full flow: cart → checkout → payment → confirmation, with **server-side price + stock validation** (never trust client totals; re-check stock at checkout).
- **Webhooks** as the authoritative payment status; create order records; idempotent on retries.
- Configure shipping options and tax handling. Surface anything needing a business decision (tax registration, shipping zones/rates) for human input — don't guess.
- Build a refund/cancel path and clear success / decline / error UX.
- **Run end-to-end test transactions in sandbox** (success, decline, refund) and document results.
- **GATE:** do not insert live keys or capture real money. Produce a go-live payment checklist for approval.

## Phase 3 — Launch readiness
- **Legal/policy pages drafted for human review** (not legal advice): Privacy, Terms, Returns/Refunds, Shipping. Add cookie/consent if needed.
- Analytics (GA4 or privacy-friendly alt) + basic error monitoring/logging.
- Quality bars: responsive/mobile; accessibility (target **WCAG 2.1 AA** — alt text, contrast, keyboard nav, labels); performance (run **Lighthouse**; optimize images, lazy-load, caching). Fix broken links, add a real 404, verify HTTPS/SSL + redirects.
- Technical SEO baseline: titles/meta descriptions, Open Graph/Twitter cards, `sitemap.xml`, `robots.txt`, canonical URLs, and **Product/Offer JSON-LD** per product.
- Pre-launch checklist + a one-page "what's left for the human" doc.
- **GATE:** present the go-live checklist; **do not publish or change DNS until approved.**

## Phase 4 — Drive traffic (only after launch is approved & verified green)
First confirm the store is live, payments work, and inventory is in sync. Then:
- Deepen on-site SEO: keyword-aligned product/category/landing copy, internal linking, image SEO, FAQ/structured content; ensure indexability; set up search-console properties (flag any needing the owner's login) and submit the sitemap.
- Tune performance / Core Web Vitals.
- **Draft, don't send/post:** social captions + content calendar, launch email/newsletter copy, Etsy listing-copy improvements, and a Pinterest/Instagram visual plan (a strong fit for fabric/craft goods) — all queued for approval.
- Set up analytics goals/funnels + a simple weekly metrics report.
- **Recommend** (with budget options) but **do not execute** paid ads or paid tools. No auto-posting, bought traffic, fake accounts, or black-hat tactics — ever.

---

## Definition of done
- **Per phase:** tests passing, a short written report, `CHANGELOG.md` + `CLAUDE.md` updated, and (at gates) a human-approval checklist.
- **Final:** catalog in sync with Etsy; sandbox-verified checkout ready to flip live; launch checklist approved; SEO + analytics in place; review-ready growth kit.

## Do NOT
Commit/log secrets · take real payments unattended · publish or change DNS without approval · spend money · email/post publicly without approval · overwrite/delete Etsy or production data · use any spammy/black-hat traffic tactics.
