/**
 * A small, deterministic PDF 1.7 writer for Deq drawings (ADR 0009). Layers become
 * Optional Content Groups, so PDF viewers, Inkscape and Illustrator show them as layers.
 * The `.ai` exporter writes the same PDF, which Illustrator opens natively.
 */
import { num } from "@0xdolan/deq-core";

import { toCmyk } from "./color.js";
import type { Rgba } from "./color.js";
import type { DrawOp, Drawing, Matrix, PathCmd } from "./drawing.js";

/** PDF/EPS colour model for paints. */
export type ColorSpace = "rgb" | "cmyk";

export interface PdfOptions {
  /** Device colour space. CMYK uses a naive conversion without an ICC profile. */
  readonly colorSpace?: ColorSpace;
  /** Put each shape layer in its own Optional Content Group. Default true. */
  readonly layers?: boolean;
  /** `/Creator` in the document info. */
  readonly creator?: string;
}

const n = (x: number): string => num(x);

export function matrixOp(m: Matrix): string {
  return m.map(n).join(" ");
}

export function pathOps(
  path: readonly PathCmd[],
  ops: { m: string; l: string; c: string; h: string },
): string {
  return path
    .map((cmd) => {
      switch (cmd[0]) {
        case "m":
          return `${n(cmd[1])} ${n(cmd[2])} ${ops.m}`;
        case "l":
          return `${n(cmd[1])} ${n(cmd[2])} ${ops.l}`;
        case "c":
          return `${cmd
            .slice(1)
            .map((v) => n(v as number))
            .join(" ")} ${ops.c}`;
        case "h":
          return ops.h;
      }
    })
    .join("\n");
}

function colorOp(c: Rgba, space: ColorSpace, stroke: boolean): string {
  if (space === "cmyk") return `${toCmyk(c).map(n).join(" ")} ${stroke ? "K" : "k"}`;
  return `${n(c[0])} ${n(c[1])} ${n(c[2])} ${stroke ? "RG" : "rg"}`;
}

/** A PDF text string as UTF-16BE hex, safe for any title. */
function pdfText(s: string): string {
  let hex = "FEFF";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    const units =
      cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp];
    for (const u of units) hex += u.toString(16).toUpperCase().padStart(4, "0");
  }
  return `<${hex}>`;
}

/** Content stream and the alpha states it uses. */
function content(
  d: Drawing,
  space: ColorSpace,
  layered: boolean,
): { stream: string; alphas: string[] } {
  const alphas: string[] = ["1 1"];
  let current = "1 1";
  const lines: string[] = [];
  const gs = (strokeA: number, fillA: number): void => {
    const key = `${n(strokeA)} ${n(fillA)}`;
    if (key === current) return;
    let i = alphas.indexOf(key);
    if (i < 0) i = alphas.push(key) - 1;
    lines.push(`/GS${String(i)} gs`);
    current = key;
  };
  const paint = (op: DrawOp): void => {
    gs(op.stroke?.[3] ?? 1, op.fill?.[3] ?? 1);
    if (op.fill) lines.push(colorOp(op.fill, space, false));
    if (op.stroke) lines.push(colorOp(op.stroke, space, true));
    lines.push(pathOps(op.path, { m: "m", l: "l", c: "c", h: "h" }));
    lines.push(op.fill && op.stroke ? "B" : op.fill ? "f" : "S");
  };

  lines.push("q", `${matrixOp(d.base)} cm`);
  lines.push(`${n(d.lineWidth)} w ${String(d.linecap)} J ${String(d.linejoin)} j 4 M`);
  if (d.background) {
    if (layered) lines.push("/OC /OCbg BDC");
    paint(d.background);
    if (layered) lines.push("EMC");
  }
  lines.push("q");
  for (const t of d.transforms) lines.push(`${matrixOp(t)} cm`);
  d.layers.forEach((layer, i) => {
    if (layered) lines.push(`/OC /OC${String(i)} BDC`);
    for (const op of layer.ops) paint(op);
    if (layered) lines.push("EMC");
  });
  lines.push("Q", "Q");
  return { stream: `${lines.join("\n")}\n`, alphas };
}

/** Serialise objects with a correct cross-reference table. All content is ASCII. */
function serialise(objects: readonly string[], rootRef: number, infoRef: number): Uint8Array {
  let out = "%PDF-1.7\n%âãÏÓ\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${String(i + 1)} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${String(objects.length + 1)} /Root ${String(rootRef)} 0 R /Info ${String(infoRef)} 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`;
  // Every character is below U+0100, so Latin-1 bytes keep the offsets exact.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
  return bytes;
}

/** Write a one-page PDF for a drawing. */
export function writePdf(d: Drawing, options: PdfOptions = {}): Uint8Array {
  const space = options.colorSpace ?? "rgb";
  const layered = options.layers ?? true;
  const { stream, alphas } = content(d, space, layered);

  // Object numbers: 1 catalog, 2 pages, 3 page, 4 content, 5 info, then OCGs.
  const ocgNames = layered
    ? [...(d.background ? ["background"] : []), ...d.layers.map((l) => l.id)]
    : [];
  const ocgRef = (i: number): number => 6 + i;
  const ocgRefs = ocgNames.map((_, i) => `${String(ocgRef(i))} 0 R`).join(" ");
  const ocProps = layered
    ? ` /OCProperties << /OCGs [${ocgRefs}] /D << /Name ${pdfText("Layers")} /Order [${ocgRefs}] /ON [${ocgRefs}] /OFF [] >> >> /PageMode /UseOC`
    : "";
  const props = layered
    ? ` /Properties << ${ocgNames
        .map((_, i) => {
          const isBg = d.background !== undefined && i === 0;
          const key = isBg ? "OCbg" : `OC${String(i - (d.background ? 1 : 0))}`;
          return `/${key} ${String(ocgRef(i))} 0 R`;
        })
        .join(" ")} >>`
    : "";
  const extG = alphas
    .map((a, i) => {
      const [ca, fa] = a.split(" ");
      return `/GS${String(i)} << /Type /ExtGState /CA ${ca ?? "1"} /ca ${fa ?? "1"} >>`;
    })
    .join(" ");
  const box = `[0 0 ${n(d.width)} ${n(d.height)}]`;
  const creator = options.creator ?? "Deq";
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R${ocProps} >>`,
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox ${box} /Resources << /ExtGState << ${extG} >>${props} >> /Contents 4 0 R >>`,
    `<< /Length ${String(stream.length)} >>\nstream\n${stream}endstream`,
    `<< /Title ${pdfText(d.title)} /Creator ${pdfText(creator)} /Producer (@0xdolan/deq-exporters) >>`,
    ...ocgNames.map((name) => `<< /Type /OCG /Name ${pdfText(name)} >>`),
  ];
  return serialise(objects, 1, 5);
}
