// Decode HTML entities that the Etsy Open API returns in titles/descriptions
// (e.g. "St. Patrick&#39;s" -> "St. Patrick's", "&amp;" -> "&"). The API returns
// HTML-encoded text; we store/display plain text, so decode on import.
//
// Covers numeric (&#39;), hex (&#x27;), and the common named entities. `&amp;`
// is decoded LAST so we never double-decode (e.g. "&amp;#39;").
const NAMED: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(input: string): string {
  if (!input || input.indexOf("&") === -1) return input;
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name === "amp" ? m : NAMED[name] ?? m))
    .replace(/&amp;/g, "&");
}

function safeFromCodePoint(cp: number): string {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}
