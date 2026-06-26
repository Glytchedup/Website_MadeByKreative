import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkPassword, createSession, destroySession } from "@/lib/auth";
import { enforceRateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  // Throttle brute-force: 5 attempts / 15 min per IP.
  const rl = enforceRateLimit(req, "admin-login", [{ limit: 5, windowMs: 15 * 60_000 }]);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !checkPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  await createSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
