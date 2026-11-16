/** Test helpers: optional external tools (Ghostscript, Inkscape) and tiny file parsers. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function has(cmd: string): boolean {
  try {
    execFileSync(cmd, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** CI sets DEQ_REQUIRE_TOOLS=1 on the job that installs them, so a missing tool fails there. */
const required = process.env["DEQ_REQUIRE_TOOLS"] === "1";

export const hasGs = has("gs") || required;
export const hasInkscape = has("inkscape") || required;

/** Run `fn` in a fresh temporary directory. */
export function inTemp<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "deq-exp-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A grey bitmap (0 black … 255 white). */
export interface Gray {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** Parse a binary PGM (P5) image. */
export function parsePgm(buf: Uint8Array): Gray {
  const head = new TextDecoder("latin1").decode(buf.subarray(0, 256));
  const m = /^P5\s+(?:#[^\n]*\n\s*)*(\d+)\s+(\d+)\s+(\d+)\s/.exec(head);
  if (!m) throw new Error("not a PGM file");
  const width = Number(m[1]);
  const height = Number(m[2]);
  return { width, height, data: buf.subarray(m[0].length, m[0].length + width * height) };
}

/** Render a PDF or EPS page with Ghostscript to greyscale at `px` pixels wide. */
export function gsRender(
  data: Uint8Array | string,
  ext: "pdf" | "eps",
  pagePt: number,
  px: number,
): Gray {
  return inTemp((dir) => {
    const input = join(dir, `in.${ext}`);
    const output = join(dir, "out.pgm");
    writeFileSync(input, data);
    execFileSync("gs", [
      "-q",
      "-dSAFER",
      "-dBATCH",
      "-dNOPAUSE",
      "-sDEVICE=pgmraw",
      `-r${String((72 * px) / pagePt)}`,
      "-dTextAlphaBits=4",
      "-dGraphicsAlphaBits=4",
      ...(ext === "eps" ? ["-dEPSCrop"] : []),
      `-sOutputFile=${output}`,
      input,
    ]);
    return parsePgm(readFileSync(output));
  });
}

/** Mean absolute difference of two grey images of the same size, 0 to 255. */
export function meanDiff(a: Gray, b: Gray): number {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `size ${String(a.width)}x${String(a.height)} != ${String(b.width)}x${String(b.height)}`,
    );
  }
  let sum = 0;
  for (let i = 0; i < a.data.length; i++) sum += Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0));
  return sum / a.data.length;
}

/** Straight RGBA composited on white, as grey. */
export function rgbaToGray(width: number, height: number, rgba: Uint8ClampedArray): Gray {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const a = (rgba[i * 4 + 3] ?? 0) / 255;
    const lum =
      0.299 * (rgba[i * 4] ?? 0) + 0.587 * (rgba[i * 4 + 1] ?? 0) + 0.114 * (rgba[i * 4 + 2] ?? 0);
    data[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return { width, height, data };
}

/** Import a file into Inkscape and return the SVG it produces. */
export function inkscapeToSvg(data: Uint8Array | string, ext: string): string {
  return inTemp((dir) => {
    const input = join(dir, `in.${ext}`);
    const output = join(dir, "out.svg");
    writeFileSync(input, data);
    execFileSync("inkscape", [input, "--export-type=svg", `--export-filename=${output}`], {
      stdio: "ignore",
      env: { ...process.env, HOME: dir },
    });
    return readFileSync(output, "utf8");
  });
}

/** Labels of the Inkscape layers in an SVG. */
export function inkscapeLayers(svg: string): string[] {
  return [...svg.matchAll(/<(?:svg:)?g\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes('inkscape:groupmode="layer"'))
    .map((tag) => /inkscape:label="([^"]*)"/.exec(tag)?.[1] ?? "");
}

/** Decode the PDF objects: offsets in the xref must point at `N 0 obj`. */
export function pdfObjects(bytes: Uint8Array): string[] {
  const s = new TextDecoder("latin1").decode(bytes);
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(s)?.[1]);
  const xref = s.slice(startxref);
  const m = /^xref\n0 (\d+)\n/.exec(xref);
  if (!m) throw new Error("no xref");
  const count = Number(m[1]);
  const entries = xref.slice(m[0].length).split("\n").slice(0, count);
  return entries.slice(1).map((e, i) => {
    const off = Number(e.slice(0, 10));
    const head = `${String(i + 1)} 0 obj\n`;
    if (s.slice(off, off + head.length) !== head)
      throw new Error(`bad offset for object ${String(i + 1)}`);
    return s.slice(off + head.length, s.indexOf("\nendobj\n", off));
  });
}

/** Decode a `<FEFF…>` UTF-16BE PDF string. */
export function pdfHexText(text: string): string {
  const hex = text.replace(/[<>]/g, "");
  const units: number[] = [];
  for (let i = 4; i < hex.length; i += 4) units.push(Number.parseInt(hex.slice(i, i + 4), 16));
  return String.fromCharCode(...units);
}

/** Share of pixels whose ink coverage (darker than mid grey) differs: ignores tone and anti-aliasing. */
export function inkDiff(a: Gray, b: Gray, threshold = 160): number {
  meanDiff(a, b);
  let n = 0;
  for (let i = 0; i < a.data.length; i++) {
    if ((a.data[i] ?? 0) < threshold !== (b.data[i] ?? 0) < threshold) n++;
  }
  return n / a.data.length;
}
