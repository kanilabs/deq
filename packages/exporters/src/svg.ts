/** SVG-based exporters: optimised, layered, sprite, HTML, data URI, CSS and Figma. */
import { DeqError, escapeXml, num, svgDocument } from "@0xdolan/deq-core";

import { BLACK, parseColor, toHex } from "./color.js";
import type { Rgba } from "./color.js";
import { canvasPixels, resolveItem } from "./input.js";
import type { ExportItem, Resolved } from "./input.js";

/** The root attributes and inner markup of an SVG produced by core. */
/** A Deq SVG document split by `splitSvg`. */
export interface SvgParts {
  readonly attrs: readonly (readonly [string, string])[];
  readonly inner: string;
}

/**
 * Split core output into root attributes and inner markup. Core escapes `"`, `<` and `>`
 * in every attribute value, so a simple scan is exact for its output.
 */
/** Parse `name="value"` pairs with a linear scan (no backtracking regex). */
function splitAttrs(source: string): (readonly [string, string])[] {
  const attrs: (readonly [string, string])[] = [];
  let i = 0;
  for (;;) {
    const eq = source.indexOf('="', i);
    if (eq === -1) return attrs;
    const end = source.indexOf('"', eq + 2);
    if (end === -1) return attrs;
    attrs.push([source.slice(i, eq).trim(), source.slice(eq + 2, end)]);
    i = end + 1;
  }
}

/**
 * Splits a Deq SVG document into its root attributes and inner markup.
 *
 * @throws Error when the text is not a single `<svg>` element.
 */
export function splitSvg(svg: string): SvgParts {
  const m = /^<svg ([^>]*)>([\s\S]*)<\/svg>$/.exec(svg);
  if (!m) throw new Error("not a Deq SVG document");
  return { attrs: splitAttrs(m[1] ?? ""), inner: m[2] ?? "" };
}

const asItem = (item: ExportItem | Resolved): Resolved =>
  typeof item === "object" && "prepared" in item ? item : resolveItem(item);

/**
 * Optimised SVG: core's minimal, deterministic output (`currentColor` by default). For a
 * scene, the generator's SVG.
 */
export function toSvg(item: ExportItem | Resolved): string {
  const r = asItem(item);
  return r.scene ?? svgDocument(r.prepared);
}

const INKSCAPE = "http://www.inkscape.org/namespaces/inkscape";

/**
 * Layered SVG: each shape layer is an Inkscape layer (`inkscape:groupmode="layer"`), which
 * Inkscape, Illustrator and Figma show as named layers.
 */
export function toLayeredSvg(item: ExportItem | Resolved): string {
  return svgDocument(asItem(item).prepared, {
    rootAttrs: ` xmlns:inkscape="${INKSCAPE}"`,
    layerAttrs: (layer) =>
      ` id="layer-${escapeXml(layer)}" inkscape:groupmode="layer" inkscape:label="${escapeXml(layer)}"`,
  });
}

/** An inline SVG snippet ready to paste into HTML. */
export function toHtml(item: ExportItem | Resolved): string {
  return `${toSvg(item)}\n`;
}

const SYMBOL_DROP = new Set(["xmlns", "width", "height", "role", "aria-label", "aria-hidden"]);

/**
 * An SVG sprite: one `<symbol id="<prefix><name>">` per item, used with
 * `<svg><use href="sprite.svg#deq-kurdish-sun"/></svg>`.
 */
export function toSprite(items: readonly Resolved[], prefix = "deq-"): string {
  const symbols = items.map((r) => {
    const { attrs, inner } = splitSvg(svgDocument(r.prepared));
    const kept = attrs
      .filter(([k]) => !SYMBOL_DROP.has(k))
      .map(([k, v]) => ` ${k}="${v}"`)
      .join("");
    return `<symbol id="${escapeXml(prefix + r.name)}"${kept}>${inner}</symbol>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:none">${symbols.join("")}</svg>\n`;
}

/** Characters left readable in an SVG data URI; everything else is percent-encoded. */
const URI_KEEP: Readonly<Record<string, string>> = {
  "%20": " ",
  "%3D": "=",
  "%3A": ":",
  "%2F": "/",
  "%2C": ",",
};

/**
 * A `data:image/svg+xml` URI. Double quotes become single quotes (core escapes `'` in
 * values), so the result can sit inside `url("...")` or an HTML attribute.
 */
export function svgDataUri(svg: string, base64 = false): string {
  if (base64) {
    const bytes = new TextEncoder().encode(svg);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return `data:image/svg+xml;base64,${btoa(bin)}`;
  }
  const encoded = encodeURIComponent(svg.replace(/"/g, "'")).replace(
    /%20|%3D|%3A|%2F|%2C/g,
    (m) => URI_KEEP[m] ?? m,
  );
  return `data:image/svg+xml,${encoded}`;
}

/** A data URI of the optimised SVG. */
export function toDataUri(item: ExportItem | Resolved, base64 = false): string {
  return svgDataUri(toSvg(item), base64);
}

const CLASS = /^[a-z][a-z0-9-]{0,63}$/;

/** A CSS class name for `r`, checked so it cannot break out of the rule. */
export function cssClass(r: Resolved, className?: string): string {
  const name = className ?? `deq-${r.name}`;
  if (!CLASS.test(name)) {
    const issue = `className: must match ${String(CLASS)} (got ${JSON.stringify(name.slice(0, 80))})`;
    throw new DeqError("INVALID_OPTIONS", `invalid export options: ${issue}`, [issue]);
  }
  return name;
}

/**
 * A CSS rule that paints the shape as a background image. Images cannot inherit
 * `currentColor`, so set `options.color` (default black).
 */
export function toCssBackground(item: ExportItem | Resolved, className?: string): string {
  const r = asItem(item);
  const uri = svgDataUri(toSvg(r));
  const { width, height } = canvasPixels(r.prepared);
  return `.${cssClass(r, className)} {\n  display: inline-block;\n  width: ${num(width)}px;\n  height: ${num(height)}px;\n  background: url("${uri}") no-repeat center / contain;\n}\n`;
}

/**
 * A CSS rule that uses the shape as a mask over `currentColor`, so it follows the text
 * colour like an icon font.
 */
export function toCssMask(item: ExportItem | Resolved, className?: string): string {
  const r = asItem(item);
  const uri = svgDataUri(toSvg(r));
  const { width, height } = canvasPixels(r.prepared);
  const mask = `url("${uri}") no-repeat center / contain`;
  return `.${cssClass(r, className)} {\n  display: inline-block;\n  width: ${num(width)}px;\n  height: ${num(height)}px;\n  background-color: currentColor;\n  -webkit-mask: ${mask};\n  mask: ${mask};\n}\n`;
}

/**
 * SVG for pasting into Figma (copy as SVG): every layer is a group whose `id` Figma shows
 * as the layer name, and `currentColor` is replaced by concrete colours.
 *
 * @param currentColor - Colour used where the shape inherits `currentColor`. Default black.
 */
export function toFigmaSvg(item: ExportItem | Resolved, currentColor: Rgba = BLACK): string {
  const p = asItem(item).prepared;
  const o = p.options;
  const root = toHex(parseColor(o.color, currentColor));
  const layerHex = (layer: string): string =>
    toHex(parseColor(o.layerColors[layer] ?? o.color, parseColor(o.color, currentColor)));
  const svg = svgDocument(p, { layerAttrs: (layer) => ` id="${escapeXml(layer)}"` });
  // Layer groups are flat (no nested <g>), so each match is one whole layer.
  let withLayers = "";
  let i = 0;
  for (;;) {
    const start = svg.indexOf('<g id="', i);
    const open = start === -1 ? -1 : svg.indexOf(">", start);
    const close = open === -1 ? -1 : svg.indexOf("</g>", open);
    if (close === -1) break;
    const head = /^<g id="([^"]*)" data-layer="([^"]*)"/.exec(svg.slice(start, open));
    withLayers += svg.slice(i, start);
    if (head) {
      const [whole, id = "", layer = ""] = head;
      const c = layerHex(layer);
      const attrs = svg
        .slice(start + whole.length, open)
        .replace(/ color="[^"]*"/, "")
        .replace(/ stroke="currentColor"/, "");
      const inner = svg.slice(open + 1, close).replace(/currentColor/g, c);
      withLayers += `<g id="${id}" stroke="${c}"${attrs}>${inner}</g>`;
    } else {
      withLayers += svg.slice(start, close + 4);
    }
    i = close + 4;
  }
  withLayers += svg.slice(i);
  return withLayers
    .replace(/ color="[^"]*"/, "")
    .replace(/ role="img" aria-label="[^"]*"| aria-hidden="true"/, "")
    .replace(/currentColor/g, root);
}

/**
 * Copy text (for example {@link toFigmaSvg} output) to the clipboard in a browser. Figma
 * pastes SVG markup as editable vectors.
 *
 * @returns false when no clipboard is available (outside a browser or without permission).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const nav = (
    globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }
  ).navigator;
  const write = nav?.clipboard?.writeText;
  if (!write) return false;
  try {
    await write.call(nav.clipboard, text);
    return true;
  } catch {
    return false;
  }
}
