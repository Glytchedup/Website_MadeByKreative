import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Body = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
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
