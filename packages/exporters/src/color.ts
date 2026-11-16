/**
 * CSS colour parsing for formats that need numbers (PDF, EPS, JPG matte, favicons).
 * Accepts everything core's option validation accepts: hex, named colours, `transparent`,
 * `currentColor`, and rgb/hsl/hwb/lab/lch/oklab/oklch with plain numeric arguments.
 */
import { DeqError } from "@0xdolan/deq-core";

import { NAMED_COLORS } from "./named-colors.js";

/** Red, green, blue and alpha, each 0 to 1 (sRGB, not premultiplied). */
export type Rgba = readonly [number, number, number, number];

/** Opaque black, the default for `currentColor` outside a browser. */
export const BLACK: Rgba = [0, 0, 0, 1];

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

function fail(input: string): never {
  const issue = `color: cannot convert ${JSON.stringify(input.slice(0, 80))} to RGB`;
  throw new DeqError("INVALID_OPTIONS", `invalid colour: ${issue}`, [issue]);
}

function hex(h: string, input: string): Rgba {
  // Short forms #rgb and #rgba double each (ASCII hex) digit.
  const full = h.length <= 4 ? h.replace(/./g, "$&$&") : h;
  const n = (i: number): number => Number.parseInt(full.slice(i, i + 2), 16) / 255;
  if (!/^[0-9a-f]+$/i.test(full) || (full.length !== 6 && full.length !== 8)) fail(input);
  return [n(0), n(2), n(4), full.length === 8 ? n(6) : 1];
}

/** One numeric argument: a number or a percentage, `none` is 0. */
function arg(token: string | undefined, percentScale: number, input: string): number {
  if (token === undefined) fail(input);
  if (token === "none") return 0;
  const m = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(%|deg|turn|rad|grad)?$/i.exec(token);
  if (!m) fail(input);
  const value = Number(m[1]);
  switch (m[2]?.toLowerCase()) {
    case "%":
      return (value / 100) * percentScale;
    case "turn":
      return value * 360;
    case "rad":
      return (value * 180) / Math.PI;
    case "grad":
      return value * 0.9;
    default:
      return value;
  }
}

const srgbGamma = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

function fromLinear(r: number, g: number, b: number, a: number): Rgba {
  return [clamp01(srgbGamma(r)), clamp01(srgbGamma(g)), clamp01(srgbGamma(b)), clamp01(a)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function labToRgb(l: number, a: number, b: number, alpha: number): Rgba {
  // CIE Lab (D50) -> XYZ D50 -> Bradford to D65 -> linear sRGB (CSS Color 4 matrices).
  const e = 216 / 24389;
  const k = 24389 / 27;
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t: number): number => (t ** 3 > e ? t ** 3 : (116 * t - 16) / k);
  const x = inv(fx) * (0.3457 / 0.3585);
  const y = l > k * e ? fy ** 3 : l / k;
  const z = inv(fz) * ((1 - 0.3457 - 0.3585) / 0.3585);
  const X = 0.955473421488075 * x - 0.02309845494876471 * y + 0.06325924320057072 * z;
  const Y = -0.0283697093338637 * x + 1.0099953980813041 * y + 0.021041441191917323 * z;
  const Z = 0.012314014864481998 * x - 0.020507649298898964 * y + 1.330365926242124 * z;
  return fromLinear(
    3.2409699419045226 * X - 1.537383177570094 * Y - 0.4986107602930034 * Z,
    -0.9692436362808796 * X + 1.8759675015077202 * Y + 0.04155505740717559 * Z,
    0.05563007969699366 * X - 0.20397695888897652 * Y + 1.0569715142428786 * Z,
    alpha,
  );
}

function oklabToRgb(l: number, a: number, b: number, alpha: number): Rgba {
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return fromLinear(
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
    alpha,
  );
}

const polar = (c: number, h: number): [number, number] => [
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
];

function func(name: string, body: string, input: string): Rgba {
  // Both the legacy comma syntax and the modern space syntax with "/ alpha".
  const [main = "", alphaPart, extra] = body.split("/");
  if (extra !== undefined) fail(input);
  let parts = main
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)
    .filter((p) => p !== "");
  let alphaToken = alphaPart?.trim();
  if (alphaToken === undefined && parts.length === 4) {
    alphaToken = parts[3];
    parts = parts.slice(0, 3);
  }
  if (parts.length !== 3) fail(input);
  const alpha = alphaToken === undefined ? 1 : clamp01(arg(alphaToken, 1, input));
  const [p0, p1, p2] = parts;
  switch (name) {
    case "rgb":
    case "rgba":
      return [
        clamp01(arg(p0, 255, input) / 255),
        clamp01(arg(p1, 255, input) / 255),
        clamp01(arg(p2, 255, input) / 255),
        alpha,
      ];
    case "hsl":
    case "hsla": {
      const [r, g, b] = hslToRgb(
        ((arg(p0, 360, input) % 360) + 360) % 360,
        clamp01(arg(p1, 100, input) / 100),
        clamp01(arg(p2, 100, input) / 100),
      );
      return [r, g, b, alpha];
    }
    case "hwb": {
      let w = clamp01(arg(p1, 100, input) / 100);
      let k = clamp01(arg(p2, 100, input) / 100);
      if (w + k > 1) {
        const sum = w + k;
        w /= sum;
        k /= sum;
      }
      const base = hslToRgb(((arg(p0, 360, input) % 360) + 360) % 360, 1, 0.5);
      const [r, g, b] = base.map((c) => c * (1 - w - k) + w) as [number, number, number];
      return [r, g, b, alpha];
    }
    case "lab":
      return labToRgb(arg(p0, 100, input), arg(p1, 125, input), arg(p2, 125, input), alpha);
    case "lch":
      return labToRgb(
        arg(p0, 100, input),
        ...polar(arg(p1, 150, input), arg(p2, 360, input)),
        alpha,
      );
    case "oklab":
      return oklabToRgb(arg(p0, 1, input), arg(p1, 0.4, input), arg(p2, 0.4, input), alpha);
    case "oklch":
      return oklabToRgb(
        arg(p0, 1, input),
        ...polar(arg(p1, 0.4, input), arg(p2, 360, input)),
        alpha,
      );
    default:
      return fail(input);
  }
}

/**
 * Parse a CSS colour. `currentColor` resolves to `current`.
 *
 * @throws {DeqError} `INVALID_OPTIONS` when the colour cannot be converted.
 */
export function parseColor(input: string, current: Rgba = BLACK): Rgba {
  const s = input.trim().toLowerCase();
  if (s === "currentcolor") return current;
  if (s === "transparent") return [0, 0, 0, 0];
  if (s.startsWith("#")) return hex(s.slice(1), input);
  const named = NAMED_COLORS.get(s);
  if (named !== undefined) return hex(named, input);
  const m = /^([a-z]+)\((.*)\)$/.exec(s);
  if (!m || (m[2] ?? "").length > 64) fail(input);
  return func(m[1] ?? "", m[2] ?? "", input);
}

const byte = (c: number): string =>
  Math.round(clamp01(c) * 255)
    .toString(16)
    .padStart(2, "0");

/** `#rrggbb`, or `#rrggbbaa` when not opaque. */
export function toHex([r, g, b, a]: Rgba): string {
  return `#${byte(r)}${byte(g)}${byte(b)}${a < 1 ? byte(a) : ""}`;
}

/** Naive device CMYK (no ICC profile): `k = 1 - max(r, g, b)`. */
export function toCmyk([r, g, b]: Rgba): [number, number, number, number] {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
}
