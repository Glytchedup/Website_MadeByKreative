import { NextRequest, NextResponse } from "next/server";
import { runFullSync } from "@/lib/etsy/sync";
import { sweepAbandonedOrders } from "@/lib/orders";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Polls Etsy and runs the full two-way reconciliation. Triggered by Vercel Cron
// (configured in vercel.json) or manually from the admin sync dashboard.
//
// Auth: accepts EITHER a valid admin session (manual "Sync now" button) OR the
// CRON_SECRET as a Bearer token / Vercel cron header (scheduled runs).
async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
  // Vercel cron sets this header on scheduled invocations.
  if (secret && req.headers.get("x-vercel-cron")) return true;
  return isAuthenticated();
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Release abandoned checkouts FIRST, and unconditionally — a stale pending
  // order locks site (and Etsy) stock whether or not Etsy is connected, so this
  // must not be skipped by the Etsy-not-connected early return in runFullSync.
  const sweep = await sweepAbandonedOrders().catch((e) => ({ released: 0, error: String(e) }));
  const result = await runFullSync();
  return NextResponse.json({ ranAt: new Date().toISOString(), sweep, ...result });
}

export const GET = handle;
export const POST = handle;
