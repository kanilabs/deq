/**
 * SVG import (Phase 8d): an SVG file becomes a custom shape of `path` primitives.
 *
 * 1. A size cap, then the file is parsed as XML (no DOCTYPE allowed) and rebuilt from an
 *    allowlist: geometry elements only, geometry and paint attributes only (presentation
 *    `style` declarations become attributes), values checked, no `url(…)`, links, events,
 *    text, images or effects. The rebuilt SVG is all that paper.js ever sees.
 * 2. paper.js reads it, applying transforms and turning basic shapes into paths.
 * 3. Visible outlines (fill or stroke) are fitted into the 24-unit grid (keylines 2 to 22)
 *    and become `path` primitives, merged when there are more than the custom-shape limit.
 *
 * Only the path data is kept, and the result goes through `parseCustomDef` like every
 * other custom shape.
 */
import type { Primitive } from "@0xdolan/deq-core";

import { loadPaper, paperSegments, type PaperLoader } from "./boolean.ts";
import { CUSTOM_LIMITS, newCustomId, parseCustomDef, type CustomDef } from "./custom.ts";
import { pathData } from "./geometry.ts";

export const SVG_LIMITS = { bytes: 256 * 1024, elements: 5000 } as const;

/** `size` too big; `invalid` not SVG; `empty` nothing visible; `complex` too many outlines. */
export type SvgImportCode = "size" | "invalid" | "empty" | "complex";

export class SvgImportError extends Error {
  override name = "SvgImportError";
  constructor(readonly code: SvgImportCode) {
    super(`SVG import failed: ${code}`);
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Elements kept; anything else is dropped with everything inside it. */
const ELEMENTS: ReadonlySet<string> = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:px)?$/iu;
const LIST = /^[-+\d.,e\s]*$/iu;
const PAINT = /^(?:none|currentColor|#[\da-f]{3,8}|[a-z]{3,20}|(?:rgb|hsl)a?\([\d.,%\s]*\))$/iu;
/** Allowed attributes and the pattern their value must match. */
const ATTRIBUTES: ReadonlyMap<string, RegExp> = new Map([
  ...["x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height"].map(
    (name) => [name, NUMBER] as const,
  ),
  ...["stroke-width", "opacity", "fill-opacity", "stroke-opacity"].map(
    (name) => [name, NUMBER] as const,
  ),
  ["viewBox", LIST],
  ["points", LIST],
  ["d", /^[mlhvcsqtaz\d\s.,e+-]*$/iu],
  ["transform", /^[a-z\d\s.,()e+-]*$/iu],
  ["fill", PAINT],
  ["stroke", PAINT],
  ["fill-rule", /^(?:nonzero|evenodd)$/u],
  ["visibility", /^(?:visible|hidden|collapse)$/u],
  ["display", /^(?:none|inline|block)$/u],
]);

/** The attributes of `el` that pass the allowlist, `style` declarations included. */
function safeAttributes(el: Element): Map<string, string> {
  const out = new Map<string, string>();
  const keep = (name: string, value: string): void => {
    const v = value.trim();
    if (ATTRIBUTES.get(name)?.test(v) && !/url/iu.test(v)) out.set(name, v);
  };
  for (const decl of (el.getAttribute("style") ?? "").split(";")) {
    const [name = "", ...rest] = decl.split(":");
    keep(name.trim(), rest.join(":"));
  }
  // Presentation attributes lose to `style` declarations, as in CSS.
  const fromStyle = new Map(out);
  out.clear();
  for (const attr of Array.from(el.attributes)) {
    if (attr.namespaceURI === null) keep(attr.name, attr.value);
  }
  for (const [name, value] of fromStyle) out.set(name, value);
  return out;
}

/**
 * Parse SVG text and rebuild it from the allowlist.
 *
 * @throws {SvgImportError} `size` or `invalid`.
 */
export function sanitizeSvg(text: string): string {
  if (new TextEncoder().encode(text).length > SVG_LIMITS.bytes) throw new SvgImportError("size");
  // No DOCTYPE: no entities (no XXE, no billion laughs) and no external DTDs.
  if (/<!DOCTYPE|<!ENTITY/iu.test(text)) throw new SvgImportError("invalid");
  const source = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  if (
    source.localName !== "svg" ||
    source.namespaceURI !== SVG_NS ||
    source.getElementsByTagName("parsererror").length > 0
  ) {
    throw new SvgImportError("invalid");
  }
  // A detached tree in the page's document: nothing is inserted or rendered.
  const root = document.createElementNS(SVG_NS, "svg");
  let count = 0;
  const copy = (from: Element, to: Element): void => {
    for (const [name, value] of safeAttributes(from)) to.setAttribute(name, value);
    for (const child of Array.from(from.children)) {
      if (++count > SVG_LIMITS.elements) throw new SvgImportError("size");
      if (child.namespaceURI !== SVG_NS || !ELEMENTS.has(child.localName)) continue;
      const el = document.createElementNS(SVG_NS, child.localName);
      to.append(el);
      copy(child, el);
    }
  };
  copy(source, root);
  return new XMLSerializer().serializeToString(root);
}

// The few paper.js members used here.
interface PaperRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  unite(rect: PaperRect): PaperRect;
}
interface PaperColor {
  readonly alpha: number;
}
interface PaperMatrix {
  translate(x: number, y: number): PaperMatrix;
  scale(s: number): PaperMatrix;
}
interface PaperItem {
  readonly className: string;
  readonly clipMask: boolean;
  readonly visible: boolean;
  readonly fillColor: PaperColor | null;
  readonly strokeColor: PaperColor | null;
  readonly bounds: PaperRect;
  readonly children?: readonly PaperItem[];
  transform(matrix: PaperMatrix): void;
}
interface ImportScope {
  readonly project: { importSVG(svg: Element, options: Record<string, unknown>): PaperItem | null };
  readonly Matrix: new () => PaperMatrix;
}

/** A paint that shows: set and not fully transparent. */
const shows = (color: PaperColor | null): boolean => color !== null && color.alpha > 0;

/** Outlines that draw something: paths and compound paths with a fill or a stroke. */
function outlines(root: PaperItem): PaperItem[] {
  const out: PaperItem[] = [];
  const walk = (item: PaperItem): void => {
    if (!item.visible || item.clipMask) return;
    if (item.className === "Path" || item.className === "CompoundPath") {
      if (shows(item.fillColor) || shows(item.strokeColor)) out.push(item);
      return;
    }
    for (const child of item.children ?? []) walk(child);
  };
  walk(root);
  return out;
}

/** Join same-paint parts while the path data stays within the custom-shape limit. */
export function mergeParts(parts: readonly Primitive[]): Primitive[] {
  if (parts.length <= CUSTOM_LIMITS.primitives) return [...parts];
  const out: Primitive[] = [];
  for (const part of parts) {
    if (part.type !== "path") throw new SvgImportError("complex");
    const last = out.at(-1);
    if (
      last?.type === "path" &&
      (last.paint ?? "stroke") === (part.paint ?? "stroke") &&
      last.d.length + part.d.length + 1 <= CUSTOM_LIMITS.path
    ) {
      out[out.length - 1] = { ...last, d: `${last.d} ${part.d}` };
    } else {
      out.push(part);
    }
  }
  if (out.length > CUSTOM_LIMITS.primitives) throw new SvgImportError("complex");
  return out;
}

/** Whether the file has content the import leaves out (paint servers, text, images, effects). */
export function dropsContent(text: string): boolean {
  return /<(?:\w+:)?(?:linearGradient|radialGradient|pattern|text|image|filter|mask|foreignObject|use)\b/iu.test(
    text,
  );
}

/** A shape name from a file name: `my-icon.svg` → `my icon`. */
export function nameFromFile(file: string): string {
  const base = file
    .replace(/\.svg$/iu, "")
    .replace(/[-_]+/gu, " ")
    .trim();
  return (base || "Imported shape").slice(0, CUSTOM_LIMITS.name);
}

/**
 * Turn sanitised SVG into a custom shape (not yet saved).
 *
 * @throws {SvgImportError} `invalid`, `empty` or `complex`.
 */
export async function svgToCustom(
  clean: string,
  name: string,
  load?: PaperLoader,
  id = newCustomId(),
): Promise<CustomDef> {
  const scope = (await loadPaper(load)) as unknown as ImportScope;
  // Parse as XML and state the SVG paint defaults on the root, so paper.js does not fall
  // back to computed styles for them (they differ between DOM implementations).
  const svg = new DOMParser().parseFromString(clean, "image/svg+xml").documentElement;
  if (svg.nodeName !== "svg") throw new SvgImportError("invalid");
  if (!svg.hasAttribute("fill")) svg.setAttribute("fill", "#000");
  if (!svg.hasAttribute("stroke")) svg.setAttribute("stroke", "none");
  let root: PaperItem | null;
  try {
    root = scope.project.importSVG(svg, { expandShapes: true, insert: false, applyMatrix: true });
  } catch {
    throw new SvgImportError("invalid");
  }
  if (!root) throw new SvgImportError("invalid");
  const found = outlines(root);
  const [first, ...rest] = found;
  if (!first) throw new SvgImportError("empty");
  // Fit what is drawn (not the viewBox) into the keylines, centred, keeping the aspect.
  const box = rest.reduce((r, item) => r.unite(item.bounds), first.bounds);
  const size = Math.max(box.width, box.height);
  if (!(size > 0) || !Number.isFinite(size)) throw new SvgImportError("empty");
  const s = 20 / size;
  const fit = new scope.Matrix()
    .translate(12 - (box.width * s) / 2, 12 - (box.height * s) / 2)
    .scale(s)
    .translate(-box.x, -box.y);
  const parts: Primitive[] = [];
  for (const item of found) {
    item.transform(fit);
    const d = pathData(paperSegments(item as never));
    if (!d) continue;
    if (d.length > CUSTOM_LIMITS.path) throw new SvgImportError("complex");
    const filled = shows(item.fillColor) && !shows(item.strokeColor);
    parts.push(filled ? { type: "path", d, paint: "fill" } : { type: "path", d });
  }
  if (parts.length === 0) throw new SvgImportError("empty");
  try {
    return parseCustomDef({ id, version: 1, name, primitives: mergeParts(parts) });
  } catch (error) {
    if (error instanceof SvgImportError) throw error;
    throw new SvgImportError("complex");
  }
}

/** Sanitise and convert an SVG file's text. */
export async function importSvg(
  text: string,
  file: string,
  load?: PaperLoader,
): Promise<CustomDef> {
  return svgToCustom(sanitizeSvg(text), nameFromFile(file), load);
}
