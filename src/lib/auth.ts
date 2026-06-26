// Minimal single-user admin auth for the maker. A signed (HMAC) httpOnly cookie
// — no external dependency. Sufficient for one trusted operator; swap for
// NextAuth/Clerk if multi-user is ever needed.

import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "mbk_admin";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s) return s;
  // Never run on the insecure dev fallback in production — fail closed so a
  // missing secret can't quietly make admin sessions forgeable.
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET is required in production");
  }
  return "insecure-dev-secret-change-me";
}

function sign(value: string): string {
  const mac = crypto.createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function verify(token: string): boolean {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const value = token.slice(0, idx);
  const expected = sign(value);
  // timing-safe compare
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  const exp = Number(value.split(":")[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function createSession() {
  const value = `admin:${Date.now() + MAX_AGE * 1000}`;
  const jar = await cookies();
  jar.set(COOKIE, sign(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  return token ? verify(token) : false;
}
