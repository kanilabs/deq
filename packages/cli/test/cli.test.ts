import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OUT_DIR, describeResult, fileCheck, loadCases, runCase } from "../scripts/cases.ts";
import type { Expected } from "../scripts/cases.ts";
import { generatedFiles } from "../scripts/generate.ts";
import { CLI } from "../src/generated/cli.js";
import {
  MAX_SPEC_BYTES,
  UsageError,
  joinPath,
  main,
  packageName,
  paramValue,
  parseArgs,
  validateSpec,
  variants,
} from "../src/index.js";
import type { CliData } from "../src/index.js";

const manifest = (
  JSON.parse(readFileSync(join(OUT_DIR, "manifest.json"), "utf8")) as { cases: Expected[] }
).cases;

describe("generated CLI data", () => {
  it.each(generatedFiles())(
    "%s matches spec/cli.json (run `pnpm --filter @0xdolan/deq-cli generate`)",
    (file, text) => {
      expect(readFileSync(file, "utf8")).toBe(text);
    },
  );
});

describe("shared CLI cases", () => {
  it("has an expectation for every case", () => {
    expect(manifest.map((c) => c.name)).toEqual(loadCases().map((c) => c.name));
  });

  it.each(loadCases().map((c) => [c.name, c] as const))("%s", async (name, c) => {
    const { expected, fixtures } = describeResult(c, await runCase(main, c));
    expect(expected).toEqual(manifest.find((m) => m.name === name));
    for (const [path, data] of fixtures) {
      expect(Buffer.from(data).equals(readFileSync(join(OUT_DIR, path))), path).toBe(true);
    }
  });
});

describe("fileCheck", () => {
  it("reads ICO directory sizes, 0 meaning 256", () => {
    const ico = new Uint8Array(6 + 32);
    ico.set([0, 0, 1, 0, 2, 0]);
    ico[6] = 16;
    ico[22] = 0;
    expect(fileCheck("c", "a.ico", ico)).toEqual({ path: "a.ico", check: "ico", sizes: [16, 256] });
  });
});

/** Run the CLI in a temporary directory. */
class Session {
  readonly dir = mkdtempSync(join(tmpdir(), "deq-cli-test-"));
  out: (string | Uint8Array)[] = [];
  err = "";

  async run(...argv: string[]): Promise<number> {
    this.out = [];
    this.err = "";
    return main(argv, {
      cwd: this.dir,
      stdout: (d) => this.out.push(d),
      stderr: (t) => (this.err += t),
    });
  }

  path(...names: string[]): string {
    return join(this.dir, ...names);
  }

  close(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

describe("main", () => {
  let s: Session;
  beforeEach(() => {
    s = new Session();
  });
  afterEach(() => {
    s.close();
  });

  it("writes into an existing directory given without a trailing separator", async () => {
    mkdirSync(s.path("icons"));
    expect(await s.run("render", "kurdish-sun", "--out", "icons")).toBe(0);
    expect(existsSync(s.path("icons", "kurdish-sun.svg"))).toBe(true);
  });

  it("refuses to replace a directory even with --force", async () => {
    mkdirSync(s.path("kurdish-sun.svg"));
    expect(await s.run("render", "kurdish-sun", "--out", "x/", "--force")).toBe(0);
    expect(await s.run("render", "kurdish-sun", "--force")).toBe(3);
    expect(s.err).toBe("deq: error: kurdish-sun.svg is not a regular file\n");
  });

  it("reports write failures with exit code 3", async () => {
    writeFileSync(s.path("file"), "");
    expect(await s.run("render", "kurdish-sun", "--out", `file${sep}a.svg`)).toBe(3);
    expect(s.err).toMatch(/^deq: error: cannot write file.a\.svg: E[A-Z]+\n$/);
  });

  it("writes binary output to stdout", async () => {
    expect(await s.run("flag", "--format", "png", "--width", "30", "--out", "-")).toBe(0);
    expect(s.out[0]).toBeInstanceOf(Uint8Array);
  });

  it("writes export files under format and size", async () => {
    expect(await s.run("export", "--all", "--sizes", "16")).toBe(0);
    expect(existsSync(s.path("svg", "16", "kurdish-sun.svg"))).toBe(true);
  });

  it("refuses a directory, a symlink and a large file in validate", async () => {
    expect(await s.run("validate", ".")).toBe(3);
    expect(s.err).toBe("deq: error: . is not a regular file\n");
    writeFileSync(s.path("big.json"), " ".repeat(MAX_SPEC_BYTES + 1));
    expect(await s.run("validate", "big.json")).toBe(3);
    expect(s.err).toBe("deq: error: big.json is larger than 256 KB\n");
    if (process.platform !== "win32") {
      symlinkSync(s.path("big.json"), s.path("link.json"));
      expect(await s.run("validate", "link.json")).toBe(3);
      expect(s.err).toMatch(/is a symbolic link/);
    }
  });

  it("rethrows unexpected validate errors", async () => {
    writeFileSync(s.path("a.json"), "null");
    expect(await s.run("validate", "a.json")).toBe(1);
    expect(s.err).toBe("deq: error: a.json: spec: must be a JSON object\n");
  });

  it("prints messages of non-Error throwables", async () => {
    const data = { ...CLI, commands: [] } as CliData;
    const code = await main(
      ["list"],
      { cwd: s.dir, stdout: () => undefined, stderr: (t) => (s.err += t) },
      data,
    );
    expect(code).toBe(2);
    const broken = {
      ...CLI,
      commands: CLI.commands.map((c) => (c.name === "list" ? { ...c, flags: null } : c)),
    } as unknown as CliData;
    s.err = "";
    const code2 = await main(
      ["list", "--json"],
      { cwd: s.dir, stdout: () => undefined, stderr: (t) => (s.err += t) },
      broken,
    );
    expect(code2).toBe(1);
    expect(s.err).toMatch(/^deq: error: /);
  });

  it("prints an empty completion for an unknown command table entry", async () => {
    const data = { ...CLI, completions: {} } as CliData;
    const out: string[] = [];
    const code = await main(
      ["completion", "bash"],
      { cwd: s.dir, stdout: (d) => out.push(String(d)), stderr: () => undefined },
      data,
    );
    expect(code).toBe(0);
    expect(out).toEqual([""]);
  });
});

describe("parseArgs", () => {
  it("treats - as an argument and stops at --", () => {
    const p = parseArgs(CLI, ["info", "-"]);
    expect(p.kind === "run" && p.args).toEqual(["-"]);
  });

  it("rejects --help with a value as an unknown option", () => {
    expect(() => parseArgs(CLI, ["list", "--help=1"])).toThrow(UsageError);
  });

  it("accepts --version inside a command", () => {
    expect(parseArgs(CLI, ["render", "--version"]).kind).toBe("version");
  });

  it("parses lists, int lists and pairs", () => {
    const p = parseArgs(CLI, [
      "export",
      "--all",
      "--format=svg,pdf",
      "--sizes",
      "16,32",
      "--param",
      "a=b=c",
    ]);
    if (p.kind !== "run") throw new Error("expected run");
    expect(p.flags.get("format")).toEqual(["svg", "pdf"]);
    expect(p.flags.get("sizes")).toEqual([16, 32]);
    expect(p.flags.get("param")).toEqual([["a", "b=c"]]);
  });

  it("rejects bad integers and lists", () => {
    expect(() => parseArgs(CLI, ["flag", "--width", "9.5"])).toThrow(/is not an integer/);
    expect(() => parseArgs(CLI, ["export", "--all", "--sizes", "16,16"])).toThrow(/twice/);
    expect(() => parseArgs(CLI, ["export", "--all", "--format", "svg,"])).toThrow(/is not one of/);
  });

  it("rejects arguments to commands without any", () => {
    expect(() => parseArgs(CLI, ["list", "x"])).toThrow('unexpected argument "x"');
  });

  it("handles a command table without help texts", () => {
    const data = { ...CLI, help: {} } as CliData;
    expect(parseArgs(data, ["--help"])).toEqual({ kind: "help", text: "" });
    expect(parseArgs(data, ["list", "-h"])).toEqual({ kind: "help", text: "" });
    expect(parseArgs(data, ["list", "--help"])).toEqual({ kind: "help", text: "" });
  });
});

describe("helpers", () => {
  it("parses --param values", () => {
    expect(paramValue("true")).toBe(true);
    expect(paramValue("false")).toBe(false);
    expect(paramValue("-2.5")).toBe(-2.5);
    expect(paramValue("1e3")).toBe("1e3");
  });

  it("joins without normalising", () => {
    expect(joinPath("./a/", "b", "c")).toBe(`./a/b${sep}c`);
    expect(joinPath("a\\", "b")).toBe("a\\b");
  });

  it("exposes the package name", () => {
    expect(packageName).toBe("@0xdolan/deq-cli");
  });
});

describe("validateSpec", () => {
  const base = {
    id: "x",
    version: 1,
    category: "test",
    names: { en: "X", ckb: { text: null, status: "none" }, kmr: { text: "x", status: "none" } },
    layers: ["main"],
    parameters: {},
    primitives: [{ type: "dot", cx: 12, cy: 12, layer: "main" }],
  };
  const fails = (patch: Record<string, unknown>, message: string): void => {
    expect(() => validateSpec({ ...base, ...patch })).toThrow(message);
  };

  it("accepts a minimal spec with documentation fields", () => {
    expect(validateSpec({ ...base, meaning: {}, sources: [] })).toEqual({ id: "x", variants: 1 });
  });

  it("checks top-level fields", () => {
    fails({ id: "X" }, "id: must be kebab case");
    fails({ version: 0 }, "version: must be a positive integer");
    fails({ category: 1 }, "category: must be a string");
    fails({ names: [] }, "names: must be an object");
    fails({ names: { ...base.names, en: 1 } }, "names.en: must be a string");
    fails({ names: { ...base.names, ckb: 1 } }, "names.ckb: must be an object");
    fails(
      { names: { ...base.names, ckb: { text: 1 } } },
      "names.ckb.text: must be a string or null",
    );
    fails({ names: { ...base.names, kmr: { text: null } } }, "names.kmr.status: must be a string");
    fails({ aliases: [1] }, "aliases: must be a list of strings");
    fails({ tags: "a" }, "tags: must be a list of strings");
    fails({ layers: [] }, "layers: must be a non-empty list");
    fails({ symmetry: 1 }, "symmetry: must be a string");
    fails({ parameters: [] }, "parameters: must be an object");
    fails({ primitives: [] }, "primitives: must be a non-empty list");
    fails({ extra: 1 }, 'spec: unknown field "extra"');
  });

  it("checks parameter declarations", () => {
    const p = (decl: unknown): Record<string, unknown> => ({ parameters: { n: decl } });
    fails(p(1), "parameters.n: must be an object");
    fails(p({ type: "integer", min: 1, max: 2, default: 1 }), "parameters.n.description");
    fails(
      p({ type: "integer", min: 1, max: 2, default: 1.5, description: "" }),
      "must be integers",
    );
    fails(
      p({ type: "integer", min: 1, max: 2, default: 3, description: "" }),
      "between min and max",
    );
    fails(
      p({ type: "boolean", default: 1, description: "" }),
      "parameters.n.default: must be true or false",
    );
    fails(p({ type: "enum", values: [], default: "a", description: "" }), "parameters.n.values");
    fails(
      p({ type: "enum", values: ["a"], default: "b", description: "" }),
      "must be one of the values",
    );
    fails(p({ type: "float", description: "" }), "parameters.n.type: must be integer");
  });

  it("checks primitive fields", () => {
    const prim = (x: unknown): Record<string, unknown> => ({ primitives: [x] });
    fails(prim(1), "primitives[0]: must be an object");
    fails(prim({ type: "blob" }), "primitives[0].type: must be one of");
    fails(prim({ type: "dot", cy: 1 }), 'primitives[0]: missing field "cx"');
    fails(
      prim({ type: "radial", count: 2, center: [1], start: 0, sweep: 1, element: {} }),
      "center: must be an [x, y] pair",
    );
    fails(
      prim({ type: "polyline", points: [[1, 2], [3]] }),
      "points: must be a list of [x, y] pairs",
    );
    fails(prim({ type: "path", d: 1 }), "d: must be a string");
    fails(
      prim({
        type: "star",
        cx: 1,
        cy: 1,
        points: { param: 1 },
        outerRadius: 1,
        innerRadius: 1,
        rotation: 0,
      }),
      "points: must be a number or",
    );
    fails(
      prim({
        type: "star",
        cx: 1,
        cy: 1,
        points: "n",
        outerRadius: 1,
        innerRadius: 1,
        rotation: 0,
      }),
      "points: must be a number or",
    );
    fails(prim({ type: "rect", x: 0, y: 0, width: 1, height: 1, paint: "ink" }), "paint: must be");
    fails(prim({ type: "repeat", count: 1, align: "end", element: {} }), "align: must be");
    fails(prim({ type: "use", shape: "kurdish-sun", params: [] }), "params: must be an object");
    fails(
      prim({ type: "use", shape: "kurdish-sun", params: { a: null } }),
      "params.a: must be a number",
    );
    fails(
      prim({ type: "use", shape: "kurdish-sun", transform: 1 }),
      "transform: must be an object",
    );
    fails(
      prim({ type: "use", shape: "kurdish-sun", transform: { skew: 1 } }),
      'transform: unknown field "skew"',
    );
    fails(prim({ type: "dot", cx: 1, cy: 1, when: [] }), "when: must be an object");
    fails(
      prim({ type: "dot", cx: 1, cy: 1, when: { a: [true] } }),
      "when.a: must be a value or a list",
    );
    let deep: unknown = { type: "dot", cx: 1, cy: 1 };
    for (let i = 0; i < 10; i++) deep = { type: "repeat", count: 1, element: deep };
    fails(prim(deep), "nested too deeply");
  });

  it("renders min and max only for wide integer ranges", () => {
    const shape = {
      ...base,
      parameters: { n: { type: "integer", min: 0, max: 100, default: 0, description: "" } },
    } as unknown as Parameters<typeof variants>[0];
    expect(variants(shape)).toEqual([{}, { n: 100 }]);
  });
});

describe("bin", () => {
  const bin = join(import.meta.dirname, "..", "dist", "bin.js");
  it.skipIf(!existsSync(bin))("prints the version", () => {
    expect(execFileSync(process.execPath, [bin, "--version"], { encoding: "utf8" })).toBe(
      `deq ${CLI.version}\n`,
    );
  });
});
