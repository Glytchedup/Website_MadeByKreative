import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthenticated } from "@/lib/auth";
import { exchangeCodeForToken, persistToken } from "@/lib/etsy/client";
import { siteConfig } from "@/lib/config";

export const runtime = "nodejs";

// Step 2 of OAuth: Etsy redirects back with ?code&state. We validate state,
// exchange the code (with the PKCE verifier) for tokens, and store them.
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const verifier = jar.get("etsy_pkce")?.value;
  const expectedState = jar.get("etsy_state")?.value;

  // Always clear the one-time PKCE/state cookies, on every outcome — a failed or
  // replayed attempt must not leave them lingering for reuse.
  const clear = () => {
    jar.delete("etsy_pkce");
    jar.delete("etsy_state");
  };

  if (!code || !state || !verifier || state !== expectedState) {
    clear();
    return NextResponse.redirect(`${siteConfig.url}/admin/sync?error=oauth_failed`);
  }

  try {
    const tok = await exchangeCodeForToken(code, verifier);
    await persistToken(tok);
  } catch (err) {
    clear();
    return NextResponse.redirect(`${siteConfig.url}/admin/sync?error=${encodeURIComponent(String(err))}`);
  }

  clear();
  return NextResponse.redirect(`${siteConfig.url}/admin/sync?connected=1`);
}
