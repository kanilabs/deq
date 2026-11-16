/**
 * Spec JSON: a re-importable Deq shape description (the render subset of
 * `spec/schema/shape.schema.json`, as core's `renderShapeData` reads it).
 */
import type { ShapeData } from "@0xdolan/deq-core";

import type { Resolved } from "./input.js";

/**
 * The shape behind an exported item. A catalog shape with its default parameters is
 * returned as is. With custom parameters it becomes a copy (named after the item) whose
 * parameter defaults are those values, so every layer survives. A composition keeps its
 * `use` primitives. Render options (colour, size and so on) are not part of a shape.
 */
export function toSpecShape(r: Resolved): ShapeData {
  const s = r.shape;
  if (s.id === "composition") {
    return {
      ...s,
      id: r.name,
      category: "compositions",
      names: { ...s.names, en: titleCase(r.name) },
    };
  }
  const params = r.options.params ?? {};
  const parameters = Object.fromEntries(
    Object.entries(s.parameters).map(([k, decl]) => [
      k,
      k in params ? { ...decl, default: params[k] } : decl,
    ]),
  ) as ShapeData["parameters"];
  const custom = Object.keys(s.parameters).some(
    (k) => k in params && params[k] !== s.parameters[k]?.default,
  );
  if (!custom && r.name === s.id) return s;
  return { ...s, id: r.name, version: 1, aliases: [], parameters };
}

const titleCase = (name: string): string =>
  name
    .split("-")
    .map((w) => (w[0] ?? "").toUpperCase() + w.slice(1))
    .join(" ");

/** Pretty-printed spec JSON with a trailing newline. */
export function toSpecJson(r: Resolved): string {
  return `${JSON.stringify(toSpecShape(r), null, 2)}\n`;
}
