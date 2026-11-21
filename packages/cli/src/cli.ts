/**
 * The `deq` commands (ADR 0011). `main` never exits the process: it returns the exit
 * code, so tests can run it in-process against a temporary directory.
 */
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

import { DeqError, getShape, listCategories, listShapes, renderFlag } from "@0xdolan/deq-core";
import type { ParamValue, RenderOptions, ShapeData } from "@0xdolan/deq-core";
import { encodeSvg, exportShapes, parseColor, toHex } from "@0xdolan/deq-exporters";
import type { ExportFormat, ExportOptions } from "@0xdolan/deq-exporters";
import { decodeLeet, leet, pattern } from "@0xdolan/deq-generator";

import { CLI } from "./generated/cli.js";
import { UsageError, parseArgs } from "./parse.js";
import type { FlagValue } from "./parse.js";
import type { CliData, Command } from "./types.js";
import { MAX_SPEC_BYTES, validateSpec } from "./validate.js";

/** Where `main` reads and writes. */
export interface Io {
  /** Directory relative paths resolve against. */
  readonly cwd: string;
  readonly stdout: (data: string | Uint8Array) => void;
  readonly stderr: (text: string) => void;
}

/** A file could not be read or written: exit code 3. */
export class IoError extends Error {}

/** One output file. */
interface OutFile {
  readonly name: string;
  readonly data: string | Uint8Array;
}

type Flags = ReadonlyMap<string, FlagValue>;

const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

/** `--param` values: `true`/`false` are booleans, decimal numbers are numbers. */
export function paramValue(raw: string): ParamValue {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return NUMBER.test(raw) ? Number(raw) : raw;
}

/** `dir` + separator + `name`, without normalising what the user typed. */
export function joinPath(dir: string, ...names: string[]): string {
  let out = dir;
  for (const name of names) out = /[/\\]$/.test(out) ? `${out}${name}` : `${out}${sep}${name}`;
  return out;
}

function lstat(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

/** Collect the render options of a command from its flags. */
function renderOptions(command: Command, flags: Flags): RenderOptions {
  const o: Record<string, unknown> = {};
  for (const f of command.flags) {
    const value = flags.get(f.name);
    if (f.option === undefined || value === undefined) continue;
    if (f.type === "pair") {
      const pairs = value as readonly [string, string][];
      o[f.option] = Object.fromEntries(
        pairs.map(([k, v]) => [k, f.option === "params" ? paramValue(v) : v]),
      );
    } else {
      o[f.option] = value;
    }
  }
  return o;
}

function exportOptions(command: Command, flags: Flags): ExportOptions {
  const str = (k: string): string | undefined => flags.get(k) as string | undefined;
  const quality = flags.get("quality") as number | undefined;
  const current = str("current-color");
  const matte = str("matte");
  return {
    render: renderOptions(command, flags),
    ...(current === undefined ? {} : { currentColor: current }),
    ...(matte === undefined ? {} : { matte }),
    ...(quality === undefined ? {} : { quality }),
  };
}

/** A path to write and how to show it. */
interface Target {
  readonly display: string;
  readonly path: string;
  readonly data: string | Uint8Array;
}

/**
 * Where `files` go for `--out`: stdout for `-`, a file path for one file (unless it names an
 * existing directory or ends with a separator), otherwise a directory.
 */
function targets(io: Io, files: readonly OutFile[], out: string | undefined): Target[] | "stdout" {
  if (out === "-") return "stdout";
  if (out === undefined) {
    return files.map((f) => ({ display: f.name, path: resolve(io.cwd, f.name), data: f.data }));
  }
  const asDir =
    files.length !== 1 || /[/\\]$/.test(out) || lstat(resolve(io.cwd, out))?.isDirectory() === true;
  if (!asDir) {
    const [only] = files as [OutFile];
    return [{ display: out, path: resolve(io.cwd, out), data: only.data }];
  }
  return files.map((f) => {
    const display = joinPath(out, f.name);
    return { display, path: resolve(io.cwd, display), data: f.data };
  });
}

/** Write every target, refusing to overwrite (or to follow links) before writing any. */
function writeAll(list: readonly Target[], force: boolean): void {
  for (const t of list) {
    const st = lstat(t.path);
    if (st === undefined) continue;
    if (!force) throw new IoError(`${t.display} exists; use --force to overwrite`);
    if (!st.isFile()) throw new IoError(`${t.display} is not a regular file`);
  }
  for (const t of list) {
    try {
      mkdirSync(dirname(t.path), { recursive: true });
      writeFileSync(t.path, t.data);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "error";
      throw new IoError(`cannot write ${t.display}: ${code}`);
    }
  }
}

function emit(io: Io, command: string, files: readonly OutFile[], flags: Flags): void {
  const out = flags.get("out") as string | undefined;
  const list = targets(io, files, out);
  if (list === "stdout") {
    const [only] = files;
    if (!only || files.length > 1) {
      throw new UsageError(
        `--out - writes one file, but this makes ${String(files.length)}`,
        command,
      );
    }
    io.stdout(only.data);
    return;
  }
  writeAll(list, flags.get("force") === true);
}

// ---------------------------------------------------------------- commands

function list(io: Io, flags: Flags): void {
  const category = flags.get("category") as string | undefined;
  if (category !== undefined && !listCategories().includes(category)) {
    const issue = `unknown category "${category}" (known: ${listCategories().join(", ")})`;
    throw new DeqError("INVALID_OPTIONS", issue, [issue]);
  }
  const shapes = listShapes(category);
  if (flags.get("json") === true) {
    const rows = shapes.map((s) => ({ id: s.id, category: s.category, name: s.names.en }));
    io.stdout(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  const w1 = Math.max(...shapes.map((s) => s.id.length));
  const w2 = Math.max(...shapes.map((s) => s.category.length));
  io.stdout(
    shapes.map((s) => `${s.id.padEnd(w1)}  ${s.category.padEnd(w2)}  ${s.names.en}\n`).join(""),
  );
}

/** The metadata of a shape, without its geometry. */
export function shapeInfo(s: ShapeData): Omit<ShapeData, "primitives"> {
  return {
    id: s.id,
    version: s.version,
    category: s.category,
    names: s.names,
    aliases: s.aliases,
    tags: s.tags,
    layers: s.layers,
    symmetry: s.symmetry,
    parameters: s.parameters,
  };
}

function info(io: Io, id: string, flags: Flags): void {
  const s = getShape(id);
  if (flags.get("json") === true) {
    io.stdout(`${JSON.stringify(shapeInfo(s), null, 2)}\n`);
    return;
  }
  const words = (a: readonly string[]): string => (a.length === 0 ? "-" : a.join(", "));
  const kurdish = (k: ShapeData["names"]["ckb"]): string => `${k.text ?? "-"} (${k.status})`;
  const lines = [
    `${s.id}  ${s.names.en}`,
    `Category:    ${s.category}`,
    `Sorani:      ${kurdish(s.names.ckb)}`,
    `Kurmanji:    ${kurdish(s.names.kmr)}`,
    `Aliases:     ${words(s.aliases)}`,
    `Tags:        ${words(s.tags)}`,
    `Layers:      ${words(s.layers)}`,
    `Symmetry:    ${s.symmetry}`,
  ];
  const params = Object.entries(s.parameters);
  if (params.length === 0) lines.push("Parameters:  -");
  else {
    lines.push("Parameters:");
    const w = Math.max(...params.map(([n]) => n.length));
    for (const [n, p] of params) {
      const kind =
        p.type === "integer"
          ? `integer ${String(p.min)} to ${String(p.max)}`
          : p.type === "enum"
            ? `enum ${p.values.join("|")}`
            : "boolean";
      lines.push(`  ${n.padEnd(w)}  ${kind}, default ${String(p.default)}: ${p.description}`);
    }
  }
  io.stdout(`${lines.join("\n")}\n`);
}

async function render(
  io: Io,
  command: Command,
  ids: readonly string[],
  flags: Flags,
): Promise<void> {
  let format = flags.get("format") as string | undefined;
  if (flags.get("layered") === true) {
    if (format !== undefined && format !== "svg") {
      throw new UsageError("--layered only works with --format svg", command.name);
    }
    format = "svg-layered";
  }
  const options = exportOptions(command, flags);
  const files = await exportShapes((format ?? "svg") as ExportFormat, ids, options);
  emit(io, command.name, files, flags);
}

async function exportCommand(
  io: Io,
  command: Command,
  ids: readonly string[],
  flags: Flags,
): Promise<void> {
  const all = flags.get("all") === true;
  if (all && ids.length > 0)
    throw new UsageError("give shape ids or --all, not both", command.name);
  if (!all && ids.length === 0) throw new UsageError("give shape ids or --all", command.name);
  const out = (flags.get("out") as string | undefined) ?? ".";
  if (out === "-")
    throw new UsageError("export writes files; --out - is not supported", command.name);
  const items = all ? listShapes().map((s) => s.id) : ids;
  const formats = (flags.get("format") as string[] | undefined) ?? ["svg"];
  const sizes = (flags.get("sizes") as number[] | undefined) ?? [24];
  const base = exportOptions(command, flags);
  const list: Target[] = [];
  for (const format of formats) {
    for (const size of sizes) {
      const files = await exportShapes(format as ExportFormat, items, {
        ...base,
        render: { ...base.render, size },
      });
      for (const f of files) {
        const display = joinPath(out, format, String(size), f.name);
        list.push({ display, path: resolve(io.cwd, display), data: f.data });
      }
    }
  }
  writeAll(list, flags.get("force") === true);
}

/** Largest raster image side, in px. */
export const MAX_PX = 8192;
/** Largest SVG `deq leet --decode` reads, in bytes. */
export const MAX_DECODE_BYTES = 4 * 1024 * 1024;

/** `svg` as a raster image `width` px wide, with currentColor made concrete. */
async function raster(svg: string, width: number, format: string, flags: Flags, what: string) {
  const quality = flags.get("quality") as number | undefined;
  if (quality !== undefined && (quality < 0 || quality > 100)) {
    const issue = `quality: must be 0 to 100 (got ${String(quality)})`;
    throw new DeqError("INVALID_OPTIONS", `invalid ${what} options: ${issue}`, [issue]);
  }
  const current = toHex(
    parseColor((flags.get("current-color") as string | undefined) ?? "#000000"),
  );
  const matte = parseColor((flags.get("matte") as string | undefined) ?? "#ffffff");
  return encodeSvg(svg.replaceAll("currentColor", current), width, format as "png", {
    matte,
    ...(quality === undefined ? {} : { quality }),
  });
}

/** The flag file for `deq flag`, with currentColor made concrete for raster formats. */
export async function flagFile(flags: Flags): Promise<OutFile> {
  const variant = (flags.get("variant") as string | undefined) ?? "full-color";
  const width = (flags.get("width") as number | undefined) ?? 900;
  const format = (flags.get("format") as string | undefined) ?? "svg";
  const title = flags.get("title") as string | undefined;
  const svg = renderFlag({ variant, width, ...(title === undefined ? {} : { title }) });
  const name = `kurdish-flag-${variant}.${format}`;
  if (format === "svg") return { name, data: `${svg}\n` };
  return { name, data: await raster(svg, width, format, flags, "flag") };
}

const SVG_SIZE = /^<svg [^>]*? width="([0-9.]+)" height="([0-9.]+)"/u;

/** A scene (Leet text or pattern) as `<stem>.<format>`; images are as wide as the SVG in px. */
export async function sceneFile(stem: string, svg: string, flags: Flags): Promise<OutFile> {
  const format = (flags.get("format") as string | undefined) ?? "svg";
  const name = `${stem}.${format}`;
  if (format === "svg") return { name, data: `${svg}\n` };
  const m = SVG_SIZE.exec(svg);
  const w = Math.max(1, Math.round(Number(m?.[1] ?? "24")));
  const h = Math.max(1, Math.round(Number(m?.[2] ?? "24")));
  if (w > MAX_PX || h > MAX_PX) {
    const size = `${String(w)} x ${String(h)}`;
    throw new DeqError(
      "LIMIT_EXCEEDED",
      `the image would be ${size} px; the largest is ${String(MAX_PX)} x ${String(MAX_PX)} (lower --size)`,
    );
  }
  return { name, data: await raster(svg, w, format, flags, "scene") };
}

/** Flags that `deq leet --decode` refuses, in the order they are checked. */
const NOT_WITH_DECODE = [
  "format",
  "out",
  "force",
  "level",
  "script",
  "seed",
  "letter-spacing",
  "line-spacing",
  "align",
  "colors",
  "current-color",
  "matte",
  "quality",
];

/** `U+XXXX` for each character. */
function codePoints(chars: readonly string[]): string {
  return chars
    .map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join(", ");
}

async function leetCommand(
  io: Io,
  command: Command,
  text: string | undefined,
  flags: Flags,
): Promise<void> {
  const decode = flags.get("decode") as string | undefined;
  if (decode !== undefined) {
    if (text !== undefined) throw new UsageError("give text or --decode, not both", command.name);
    const bad = NOT_WITH_DECODE.find((n) => flags.has(n));
    if (bad !== undefined) {
      throw new UsageError(`--decode cannot be combined with --${bad}`, command.name);
    }
    const out = decodeLeet(readText(io, decode, MAX_DECODE_BYTES), renderOptions(command, flags));
    if (out.unmatched > 0) {
      io.stderr(
        `deq: warning: ${String(out.unmatched)} glyphs could not be read (shown as U+FFFD); pass the render flags used to write the file\n`,
      );
    }
    io.stdout(`${out.text}\n`);
    return;
  }
  if (text === undefined) throw new UsageError("give text or --decode", command.name);
  const r = leet(text, renderOptions(command, flags));
  if (r.unknown.length > 0) {
    io.stderr(`deq: warning: left out characters with no glyph: ${codePoints(r.unknown)}\n`);
  }
  emit(io, command.name, [await sceneFile("leet", r.svg, flags)], flags);
}

async function generate(io: Io, command: Command, flags: Flags): Promise<void> {
  const r = pattern(renderOptions(command, flags));
  const kind = (flags.get("kind") as string | undefined) ?? "band";
  const seed = (flags.get("seed") as number | undefined) ?? 1;
  emit(io, command.name, [await sceneFile(`pattern-${kind}-${String(seed)}`, r.svg, flags)], flags);
}

/** Read a regular file of at most `maxBytes` as UTF-8, refusing symbolic links. */
function readText(io: Io, file: string, maxBytes: number): string {
  const path = resolve(io.cwd, file);
  const st = lstat(path);
  if (st === undefined) throw new IoError(`cannot read ${file}: not found`);
  if (st.isSymbolicLink()) throw new IoError(`${file} is a symbolic link; pass the real file`);
  if (!st.isFile()) throw new IoError(`${file} is not a regular file`);
  if (st.size > maxBytes) {
    throw new IoError(`${file} is larger than ${String(maxBytes / 1024)} KB`);
  }
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const code = (error as { code?: string }).code ?? "error";
    throw new IoError(`cannot read ${file}: ${code}`);
  }
}

function validate(io: Io, file: string): void {
  const text = readText(io, file, MAX_SPEC_BYTES);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DeqError("INVALID_SHAPE", `${file}: not valid JSON`);
  }
  try {
    const result = validateSpec(json);
    io.stdout(`${file}: ok (${result.id}, ${String(result.variants)} variants rendered)\n`);
  } catch (error) {
    if (error instanceof DeqError) {
      throw new DeqError(error.code, `${file}: ${error.message}`, error.issues);
    }
    throw error;
  }
}

/** Run `deq` with `argv` (no program name). Returns the exit code. */
export async function main(argv: readonly string[], io: Io, data: CliData = CLI): Promise<number> {
  try {
    const parsed = parseArgs(data, argv);
    if (parsed.kind !== "run") {
      io.stdout(parsed.text);
      return 0;
    }
    const { command, args, flags } = parsed;
    switch (command.name) {
      case "list":
        list(io, flags);
        break;
      case "info":
        info(io, args[0] ?? "", flags);
        break;
      case "render":
        await render(io, command, args, flags);
        break;
      case "export":
        await exportCommand(io, command, args, flags);
        break;
      case "flag":
        emit(io, command.name, [await flagFile(flags)], flags);
        break;
      case "leet":
        await leetCommand(io, command, args[0], flags);
        break;
      case "generate":
        await generate(io, command, flags);
        break;
      case "validate":
        validate(io, args[0] ?? "");
        break;
      default:
        io.stdout(data.completions[args[0] ?? ""] ?? "");
    }
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      const help = error.command === undefined ? data.name : `${data.name} ${error.command}`;
      io.stderr(`${data.name}: error: ${error.message}\nRun "${help} --help" for usage.\n`);
      return 2;
    }
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${data.name}: error: ${message}\n`);
    return error instanceof IoError ? 3 : 1;
  }
}
