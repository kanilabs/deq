/**
 * Runs the shared CLI cases (`spec/fixtures/cli-cases.json`) against the Node CLI and turns
 * the results into the expectations in `spec/fixtures/cli/` (ADR 0011). Text outputs are
 * compared byte for byte; images by format and pixel size, because each port links its own
 * resvg and encoders.
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type { Io } from "../src/cli.ts";

/** The CLI entry point under test. */
export type Main = (argv: readonly string[], io: Io) => Promise<number>;

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "..", "..", "..");
export const CASES_FILE = join(ROOT, "spec", "fixtures", "cli-cases.json");
export const OUT_DIR = join(ROOT, "spec", "fixtures", "cli");

export interface Setup {
  readonly path: string;
  readonly text?: string;
  readonly copy?: string;
}

export interface Case {
  readonly name: string;
  readonly args: readonly string[];
  readonly setup?: readonly Setup[];
  readonly stderr?: boolean;
  readonly nodeOnly?: boolean;
}

/** How a port checks one output file. */
export type FileCheck =
  | { readonly path: string; readonly check: "bytes"; readonly fixture: string }
  | {
      readonly path: string;
      readonly check: "png";
      readonly width: number;
      readonly height: number;
    }
  | { readonly path: string; readonly check: "jpg" | "webp" }
  | { readonly path: string; readonly check: "ico"; readonly sizes: readonly number[] };

export interface Expected {
  readonly name: string;
  readonly args: readonly string[];
  readonly setup: readonly Setup[];
  readonly nodeOnly: boolean;
  readonly exit: number;
  /** Fixture file with the exact stdout, or null when stdout is empty. */
  readonly stdout: string | null;
  /** Fixture file with the exact stderr; null when empty or not compared. */
  readonly stderr: string | null;
  /** Every file in the working directory afterwards, sorted by path. */
  readonly files: readonly FileCheck[];
}

export interface Result {
  readonly exit: number;
  readonly stdout: Uint8Array;
  readonly stderr: string;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

export function loadCases(): Case[] {
  return (JSON.parse(readFileSync(CASES_FILE, "utf8")) as { cases: Case[] }).cases;
}

function walk(dir: string, base: string, out: Map<string, Uint8Array>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, base, out);
    else out.set(relative(base, path).split("\\").join("/"), readFileSync(path));
  }
}

/** Run one case in a fresh temporary directory. */
export async function runCase(main: Main, c: Case): Promise<Result> {
  const dir = mkdtempSync(join(tmpdir(), "deq-cli-"));
  try {
    for (const s of c.setup ?? []) {
      const path = join(dir, s.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, s.copy === undefined ? (s.text ?? "") : readFileSync(join(ROOT, s.copy)));
    }
    const stdout: Uint8Array[] = [];
    let stderr = "";
    const exit = await main(c.args, {
      cwd: dir,
      stdout: (d) => stdout.push(typeof d === "string" ? Buffer.from(d, "utf8") : d),
      stderr: (t) => (stderr += t),
    });
    const files = new Map<string, Uint8Array>();
    walk(dir, dir, files);
    return { exit, stdout: Buffer.concat(stdout), stderr, files };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const u32 = (b: Uint8Array, i: number): number =>
  ((b[i] ?? 0) << 24) + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0);

/** The check for one output file; exact files also return their bytes. */
export function fileCheck(caseName: string, path: string, data: Uint8Array): FileCheck {
  const ext = path.slice(path.lastIndexOf(".") + 1);
  if (ext === "png") return { path, check: "png", width: u32(data, 16), height: u32(data, 20) };
  if (ext === "jpg" || ext === "webp") return { path, check: ext };
  if (ext === "ico") {
    const count = (data[4] ?? 0) + ((data[5] ?? 0) << 8);
    const sizes = Array.from({ length: count }, (_, i) => (data[6 + i * 16] ?? 0) || 256);
    return { path, check: "ico", sizes };
  }
  return { path, check: "bytes", fixture: `${caseName}/files/${path}` };
}

/** Expectations and fixture files (path relative to `spec/fixtures/cli/` and bytes). */
export function describeResult(
  c: Case,
  r: Result,
): { expected: Expected; fixtures: [string, Uint8Array][] } {
  const fixtures: [string, Uint8Array][] = [];
  let stdout: string | null = null;
  if (r.stdout.length > 0) {
    stdout = `${c.name}/stdout`;
    fixtures.push([stdout, r.stdout]);
  }
  let stderr: string | null = null;
  if (r.stderr !== "" && c.stderr !== false) {
    stderr = `${c.name}/stderr`;
    fixtures.push([stderr, Buffer.from(r.stderr, "utf8")]);
  }
  const files = [...r.files.keys()].sort().map((path) => {
    const data = r.files.get(path) ?? new Uint8Array();
    const check = fileCheck(c.name, path, data);
    if (check.check === "bytes") fixtures.push([check.fixture, data]);
    return check;
  });
  const expected: Expected = {
    name: c.name,
    args: c.args,
    setup: c.setup ?? [],
    nodeOnly: c.nodeOnly ?? false,
    exit: r.exit,
    stdout,
    stderr,
    files,
  };
  return { expected, fixtures };
}

/** Run every case: the manifest text and every fixture file. */
export async function buildFixtures(
  main: Main,
): Promise<{ manifest: string; fixtures: [string, Uint8Array][] }> {
  const expected: Expected[] = [];
  const fixtures: [string, Uint8Array][] = [];
  const names = new Set<string>();
  for (const c of loadCases()) {
    if (names.has(c.name)) throw new Error(`duplicate CLI case ${c.name}`);
    names.add(c.name);
    const d = describeResult(c, await runCase(main, c));
    expected.push(d.expected);
    fixtures.push(...d.fixtures);
  }
  const manifest = `${JSON.stringify(
    {
      $comment:
        "Generated by packages/cli/scripts/fixtures.ts from spec/fixtures/cli-cases.json. Do not edit: run `pnpm --filter @0xdolan/deq-cli fixtures`.",
      cases: expected,
    },
    null,
    2,
  )}\n`;
  return { manifest, fixtures };
}
