import Stripe from "stripe";
import { flags } from "./config";

// Singleton Stripe client. Null when not configured so the store can run in
// "preview" mode (browse but no real checkout).
export const stripe = flags.stripeEnabled
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" })
  : null;
