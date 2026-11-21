/** The Kurdish flag (`spec/flag.json`) as a standalone SVG, in each of its variants. */
import * as v from "valibot";

import { DeqError } from "./errors.js";
import { escapeXml, num, roundHalfEven } from "./format.js";
import { FLAG } from "./generated/flag.js";
import { starPoints } from "./geometry.js";
import { issueLines } from "./options.js";

/** One flag variant with its paint resolved to colours (`null` = not drawn). */
export interface FlagVariant {
  readonly id: string;
  readonly description: string;
  /** Visible part of the 900 x 600 field: left edge and width. */
  readonly crop: readonly [number, number];
  readonly field: string | null;
  /** Paint the red, white and green bands. */
  readonly bands: boolean;
  readonly dividers: string | null;
  readonly frame: string | null;
  readonly sun: string | null;
  readonly sunOutline: string | null;
  /** Width of frame, divider and outline strokes, in field units. */
  readonly strokeWidth: number;
}

/** The render-relevant part of `spec/flag.json`. */
export interface FlagData {
  readonly name: string;
  readonly viewBox: readonly [number, number];
  readonly bands: readonly {
    readonly y: number;
    readonly height: number;
    readonly color: string;
  }[];
  readonly sun: {
    readonly rays: number;
    readonly rotation: number;
    readonly center: readonly [number, number];
    readonly outerRadius: number;
    readonly innerRadius: number;
  };
  readonly variants: readonly FlagVariant[];
}

/** Options of {@link renderFlag}. */
export interface FlagOptions {
  /** Variant id from `spec/flag.json`. Default `full-color`. */
  readonly variant?: string;
  /** Output width in px (an integer); the height follows the aspect ratio. Default 900. */
  readonly width?: number;
  /** Accessible title. Default "Flag of Kurdistan". `""` marks the image decorative. */
  readonly title?: string;
}

const FlagOptionsSchema = v.strictObject({
  variant: v.optional(v.pipe(v.string(), v.maxLength(64))),
  width: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8192))),
  title: v.optional(v.pipe(v.string(), v.maxLength(256))),
});

/** Variant ids in spec order. */
export function listFlagVariants(): readonly string[] {
  return FLAG.variants.map((x) => x.id);
}

function invalid(lines: string[]): never {
  throw new DeqError("INVALID_OPTIONS", `invalid flag options: ${lines.join("; ")}`, lines);
}

/** The pixel size of the flag at `width` px for a variant. */
export function flagSize(variant: FlagVariant, width: number): [number, number] {
  return [width, Math.max(1, roundHalfEven((width * FLAG.viewBox[1]) / variant.crop[1]))];
}

/**
 * Render the Kurdish flag as a standalone SVG string.
 *
 * ```ts
 * renderFlag({ variant: "outline", width: 300 });
 * ```
 *
 * @throws {DeqError} `INVALID_OPTIONS` for an unknown variant or a bad width.
 */
export function renderFlag(options: FlagOptions = {}): string {
  const result = v.safeParse(FlagOptionsSchema, options);
  if (!result.success) invalid(issueLines(result.issues));
  const o = result.output;
  const id = o.variant ?? "full-color";
  const variant = FLAG.variants.find((x) => x.id === id);
  if (!variant) {
    invalid([
      `variant: must be one of ${listFlagVariants().join(", ")} (got ${JSON.stringify(id.slice(0, 64))})`,
    ]);
  }
  const [width, height] = flagSize(variant, o.width ?? 900);
  const [x0, w] = variant.crop;
  const h = FLAG.viewBox[1];
  const sw = variant.strokeWidth;
  const title = o.title ?? FLAG.name;
  const a11y =
    title === "" ? ' aria-hidden="true"' : ` role="img" aria-label="${escapeXml(title)}"`;
  const stroke = (c: string): string => ` fill="none" stroke="${c}" stroke-width="${num(sw)}"`;
  const rect = (y: number, height_: number, fill: string): string =>
    `<rect x="${num(x0)}" y="${num(y)}" width="${num(w)}" height="${num(height_)}" fill="${fill}"/>`;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" viewBox="${num(x0)} 0 ${num(w)} ${num(h)}"${a11y}>`;
  if (title !== "") out += `<title>${escapeXml(title)}</title>`;
  if (variant.field !== null) out += rect(0, h, variant.field);
  if (variant.bands) for (const b of FLAG.bands) out += rect(b.y, b.height, b.color);
  const { center, rays, outerRadius, innerRadius, rotation } = FLAG.sun;
  const points = starPoints(center[0], center[1], rays, outerRadius, innerRadius, rotation)
    .map(([x, y]) => `${num(x)},${num(y)}`)
    .join(" ");
  if (variant.sun !== null) out += `<polygon points="${points}" fill="${variant.sun}"/>`;
  if (variant.sunOutline !== null) {
    out += `<polygon points="${points}"${stroke(variant.sunOutline)} stroke-linejoin="round"/>`;
  }
  if (variant.dividers !== null) {
    const d = FLAG.bands
      .filter((b) => b.y > 0)
      .map((b) => `M${num(x0)} ${num(b.y)}H${num(x0 + w)}`)
      .join("");
    out += `<path d="${d}"${stroke(variant.dividers)}/>`;
  }
  if (variant.frame !== null) {
    out += `<rect x="${num(x0 + sw / 2)}" y="${num(sw / 2)}" width="${num(w - sw)}" height="${num(h - sw)}"${stroke(variant.frame)}/>`;
  }
  return `${out}</svg>`;
}
