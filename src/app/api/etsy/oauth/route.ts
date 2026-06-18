import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { isAuthenticated } from "@/lib/auth";
import { buildAuthorizeUrl, etsyConfigured, generatePkce } from "@/lib/etsy/client";

export const runtime = "nodejs";

// Step 1 of OAuth: admin clicks "Connect Etsy" -> we generate PKCE + state,
// stash them in httpOnly cookies, and redirect to Etsy's consent screen.
export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!etsyConfigured())
    return NextResponse.json({ error: "Set ETSY_KEYSTRING / ETSY_SHARED_SECRET first." }, { status: 400 });

  const { verifier, challenge } = generatePkce();
  const state = crypto.randomBytes(16).toString("hex");

  const jar = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("etsy_pkce", verifier, opts);
  jar.set("etsy_state", state, opts);

  return NextResponse.redirect(buildAuthorizeUrl(state, challenge));
}
