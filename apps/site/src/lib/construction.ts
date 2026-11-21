/** Build-time construction data for the icon pages: steps, primitives, metrics and the grid drawing. */
import { escapeXml } from "@0xdolan/deq-core";

import grid from "../../../../spec/grid.json";

type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = Readonly<Record<string, Json>>;

/** The metrics `deq-spec fmt` writes into every shape file. */
export interface Metrics {
  readonly bbox: readonly number[];
  readonly visualBox: readonly number[];
  readonly opticalCenter: readonly number[];
  readonly strokeToSize: number;
  readonly primitiveCount: number;
}

interface SpecShape {
  readonly id: string;
  readonly construction: readonly string[];
  readonly metrics: Metrics;
  readonly primitives: readonly JsonObject[];
  readonly symmetryCenter?: readonly number[];
}

const FILES = import.meta.glob<SpecShape>("../../../../spec/shapes/*.json", {
  eager: true,
  import: "default",
});

const SPEC: ReadonlyMap<string, SpecShape> = new Map(Object.values(FILES).map((s) => [s.id, s]));

/** One top-level primitive as a table row. */
export interface PrimitiveRow {
  readonly id: string | undefined;
  readonly layer: string;
  readonly type: string;
  /** The primitive's values in spec order, for example `cx 12, cy 12, r 5`. */
  readonly values: string;
  /** The parameter values the primitive is drawn for, or undefined when always drawn. */
  readonly when: string | undefined;
}

/** A point worth marking on the drawing: a circle, dot, arc, star or generator centre. */
export interface Marker {
  readonly x: number;
  readonly y: number;
}

/** Everything the Construction section shows for one shape. */
export interface Construction {
  readonly steps: readonly string[];
  readonly metrics: Metrics;
  readonly rows: readonly PrimitiveRow[];
  readonly markers: readonly Marker[];
}

const SKIP = new Set(["type", "id", "layer", "when", "element", "paint"]);

/** A spec value as short text: numbers as written, points as (x, y), parameter references by name. */
export function formatValue(value: Json): string {
  if (Array.isArray(value)) {
    const items = value as readonly Json[];
    return items.every((v) => typeof v === "number")
      ? `(${items.join(", ")})`
      : items.map((v) => formatValue(v)).join(" ");
  }
  if (value !== null && typeof value === "object") {
    const obj = value as JsonObject;
    if (typeof obj["param"] === "string" && Object.keys(obj).length === 1)
      return `param ${obj["param"]}`;
    return Object.entries(obj)
      .map(([k, v]) => `${k} ${formatValue(v)}`)
      .join(", ");
  }
  return String(value);
}

/** The values of a primitive (and of a generator's element), in spec order. */
export function formatPrimitive(p: JsonObject): string {
  const own = Object.entries(p)
    .filter(([key]) => !SKIP.has(key))
    .map(([key, v]) => `${key} ${formatValue(v)}`);
  if (p["paint"] === "fill") own.push("filled");
  const element = p["element"];
  if (
    element !== undefined &&
    element !== null &&
    typeof element === "object" &&
    !Array.isArray(element)
  ) {
    const el = element as JsonObject;
    own.push(`element: ${formatValue(el["type"] ?? "")} ${formatPrimitive(el)}`.trimEnd());
  }
  return own.join(", ");
}

function markerOf(p: JsonObject): Marker | undefined {
  if (typeof p["cx"] === "number" && typeof p["cy"] === "number") return { x: p["cx"], y: p["cy"] };
  const c = p["center"];
  if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number")
    return { x: c[0], y: c[1] };
  return undefined;
}

/** The construction data of a shape, read from its spec file. */
export function constructionOf(id: string): Construction {
  const spec = SPEC.get(id);
  if (spec === undefined) throw new Error(`no spec file for shape ${id}`);
  const rows = spec.primitives.map((p) => ({
    id: typeof p["id"] === "string" ? p["id"] : undefined,
    layer: formatValue(p["layer"] ?? ""),
    type: formatValue(p["type"] ?? ""),
    values: formatPrimitive(p),
    when: p["when"] === undefined ? undefined : formatValue(p["when"]),
  }));
  const seen = new Set<string>();
  const markers: Marker[] = [];
  for (const p of spec.primitives) {
    const nested = p["element"] as JsonObject | undefined;
    for (const m of [
      markerOf(p),
      p["type"] === "radial" || nested === undefined ? undefined : markerOf(nested),
    ]) {
      if (m === undefined || seen.has(`${String(m.x)},${String(m.y)}`)) continue;
      seen.add(`${String(m.x)},${String(m.y)}`);
      markers.push(m);
    }
  }
  return { steps: spec.construction, metrics: spec.metrics, rows, markers };
}

const r = (n: number): string => String(Math.round(n * 1000) / 1000);

/**
 * The grid drawing as SVG markup, in a 24-unit view box: unit grid, keylines, live area and markers.
 * The shape itself is drawn on top by the page. Built only from `spec/grid.json` and spec numbers.
 */
export function gridSvg(markers: readonly Marker[], label: string): string {
  const { width, height } = grid.canvas;
  const lines: string[] = [];
  for (let i = 1; i < width; i += 1) lines.push(`M${String(i)} 0V${String(height)}`);
  for (let i = 1; i < height; i += 1) lines.push(`M0 ${String(i)}H${String(width)}`);
  const keylines = grid.keylines.map(({ id, shape }) => {
    const cls = id === "live-area" ? "live" : "key";
    const s = shape as Readonly<Record<string, number | string>>;
    const n = (key: string): string => r(Number(s[key]));
    return s["type"] === "circle"
      ? `<circle class="${cls}" cx="${n("cx")}" cy="${n("cy")}" r="${n("r")}"/>`
      : `<rect class="${cls}" x="${n("x")}" y="${n("y")}" width="${n("width")}" height="${n("height")}"/>`;
  });
  const marks = markers.map((m) => `<circle class="mark" cx="${r(m.x)}" cy="${r(m.y)}" r="0.35"/>`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} ${String(height)}" role="img" aria-label="${escapeXml(label)}">`,
    `<path class="unit" d="${lines.join("")}"/>`,
    `<path class="axis" d="M12 0V24M0 12H24"/>`,
    ...keylines,
    ...marks,
    "</svg>",
  ].join("");
}
