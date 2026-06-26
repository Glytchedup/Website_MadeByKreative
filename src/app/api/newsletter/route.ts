import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, tooManyRequests } from "@/lib/rate-limit";

const Body = z.object({ email: z.string().email().max(254) });

export async function POST(req: NextRequest) {
  const rl = enforceRateLimit(req, "newsletter", [
    { limit: 5, windowMs: 60_000 },
    { limit: 20, windowMs: 3_600_000 },
  ]);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email: parsed.data.email },
      create: { email: parsed.data.email, source: "site", consent: true },
      update: {},
    });
  } catch {
    return NextResponse.json({ error: "Could not subscribe" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
