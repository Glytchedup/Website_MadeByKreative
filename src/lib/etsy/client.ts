// ===========================================================================
// Etsy Open API v3 low-level client: OAuth (PKCE), token refresh, rate-limit
// backoff, and the handful of endpoints we use. Returns null/throws clearly
// when Etsy is not configured so callers can degrade gracefully.
// ===========================================================================

import crypto from "node:crypto";
import { prisma } from "../prisma";
import { flags } from "../config";

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const ETSY_CONNECT_URL = "https://www.etsy.com/oauth/connect";

export const ETSY_SCOPES = ["listings_r", "listings_w", "transactions_r", "shops_r"];

export function etsyConfigured(): boolean {
  return flags.etsyConfigured;
}

// -------- OAuth 2.0 PKCE helpers -------------------------------------------

export function generatePkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizeUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ETSY_KEYSTRING || "",
    redirect_uri: process.env.ETSY_REDIRECT_URI || "",
    scope: ETSY_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${ETSY_CONNECT_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, verifier: string) {
  const res = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ETSY_KEYSTRING || "",
      redirect_uri: process.env.ETSY_REDIRECT_URI || "",
      code,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Etsy token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as EtsyTokenResponse;
}

interface EtsyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
}

export async function persistToken(tok: EtsyTokenResponse, scope?: string) {
  const expiresAt = new Date(Date.now() + (tok.expires_in - 60) * 1000); // 60s safety margin
  await prisma.etsyToken.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt,
      shopId: process.env.ETSY_SHOP_ID || null,
      scope: scope ?? ETSY_SCOPES.join(" "),
    },
    update: { accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt },
  });
}

async function refreshToken(refresh: string): Promise<string> {
  const res = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ETSY_KEYSTRING || "",
      refresh_token: refresh,
    }),
  });
  if (!res.ok) throw new Error(`Etsy token refresh failed: ${res.status} ${await res.text()}`);
  const tok = (await res.json()) as EtsyTokenResponse;
  await persistToken(tok);
  return tok.access_token;
}

/** Get a valid access token, refreshing if expired. Returns null if not connected. */
export async function getAccessToken(): Promise<string | null> {
  if (!etsyConfigured()) return null;
  const row = await prisma.etsyToken.findUnique({ where: { id: "singleton" } });
  if (!row) return null;
  if (row.expiresAt.getTime() > Date.now()) return row.accessToken;
  return refreshToken(row.refreshToken);
}

export async function isConnected(): Promise<boolean> {
  if (!etsyConfigured()) return false;
  const row = await prisma.etsyToken.findUnique({ where: { id: "singleton" } });
  return Boolean(row);
}

// -------- Authenticated request with rate-limit backoff --------------------

export class EtsyNotConnectedError extends Error {
  constructor() {
    super("Etsy is not connected");
    this.name = "EtsyNotConnectedError";
  }
}

// Etsy expects the x-api-key header in the format "keystring:shared_secret"
// (the API rejects the bare keystring with "Shared secret is required in
// x-api-key header"). Falls back to the bare keystring if no secret is set.
function apiKeyHeader(): string {
  const key = process.env.ETSY_KEYSTRING || "";
  const secret = process.env.ETSY_SHARED_SECRET || "";
  return secret ? `${key}:${secret}` : key;
}

async function etsyFetch(path: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new EtsyNotConnectedError();

  const res = await fetch(`${ETSY_API_BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKeyHeader(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  // Rate limited or transient server error -> exponential backoff (max 4 tries).
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const retryAfter = Number(res.headers.get("retry-after")) || Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return etsyFetch(path, init, attempt + 1);
  }
  return res;
}

async function etsyJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await etsyFetch(path, init);
  if (!res.ok) throw new Error(`Etsy ${path} -> ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// -------- Endpoints we use -------------------------------------------------

const shopId = () => process.env.ETSY_SHOP_ID || "";

export interface EtsyListing {
  listing_id: number;
  title: string;
  description: string;
  state: string;
  quantity: number;
  tags: string[];
  taxonomy_id?: number;
  shop_section_id?: number | null;
  price?: { amount: number; divisor: number; currency_code: string };
}

export async function getActiveListings(limit = 100, offset = 0) {
  return etsyJson<{ count: number; results: EtsyListing[] }>(
    `/shops/${shopId()}/listings/active?limit=${limit}&offset=${offset}&includes=Images`
  );
}

export interface EtsySection {
  shop_section_id: number;
  title: string;
  rank?: number;
}

/** Shop sections — mapped to site Collections during content sync. */
export async function getShopSections() {
  return etsyJson<{ count: number; results: EtsySection[] }>(
    `/shops/${shopId()}/sections`
  );
}

export async function getListing(listingId: number | string) {
  return etsyJson<EtsyListing>(`/listings/${listingId}?includes=Images,Inventory`);
}

export async function getListingImages(listingId: number | string) {
  return etsyJson<{ results: { url_fullxfull: string; rank: number }[] }>(
    `/listings/${listingId}/images`
  );
}

/** Live listing-level quantity (sum of offering quantities). Used by the JIT guard. */
export async function getLiveListingQuantity(listingId: number | string): Promise<number> {
  const listing = await getListing(listingId);
  return listing.quantity ?? 0;
}

export interface EtsyInventory {
  products: {
    product_id: number;
    sku: string;
    offerings: { offering_id: number; quantity: number; is_enabled: boolean }[];
    property_values: { property_name: string; values: string[] }[];
  }[];
}

export async function getListingInventory(listingId: number | string) {
  return etsyJson<EtsyInventory>(`/listings/${listingId}/inventory`);
}

/**
 * Update listing inventory. Etsy requires PUT-ing the WHOLE inventory object
 * back with new quantities. Caller supplies the mutated products array.
 */
export async function updateListingInventory(listingId: number | string, products: unknown[]) {
  return etsyJson(`/listings/${listingId}/inventory`, {
    method: "PUT",
    body: JSON.stringify({ products }),
  });
}

export interface EtsyReceipt {
  receipt_id: number;
  created_timestamp: number;
  buyer_email?: string;
  transactions: {
    transaction_id: number;
    listing_id: number;
    product_id?: number;
    quantity: number;
    sku?: string;
  }[];
}

/** Receipts created at/after `minCreated` (unix seconds). Polled for Etsy sales. */
export async function getShopReceipts(minCreated?: number, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit), was_paid: "true" });
  if (minCreated) params.set("min_created", String(minCreated));
  return etsyJson<{ count: number; results: EtsyReceipt[] }>(
    `/shops/${shopId()}/receipts?${params.toString()}`
  );
}
