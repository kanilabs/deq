/** Library search: names in all three languages, aliases and tags (PRD §8.5). */
import type { ShapeData } from "@0xdolan/deq-core";

/** Lower-case, strip Latin diacritics (ê → e, î → i), and unify Arabic-script variants. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[يى]/gu, "ی")
    .replace(/ك/gu, "ک")
    .replace(/ە/gu, "ه")
    .toLowerCase()
    .trim();
}

/** Every searchable string of a shape, normalised once. */
export function searchText(shape: ShapeData): string {
  return [
    shape.id,
    shape.names.en,
    shape.names.ckb.text ?? "",
    shape.names.kmr.text ?? "",
    ...shape.aliases,
    ...shape.tags,
  ]
    .map(normalize)
    .join("\n");
}

/**
 * Shapes matching every word of `query`, in `category` (or all), in catalog order. Shapes
 * whose id or English name starts with the query come first.
 */
export function searchShapes(
  shapes: readonly ShapeData[],
  query: string,
  category = "",
  index: ReadonlyMap<string, string> = new Map(shapes.map((s) => [s.id, searchText(s)])),
): ShapeData[] {
  const words = normalize(query).split(/\s+/u).filter(Boolean);
  const pool = category ? shapes.filter((s) => s.category === category) : shapes;
  if (words.length === 0) return [...pool];
  const hits = pool.filter((s) => {
    const text = index.get(s.id) ?? searchText(s);
    return words.every((w) => text.includes(w));
  });
  const first = words.join(" ");
  const starts = (s: ShapeData) =>
    s.id.startsWith(first) || normalize(s.names.en).startsWith(first) ? 0 : 1;
  return hits.sort((a, b) => starts(a) - starts(b));
}
