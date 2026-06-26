import Stripe from "stripe";
import { flags } from "./config";

// On a real PRODUCTION deploy (Vercel `production`), refuse to start with
// test/placeholder Stripe credentials: a stray test secret key would silently
// accept no real money, and a missing/test webhook secret would leave paid
// orders stuck `pending`. Keyed on VERCEL_ENV (not NODE_ENV) so local/CI
// `next build` — which runs with NODE_ENV=production but no VERCEL_ENV — and dev
// keep using test keys freely.
if (flags.stripeEnabled && process.env.VERCEL_ENV === "production") {
  if (!(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_")) {
    throw new Error("Production requires a live STRIPE_SECRET_KEY (sk_live_…)");
  }
  if (!(process.env.STRIPE_WEBHOOK_SECRET || "").startsWith("whsec_")) {
    throw new Error("Production requires STRIPE_WEBHOOK_SECRET (whsec_…)");
  }
}

// Singleton Stripe client. Null when not configured so the store can run in
// "preview" mode (browse but no real checkout).
export const stripe = flags.stripeEnabled
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" })
  : null;
