import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { DeqError } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import { CHART_FILE, leetChart } from "../scripts/chart.ts";
import { LEET_FIXTURES, leetCases, leetFiles } from "../scripts/fixture-cases.ts";
import { OUT_FILE, PORT_FILES, generateLeet, generatePortData } from "../scripts/generate-leet.ts";
import {
  MAX_GLYPHS,
  MAX_INPUT,
  MAX_LINES,
  MAX_SCENE_ITEMS,
  Random,
  decodeLeet,
  detectScript,
  leet,
  leetTable,
  normalize,
  packageName,
  expandGlyph,
  pattern,
  prepareScene,
  sceneSvg,
} from "../src/index.ts";
import type { LeetLevel, Script } from "../src/index.ts";

const err = (fn: () => unknown): DeqError => {
  try {
    fn();
  } catch (e) {
    if (e instanceof DeqError) return e;
    throw e;
  }
  throw new Error("expected a DeqError");
};

const SCRIPTS: readonly Script[] = ["latin", "sorani"];
const LEVELS: readonly LeetLevel[] = ["basic", "advanced", "full"];
const groups = (svg: string) => [
  ...svg.matchAll(/<g data-layer="c\d+" transform="translate\(([^ ]+) ([^)]+)\)"/gu),
];

describe("tables", () => {
  it("are generated from spec/leet", () => {
    expect(readFileSync(OUT_FILE, "utf8")).toBe(generateLeet());
    for (const file of PORT_FILES) expect(readFileSync(file, "utf8")).toBe(generatePortData());
    expect(packageName).toBe("@0xdolan/deq-generator");
  });

  it.each(SCRIPTS)("%s: every character renders at every level and alternative", (script) => {
    for (const entry of leetTable(script).glyphs) {
      for (const level of LEVELS) {
        const r = leet(entry.char, { script, level });
        expect(r.text).toBe(entry.char);
        expect(groups(r.svg)).toHaveLength(1);
      }
      for (const glyph of entry.advanced) {
        expect(sceneSvg({ width: 24, height: 24, cells: [{ x: 0, y: 0, glyph }] })).toContain(
          "<g ",
        );
      }
    }
  });

  it.each(SCRIPTS)("%s: basic output decodes back to the text", (script) => {
    const chars = leetTable(script).glyphs.map((e) => e.char);
    const text = [
      chars.slice(0, 20).join(""),
      chars.slice(20, 30).join("  "),
      "",
      chars.slice(30).join(""),
    ].join("\n");
    const r = leet(text, { script });
    expect(r.text).toBe(text);
    expect(decodeLeet(r.svg)).toEqual({ text, script, unmatched: 0 });
    for (const align of ["center", "end"] as const) {
      expect(decodeLeet(leet(text, { script, align }).svg).text).toBe(text);
    }
  });
});

describe("normalize", () => {
  it("folds case, applies aliases and drops joiners, tatweel and unknown characters", () => {
    const n = normalize("  de\u200Dq \u2014 x·y ☃\r\n\r\n  ok  \n\n", "latin");
    expect(n.text).toBe("DEQ - X.Y\n\nOK");
    expect(n.unknown).toEqual(["☃"]);
    expect(normalize("ك\u0640يو ۱٢3", "sorani").text).toBe("کیو ١٢٣");
    expect(normalize("straße", "latin").text).toBe("STRASSE");
  });

  it("detects the script", () => {
    expect(detectScript("Deq")).toBe("latin");
    expect(detectScript("Deq دەق")).toBe("sorani");
  });

  it("caps input, glyphs and lines", () => {
    expect(err(() => normalize("A".repeat(MAX_INPUT + 1), "latin")).code).toBe("LIMIT_EXCEEDED");
    expect(err(() => normalize("A".repeat(MAX_GLYPHS + 1), "latin")).message).toMatch(/glyphs/u);
    expect(err(() => normalize("A\n".repeat(MAX_LINES + 1), "latin")).message).toMatch(/lines/u);
  });
});

describe("leet", () => {
  it("writes one layer per glyph with the text as title and the layout on the root", () => {
    const r = leet("<b>&", { size: 48, letterSpacing: 0, background: "#fff" });
    expect(r.text).toBe("B");
    expect(r.unknown).toEqual(["<", ">", "&"]);
    expect(r.svg).toContain('data-deq-leet="latin basic 24 30"');
    expect(r.svg).toContain("<title>B</title>");
    expect(r.svg).not.toContain("<b>");
  });

  it("runs Sorani right to left and Latin left to right", () => {
    const xs = (svg: string) => groups(svg).map((m) => Number(m[1]));
    expect(xs(leet("دەق").svg)).toEqual([52, 26, 0]);
    expect(xs(leet("DEQ").svg)).toEqual([0, 26, 52]);
    expect(xs(leet("AB\nC", { align: "end" }).svg)).toEqual([0, 26, 26]);
    expect(xs(leet("ب\nپت", { align: "end" }).svg)).toEqual([0, 26, 0]);
    expect(xs(leet("AB\nC", { align: "center" }).svg)).toEqual([0, 26, 13]);
  });

  it("is deterministic per seed at the advanced level", () => {
    const text = "Kurdistan Deq Leet 0123456789";
    const a = leet(text, { level: "advanced", seed: 42 });
    expect(leet(text, { level: "advanced", seed: 42 }).svg).toBe(a.svg);
    expect(leet(text, { level: "advanced", seed: 7 }).svg).not.toBe(a.svg);
    expect(leet(text, { level: "basic", seed: 7 }).svg).toBe(leet(text).svg);
    expect(decodeLeet(a.svg).unmatched).toBeGreaterThan(0);
  });

  it("colours glyphs in turn", () => {
    const svg = leet("AB", { colors: ["#ED2024", "green"] }).svg;
    expect(svg).toContain('color="#ED2024" stroke="currentColor"');
    expect(svg).toContain('color="green" stroke="currentColor"');
    expect(decodeLeet(svg).text).toBe("AB");
  });

  it("rejects bad options and empty text", () => {
    expect(err(() => leet("A", { level: "x" as LeetLevel })).issues[0]).toMatch(/^level/u);
    expect(err(() => leet("A", { seed: -1 })).code).toBe("INVALID_OPTIONS");
    expect(err(() => leet("A", { rotation: 90 } as never)).issues).toEqual([
      "rotation: not available for scenes",
    ]);
    expect(err(() => leet("A", { colors: [] })).issues[0]).toMatch(/^colors/u);
    expect(err(() => leet("A", { colors: ["url(#x)"] })).issues).toEqual([
      "colors.0: must be a CSS colour",
    ]);
    expect(err(() => leet("☃☃")).message).toMatch(/no characters of the latin table/u);
    expect(err(() => leet(42 as unknown as string)).message).toMatch(/string/u);
  });
});

describe("decodeLeet", () => {
  it("rejects other SVG and oversized input", () => {
    expect(err(() => decodeLeet("<svg/>")).code).toBe("INVALID_OPTIONS");
    expect(err(() => decodeLeet(" ".repeat(4 * 1024 * 1024 + 1))).code).toBe("LIMIT_EXCEEDED");
    expect(err(() => decodeLeet(1 as unknown as string)).code).toBe("LIMIT_EXCEEDED");
    expect(err(() => decodeLeet('<svg data-deq-leet="latin basic 0 0">')).issues).toEqual([
      "svg: data-deq-leet advances out of range",
    ]);
    const g = (x: number, y: number) =>
      `<g data-layer="c1" transform="translate(${String(x)} ${String(y)})"></g>`;
    const many = `<svg data-deq-leet="latin basic 26 30">${g(0, 0).repeat(MAX_GLYPHS + 1)}`;
    expect(err(() => decodeLeet(many)).message).toMatch(/more than 256 glyphs/u);
  });

  it("caps the gaps it reads from crafted offsets", () => {
    const g = (x: number, y: number) =>
      `<g data-layer="c1" transform="translate(${String(x)} ${String(y)})"></g>`;
    const head = '<svg data-deq-leet="latin basic 26 30">';
    expect(decodeLeet(`${head}${g(0, 0)}${g(0, 1e12)}`).text).toBe(
      `\uFFFD${"\n".repeat(MAX_LINES)}\uFFFD`,
    );
    expect(decodeLeet(`${head}${g(0, 0)}${g(1e12, 0)}`).text).toBe(
      `\uFFFD${" ".repeat(MAX_GLYPHS)}\uFFFD`,
    );
    expect(
      decodeLeet(`${head}${g(0, 0)}<g data-layer="c2" transform="translate(1.2.3 0)"></g>`)
        .unmatched,
    ).toBe(1);
  });

  it("marks glyphs it cannot read and needs the render options used", () => {
    const svg = leet("A B", { level: "full" }).svg;
    expect(decodeLeet(svg)).toEqual({ text: "� �", script: "latin", unmatched: 2 });
    const dotted = leet("1", { dotScale: 2 }).svg;
    expect(decodeLeet(dotted).unmatched).toBe(1);
    expect(decodeLeet(dotted, { dotScale: 2 }).text).toBe("1");
  });
});

describe("Random", () => {
  it("draws the same mulberry32 numbers as the ports", () => {
    const r = new Random(1);
    expect([r.next(), r.next(), r.next()]).toEqual([2693262067, 11749833, 2265367787]);
    const z = new Random(0);
    expect([z.next(), z.next()]).toEqual([1144304738, 1416247]);
    expect(new Random(0xffff_ffff).next()).toBe(3850105811);
    expect(new Random(5).below(3)).toBeLessThan(3);
  });
});

describe("pattern", () => {
  it.each(["band", "grid", "rosette", "border"] as const)(
    "%s is deterministic per seed",
    (kind) => {
      const a = pattern({ kind, seed: 3 });
      expect(pattern({ kind, seed: 3 }).svg).toBe(a.svg);
      expect(a.svg).toContain(`<title>Deq ${kind} pattern</title>`);
      expect(new Set(a.motifs).size).toBe(a.motifs.length);
    },
  );

  it("lays out each kind", () => {
    expect(groups(pattern({ count: 5, spacing: 0 }).svg).map((m) => m[1])).toEqual([
      "0",
      "24",
      "48",
      "72",
      "96",
    ]);
    expect(pattern({ kind: "grid", cols: 3, rows: 2 }).scene).toMatchObject({
      width: 76,
      height: 50,
    });
    const rosette = pattern({ kind: "rosette", petals: 4, spacing: 0 });
    expect(rosette.scene.cells.map((c) => [c.x, c.y])).toEqual([
      [24, 24],
      [24, 0],
      [48, 24],
      [24, 48],
      [0, 24],
    ]);
    const border = pattern({ kind: "border", cols: 4, rows: 3 });
    expect(border.scene.cells).toHaveLength(10);
    expect(border.scene.cells.map((c) => c.glyph[0]?.transform?.rotate ?? 0)).toEqual([
      0, 0, 0, 90, 90, 180, 180, 180, 270, 270,
    ]);
  });

  it("uses the given motifs, mirrored or alternating", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 8; seed += 1) {
      const p = pattern({ motifs: ["dot", "ring"], seed, count: 3 });
      seen.add(String(p.motifs.length));
      expect(p.motifs.every((m) => m === "dot" || m === "ring")).toBe(true);
    }
    expect(seen).toEqual(new Set(["2", "3"]));
  });

  it("rejects bad options", () => {
    expect(err(() => pattern({ count: 4 })).issues[0]).toMatch(/^count: must be odd/u);
    expect(err(() => pattern({ kind: "border", cols: 2 })).message).toMatch(/3 x 3/u);
    expect(err(() => pattern({ motifs: ["no-such-shape"] })).code).toBe("UNKNOWN_SHAPE");
    expect(err(() => pattern({ seed: 1.5 })).code).toBe("INVALID_OPTIONS");
    expect(err(() => pattern({ flipX: true } as never)).code).toBe("INVALID_OPTIONS");
  });
});

describe("sceneSvg", () => {
  it("caps the number of elements", () => {
    const glyph = [{ shape: "dot" }];
    const cells = Array.from({ length: MAX_SCENE_ITEMS + 1 }, () => ({ x: 0, y: 0, glyph }));
    expect(err(() => sceneSvg({ width: 24, height: 24, cells })).code).toBe("LIMIT_EXCEEDED");
  });
});

describe("prepareScene", () => {
  it("moves each glyph into place, one layer per cell", () => {
    const { scene } = leet("DEQ", { level: "basic" });
    const p = prepareScene(scene, { size: 48 }, "DEQ");
    expect(p.width).toBe(scene.width);
    expect(p.height).toBe(scene.height);
    expect(p.layers).toEqual(scene.cells.map((_c, i) => `c${String(i + 1)}`));
    expect(p.defaultTitle).toBe("DEQ");
    expect(p.options.layerColors).toEqual({});
    const sizes = scene.cells.map((c) => expandGlyph(c.glyph).length);
    expect(p.items).toHaveLength(sizes.reduce((a, b) => a + b, 0));
    const cell = scene.cells[1];
    const own = expandGlyph(cell?.glyph ?? []);
    const placed = p.items.filter((it) => it.layer === "c2");
    expect(placed).toHaveLength(own.length);
    own.forEach((item, k) => {
      const moved = placed[k];
      if (item.kind === "poly" && moved?.kind === "poly") {
        item.points.forEach(([x, y], j) => {
          expect(moved.points[j]?.[0]).toBeCloseTo(x + (cell?.x ?? 0), 9);
          expect(moved.points[j]?.[1]).toBeCloseTo(y + (cell?.y ?? 0), 9);
        });
      } else if (item.kind === "circle" && moved?.kind === "circle") {
        expect(moved.cx).toBeCloseTo(item.cx + (cell?.x ?? 0), 9);
        expect(moved.cy).toBeCloseTo(item.cy + (cell?.y ?? 0), 9);
      }
    });
  });

  it("keeps part transforms and gives colours to cells in turn", () => {
    const glyph = [{ shape: "dot", transform: { translate: [2, 3] as const, scale: 0.5 } }];
    const scene = { width: 72, height: 24, cells: [0, 24, 48].map((x) => ({ x, y: 0, glyph })) };
    const p = prepareScene(scene, { colors: ["red", "blue"] });
    expect(p.options.layerColors).toEqual({ c1: "red", c2: "blue", c3: "red" });
    const xs = p.items.map((it) => (it.kind === "circle" ? it.cx : NaN));
    const base = expandGlyph(glyph)[0];
    const cx = base?.kind === "circle" ? base.cx : NaN;
    expect(xs).toEqual([cx, cx + 24, cx + 48]);
  });

  it("validates options and caps the number of elements", () => {
    const glyph = [{ shape: "dot" }];
    const one = { width: 24, height: 24, cells: [{ x: 0, y: 0, glyph }] };
    expect(err(() => prepareScene(one, { rotation: 9 } as never)).code).toBe("INVALID_OPTIONS");
    const cells = Array.from({ length: MAX_SCENE_ITEMS + 1 }, () => ({ x: 0, y: 0, glyph }));
    expect(err(() => prepareScene({ width: 24, height: 24, cells })).code).toBe("LIMIT_EXCEEDED");
  });
});

describe("golden fixtures", () => {
  const lib = { leet, pattern, leetTable };
  const files = leetFiles(lib);

  it("match spec/fixtures/leet (run `pnpm --filter @0xdolan/deq-generator fixtures`)", () => {
    expect(readdirSync(LEET_FIXTURES).sort()).toEqual([...files.keys()].sort());
    for (const [name, text] of files)
      expect(readFileSync(join(LEET_FIXTURES, name), "utf8")).toBe(text);
  });

  it("include the chart in docs/design", () => {
    expect(readFileSync(CHART_FILE, "utf8")).toBe(leetChart({ leetTable, sceneSvg }));
  });

  it("decode every basic case", () => {
    for (const c of leetCases(lib)) {
      if (c.decoded !== undefined) {
        const layout = new Set([
          "level",
          "script",
          "seed",
          "letterSpacing",
          "lineSpacing",
          "align",
        ]);
        const render = Object.fromEntries(
          Object.entries(c.leet?.options ?? {}).filter(([key]) => !layout.has(key)),
        );
        expect(decodeLeet(readFileSync(join(LEET_FIXTURES, c.file), "utf8"), render).text).toBe(
          c.decoded,
        );
      }
    }
  });
});
