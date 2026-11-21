/** Build-time data for the pages: shapes, categories, names and code points. */
import { listCategories, listShapes, type ShapeData } from "@0xdolan/deq-core";

import codepointFile from "../../../../fonts/codepoints.json";
import catalog from "../../../../spec/catalog.json";
import type { Locale, MessageKey } from "../i18n/index.ts";

const CODEPOINTS: Readonly<Record<string, string>> = codepointFile.codepoints;

/** Categories in catalog order. */
export const CATEGORIES: readonly string[] = catalog.categories
  .map((c) => c.id)
  .filter((id) => listCategories().includes(id));

/** All shapes in catalog order (category, then the catalog's order within it). */
export const SHAPES: readonly ShapeData[] = catalog.categories.flatMap((c) =>
  c.shapes.flatMap((id) => listShapes(c.id).filter((s) => s.id === id)),
);

export const categoryKey = (category: string): MessageKey => `category.${category}` as MessageKey;

export interface LocalName {
  readonly text: string;
  /** The language the text is in (falls back to English when no Kurdish name is recorded). */
  readonly lang: Locale;
  readonly needsReview: boolean;
}

/** A shape's name in a locale, falling back to English. */
export function shapeName(shape: ShapeData, locale: Locale): LocalName {
  if (locale === "en") return { text: shape.names.en, lang: "en", needsReview: false };
  const name = shape.names[locale];
  return name.text === null
    ? { text: shape.names.en, lang: "en", needsReview: false }
    : { text: name.text, lang: locale, needsReview: name.status !== "verified" };
}

/** The icon font code point, as `U+E000`. */
export function codepoint(id: string): string | undefined {
  const cp = CODEPOINTS[id];
  return cp === undefined ? undefined : `U+${cp}`;
}

/** Text a visitor can filter on: id, names, tags and aliases. */
export const searchText = (shape: ShapeData): string =>
  [
    shape.id,
    shape.names.en,
    shape.names.ckb.text,
    shape.names.kmr.text,
    ...shape.tags,
    ...shape.aliases,
  ]
    .filter((x): x is string => typeof x === "string" && x !== "")
    .join(" ")
    .toLowerCase();
