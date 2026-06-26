import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendContactMessage } from "@/lib/email";
import { enforceRateLimit, tooManyRequests } from "@/lib/rate-limit";

const Body = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  message: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const rl = enforceRateLimit(req, "contact", [
    { limit: 5, windowMs: 60_000 },
    { limit: 20, windowMs: 3_600_000 },
  ]);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { name, email, message } = parsed.data;
  await prisma.contactMessage.create({ data: { name, email, message } });
  await sendContactMessage({ name, email, message }).catch((e) => console.error("contact email failed", e));
  return NextResponse.json({ ok: true });
}
