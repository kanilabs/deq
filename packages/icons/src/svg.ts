import { CANVAS, DeqError, escapeXml, num } from "@0xdolan/deq-core";

import type { DeqIcon, IconNode, IconOptions } from "./types.js";

/** Root attribute name and value, in the order core writes them. */
export type Attribute = readonly [name: string, value: string];

const VIEW_BOX = `0 0 ${String(CANVAS)} ${String(CANVAS)}`;

const length = (v: number | string): string => (typeof v === "number" ? num(v) : v);

/**
 * The root `<svg>` attributes for `icon` with `options`, unescaped. With default options
 * the result matches `render(icon.name)` from `@0xdolan/deq-core`. Framework packages
 * use this so every package writes the same markup.
 */
export function rootAttributes(icon: DeqIcon, options: IconOptions = {}): Attribute[] {
  const size = options.size ?? 24;
  const strokeWidth = options.strokeWidth ?? 2;
  const color = options.color ?? "currentColor";
  const title = options.title ?? icon.title;
  const stroke =
    options.absoluteStrokeWidth === true
      ? (Number(strokeWidth) * CANVAS) / Number(size)
      : strokeWidth;
  const attrs: Attribute[] = [
    ["xmlns", "http://www.w3.org/2000/svg"],
    ["width", length(size)],
    ["height", length(size)],
    ["viewBox", VIEW_BOX],
    ["fill", "none"],
    ["stroke", "currentColor"],
    ["stroke-width", length(stroke)],
    ["stroke-linecap", "round"],
    ["stroke-linejoin", "round"],
  ];
  if (color !== "currentColor") attrs.push(["color", color]);
  if (title === "") attrs.push(["aria-hidden", "true"]);
  else attrs.push(["role", "img"], ["aria-label", title]);
  return attrs;
}

/** The child elements of `node` as SVG markup. */
export function nodeMarkup(node: IconNode): string {
  return node
    .map(
      ([tag, attrs]) =>
        `<${tag}${Object.entries(attrs)
          .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
          .join("")}/>`,
    )
    .join("");
}

/** Matches core's colour rule: hex, names, and colour functions with plain arguments. */
const COLOR =
  /^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|[a-zA-Z]{3,32}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([0-9a-zA-Z.,%/\s+-]{1,64}\))$/;
const CSS_LENGTH = /^\d{1,5}(?:\.\d{1,4})?(?:px|em|rem|%|vw|vh|pt)?$/;

function check(options: IconOptions): void {
  const issues: string[] = [];
  const { size, strokeWidth, color, title } = options;
  const positive = (v: number): boolean => Number.isFinite(v) && v > 0;
  if (size !== undefined && !(typeof size === "number" ? positive(size) : CSS_LENGTH.test(size)))
    issues.push("size: must be a positive number or a CSS length");
  if (strokeWidth !== undefined && !positive(Number(strokeWidth)))
    issues.push("strokeWidth: must be a positive number");
  if (options.absoluteStrokeWidth === true && !positive(Number(size ?? 24)))
    issues.push("absoluteStrokeWidth: needs a numeric size");
  if (color !== undefined && (color.length > 80 || !COLOR.test(color)))
    issues.push("color: must be a CSS colour");
  if (title !== undefined && title.length > 256) issues.push("title: at most 256 characters");
  if (issues.length > 0)
    throw new DeqError("INVALID_OPTIONS", `invalid icon options: ${issues.join("; ")}`, issues);
}

/**
 * A standalone SVG document for `icon`. With default options it is byte for byte
 * `render(icon.name)` from `@0xdolan/deq-core`.
 *
 * ```ts
 * import { rojHalfSun, toSvg } from "@0xdolan/deq-icons";
 * toSvg(rojHalfSun, { size: 32, color: "#ED2024" });
 * ```
 *
 * @throws {DeqError} `INVALID_OPTIONS` for a bad size, stroke width, colour or title.
 */
export function toSvg(icon: DeqIcon, options: IconOptions = {}): string {
  check(options);
  const attrs = rootAttributes(icon, options)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");
  const title = options.title ?? icon.title;
  const head = title === "" ? "" : `<title>${escapeXml(title)}</title>`;
  return `<svg${attrs}>${head}${nodeMarkup(icon.node)}</svg>`;
}
