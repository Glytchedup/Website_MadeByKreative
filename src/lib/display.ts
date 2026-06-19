// Display helpers for turning raw Etsy data into clean, human-facing strings.
// Etsy titles are keyword-stuffed for search ("Halloween Shabby Rag Garland -
// Handmade, Fabric, Banner") and may carry raw HTML entities ("St. Patrick&#39;s").
// Use these for anything shown to shoppers; keep the raw title for Etsy/SEO.

import { decodeEntities } from "./html";

// Human product name: decode entities, then drop the descriptor tail that starts
// at the first " - " / " – " separator (a dash followed by a space — so hyphenated
// words like "Pre-Day" are preserved).
export function cleanTitle(raw: string): string {
  const decoded = decodeEntities(raw).trim();
  const name = decoded.split(/[-–—]\s/)[0].trim();
  return name || decoded;
}

// Normalize size-label casing so chips read consistently
// ("6 Feet" + "4 feet" -> "6 feet" + "4 feet").
export function cleanSize(raw: string): string {
  return raw.replace(/\bFeet\b/g, "feet").replace(/\bInches\b/g, "inches").trim();
}
