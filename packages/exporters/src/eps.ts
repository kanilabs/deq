/**
 * Encapsulated PostScript (EPSF-3.0) for print workflows. PostScript has no transparency,
 * so colour alpha and opacity are ignored (documented in the exporters README).
 */
import { num } from "@0xdolan/deq-core";

import { toCmyk } from "./color.js";
import type { Rgba } from "./color.js";
import type { DrawOp, Drawing } from "./drawing.js";
import type { ColorSpace } from "./pdf.js";
import { matrixOp, pathOps } from "./pdf.js";

export interface EpsOptions {
  readonly colorSpace?: ColorSpace;
}

/** DSC comment text: printable ASCII only, without parentheses or backslashes. */
const dscText = (s: string): string => s.replace(/[^\x20-\x7e]|[()\\]/g, "?").slice(0, 200);

function colorOp(c: Rgba, space: ColorSpace): string {
  return space === "cmyk"
    ? `${toCmyk(c).map(num).join(" ")} setcmykcolor`
    : `${num(c[0])} ${num(c[1])} ${num(c[2])} setrgbcolor`;
}

/** Write an EPS file for a drawing. */
export function writeEps(d: Drawing, options: EpsOptions = {}): string {
  const space = options.colorSpace ?? "rgb";
  const lines: string[] = [];
  const paint = (op: DrawOp): void => {
    lines.push(
      "newpath",
      pathOps(op.path, { m: "moveto", l: "lineto", c: "curveto", h: "closepath" }),
    );
    if (op.fill && op.stroke) {
      lines.push(
        `gsave ${colorOp(op.fill, space)} fill grestore`,
        `${colorOp(op.stroke, space)} stroke`,
      );
    } else if (op.fill) {
      lines.push(`${colorOp(op.fill, space)} fill`);
    } else if (op.stroke) {
      lines.push(`${colorOp(op.stroke, space)} stroke`);
    }
  };

  lines.push("gsave", `[${matrixOp(d.base)}] concat`);
  lines.push(
    `${num(d.lineWidth)} setlinewidth ${String(d.linecap)} setlinecap ${String(d.linejoin)} setlinejoin 4 setmiterlimit`,
  );
  if (d.background) paint(d.background);
  lines.push("gsave");
  for (const t of d.transforms) lines.push(`[${matrixOp(t)}] concat`);
  for (const layer of d.layers) {
    lines.push(`% layer: ${dscText(layer.id)}`);
    for (const op of layer.ops) paint(op);
  }
  lines.push("grestore", "grestore");

  const w = Math.ceil(d.width);
  const h = Math.ceil(d.height);
  return [
    "%!PS-Adobe-3.0 EPSF-3.0",
    `%%BoundingBox: 0 0 ${String(w)} ${String(h)}`,
    `%%HiResBoundingBox: 0 0 ${num(d.width)} ${num(d.height)}`,
    `%%Title: ${dscText(d.title)}`,
    "%%Creator: @0xdolan/deq-exporters",
    "%%LanguageLevel: 2",
    "%%Pages: 1",
    "%%EndComments",
    "%%Page: 1 1",
    ...lines,
    "showpage",
    "%%EOF",
    "",
  ].join("\n");
}
