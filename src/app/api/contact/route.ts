import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendContactMessage } from "@/lib/email";

const Body = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { name, email, message } = parsed.data;
  await prisma.contactMessage.create({ data: { name, email, message } });
  await sendContactMessage({ name, email, message }).catch((e) => console.error("contact email failed", e));
  return NextResponse.json({ ok: true });
}
