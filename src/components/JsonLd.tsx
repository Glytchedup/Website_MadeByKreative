// Renders JSON-LD structured data (Product, Review, Organization, etc.).
// Escapes `<`, `>`, `&` as unicode sequences so attacker-influenced string values
// (e.g. Etsy-sourced titles/descriptions) can't break out of the <script> tag.
// The result is still valid JSON.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
