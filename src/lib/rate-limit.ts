// ===========================================================================
// Minimal in-memory IP rate limiter — zero dependencies. Fixed-window buckets
// keyed by scope+window+IP, with opportunistic cleanup so the map can't grow
// unbounded. Adequate for a single-instance / low-traffic Vercel deploy; for a
// multi-instance setup swap the Map for Upstash/Redis behind the same interface.
// ===========================================================================

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
}

function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Enforce one or more windows for a scope (e.g. per-minute AND per-hour). Blocks
 * if ANY window is exceeded, returning the longest retry-after.
 */
export function enforceRateLimit(
  req: Request,
  scope: string,
  windows: { limit: number; windowMs: number }[]
): { ok: true } | { ok: false; retryAfterSec: number } {
  const ip = clientIp(req);
  let worst = 0;
  for (const w of windows) {
    const r = hit(`${scope}:${w.windowMs}:${ip}`, w.limit, w.windowMs);
    if (!r.ok) worst = Math.max(worst, r.retryAfterSec);
  }
  return worst > 0 ? { ok: false, retryAfterSec: worst } : { ok: true };
}

/** Standard 429 JSON response with a Retry-After header. */
export function tooManyRequests(retryAfterSec: number): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(retryAfterSec) },
  });
}
