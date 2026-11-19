import { DeqError } from "@0xdolan/deq-core";
import { leet, leetTable, pattern, type Scene } from "@0xdolan/deq-generator";
import { describe, expect, it } from "vitest";

import codepointFile from "../../../fonts/leet-codepoints.json";
import { parseDoc, EMPTY_DOC, LIMITS, type StudioDoc } from "../src/studio/model.ts";
import {
  DEFAULT_STYLE,
  FLAG_COLORS,
  FRAME_GAP,
  InsertError,
  bandCount,
  borderCount,
  cellChars,
  composeLeet,
  insertScene,
  puaText,
  styleOptions,
} from "../src/studio/generate.ts";

const cps = codepointFile.codepoints;
const pua = (hex: string) => String.fromCodePoint(Number.parseInt(hex, 16));
let counter = 0;
const ids = () => `u-test${String((counter += 1))}`;

function code(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    return e instanceof DeqError ? e.code : e instanceof InsertError ? e.limit : String(e);
  }
  return "no error";
}

describe("composeLeet", () => {
  it("returns the Leet scene itself without a frame", () => {
    const c = composeLeet("Deq", { level: "basic" }, { kind: "none", seed: 1 });
    expect(c.framed).toBe(false);
    expect(c.scene).toBe(c.result.scene);
    expect(c.names).toEqual(["D", "E", "Q"]);
  });

  it("puts a band above and below the centred text", () => {
    const c = composeLeet("Deq", {}, { kind: "band", seed: 4 });
    const text = c.result.scene;
    const n = bandCount(text.width);
    expect(c.scene.cells).toHaveLength(3 + 2 * n);
    expect(c.scene.height).toBe(48 + 2 * FRAME_GAP + text.height);
    expect(c.scene.width).toBeGreaterThanOrEqual(text.width);
    const [first] = c.scene.cells;
    expect(first?.y).toBe(24 + FRAME_GAP);
    expect(first?.x).toBe((c.scene.width - text.width) / 2);
    const top = c.scene.cells.slice(3, 3 + n).map((cell) => cell.glyph);
    const bottom = c.scene.cells.slice(3 + n).map((cell) => cell.glyph);
    expect(bottom).toEqual(top);
    expect(c.names.slice(3, 3 + n)).toEqual(top.map((g) => g[0]?.shape));
  });

  it("frames the text with a border and keeps the gap", () => {
    const c = composeLeet("ab\ncd", { level: "full" }, { kind: "border", seed: 2 });
    const text = c.result.scene;
    const xs = c.scene.cells.slice(0, 4).map((cell) => cell.x);
    const ys = c.scene.cells.slice(0, 4).map((cell) => cell.y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(24 + FRAME_GAP);
    expect(Math.max(...xs) + 24).toBeLessThanOrEqual(c.scene.width - 24 - FRAME_GAP);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(24 + FRAME_GAP);
    expect(Math.max(...ys) + 24).toBeLessThanOrEqual(c.scene.height - 24 - FRAME_GAP);
    const border = pattern({
      kind: "border",
      seed: 2,
      cols: borderCount(text.width),
      rows: borderCount(text.height),
    });
    expect(c.scene.cells.slice(4)).toEqual(border.scene.cells);
    expect(code(() => composeLeet("a".repeat(40), {}, { kind: "border", seed: 1 }))).toBe(
      "LIMIT_EXCEEDED",
    );
  });

  it("passes motifs to the frame", () => {
    const c = composeLeet("x", {}, { kind: "band", seed: 9, motifs: ["dot"] });
    expect(new Set(c.names.slice(1))).toEqual(new Set(["dot"]));
  });

  it("sizes bands to odd counts between 3 and 63", () => {
    expect(bandCount(10)).toBe(3);
    expect(bandCount(4 * 26 - 2)).toBe(5);
    expect(bandCount(5 * 26 - 2)).toBe(5);
    expect(bandCount(10_000)).toBe(63);
    expect(borderCount(0)).toBe(3);
  });
});

describe("puaText", () => {
  it("gives every table glyph a code point", () => {
    for (const script of ["latin", "sorani"] as const) {
      for (const entry of leetTable(script).glyphs) {
        const points = (cps[script] as Record<string, { advanced: string[] }>)[entry.char];
        expect(points, `${script} ${entry.char}`).toBeDefined();
        expect(points?.advanced).toHaveLength(entry.advanced.length);
      }
    }
  });

  it("writes basic, advanced and full glyphs with their own code points", () => {
    const basic = leet("De q", { level: "basic" });
    expect(puaText("De q", basic)).toBe(
      `${pua(cps.latin.D.basic)}${pua(cps.latin.E.basic)} ${pua(cps.latin.Q.basic)}`,
    );
    const full = leet("d", { level: "full" });
    expect(puaText("d", full)).toBe(pua(cps.latin.D.full));
    const text = "AAAAAAAA";
    const adv = leet(text, { level: "advanced", seed: 5 });
    const a = cps.latin.A;
    const allowed = new Set([a.basic, ...a.advanced].map(pua));
    const out = Array.from(puaText(text, adv));
    expect(out).toHaveLength(8);
    for (const ch of out) expect(allowed.has(ch)).toBe(true);
    expect(new Set(out).size).toBeGreaterThan(1);
  });

  it("joins lines and writes Sorani in visual order", () => {
    expect(puaText("a\nb", leet("a\nb")).split("\n")).toHaveLength(2);
    const r = leet("دەق");
    const chars = cellChars("دەق", r);
    const s = cps.sorani as Record<string, { basic: string }>;
    const logical = chars.map((ch) => pua(s[ch]?.basic ?? "0"));
    expect(puaText("دەق", r)).toBe(logical.reverse().join(""));
  });
});

describe("insertScene", () => {
  it("adds Leet text as one named group at the scene's scale", () => {
    const r = leet("Deq", { level: "basic" });
    const { doc, ids: added } = insertScene(
      EMPTY_DOC,
      r.scene,
      { size: 48, x: 10, y: 20, names: cellChars("Deq", r), colors: ["#c00", "#00c"] },
      ids,
    );
    expect(added).toEqual(["i1", "i2", "i3"]);
    expect(new Set(doc.items.map((i) => i.group))).toEqual(new Set(["g1"]));
    expect(doc.items.map((i) => i.name)).toEqual(["D", "E", "Q"]);
    expect(doc.items.map((i) => i.options.color)).toEqual(["#c00", "#00c", "#c00"]);
    const second = r.scene.cells[1];
    const item = doc.items[1];
    const s = second?.glyph[0]?.transform?.scale ?? 1;
    // The item's centre is the glyph part's centre on the canvas.
    expect((item?.x ?? 0) + (item?.options.size ?? 24) / 2).toBeCloseTo(
      10 + ((second?.x ?? 0) + 12 + (second?.glyph[0]?.transform?.translate?.[0] ?? 0)) * 2,
      2,
    );
    expect(item?.options.size ?? 24).toBeCloseTo(48 * s, 3);
    expect(() => parseDoc(JSON.parse(JSON.stringify(doc)))).not.toThrow();
  });

  it("keeps scaled motifs at the scene's stroke and dot size", () => {
    const rosette = pattern({ kind: "rosette", seed: 3, petals: 4 }).scene;
    const { doc } = insertScene(EMPTY_DOC, rosette, {
      size: 24,
      x: 0,
      y: 0,
      options: { strokeWidth: 3, dotScale: 1.5, background: "#fff" },
    });
    const petal = doc.items[1];
    expect(petal?.options).toMatchObject({ size: 18, strokeWidth: 4, dotScale: 2 });
    expect(petal?.options.rotation).toBeUndefined();
    expect(doc.items[2]?.options.rotation).toBe(90);
    expect(petal?.options.background).toBeUndefined();
    const abs = insertScene(EMPTY_DOC, rosette, {
      size: 24,
      x: 0,
      y: 0,
      options: { absoluteStrokeWidth: true },
    }).doc.items[1];
    expect(abs?.options.strokeWidth).toBeUndefined();
    expect(abs?.options.dotScale).toBeCloseTo(1.333, 3);
  });

  it("turns glyphs of several shapes into one embedded custom shape each", () => {
    const parts = [{ shape: "dot" }, { shape: "dot", transform: { translate: [6, 0] as const } }];
    const scene: Scene = {
      width: 50,
      height: 24,
      cells: [
        { x: 0, y: 0, glyph: parts },
        { x: 26, y: 0, glyph: parts },
      ],
    };
    const start: StudioDoc = { v: 1, items: [{ id: "i1", shape: "dot", x: 0, y: 0, options: {} }] };
    const { doc, ids: added } = insertScene(
      start,
      scene,
      { size: 24, x: 0, y: 0, shapeNames: ["Leet Ä"] },
      ids,
    );
    expect(added).toEqual(["i2", "i3"]);
    expect(doc.shapes).toHaveLength(1);
    expect(doc.shapes?.[0]?.name).toBe("Leet Ä");
    expect(doc.items[1]?.shape).toBe(doc.shapes?.[0]?.id);
    expect(doc.items[2]).toMatchObject({ x: 26, y: 0 });
    expect(() => parseDoc(JSON.parse(JSON.stringify(doc)))).not.toThrow();
  });

  it("does not group a single cell", () => {
    const one: Scene = {
      width: 24,
      height: 24,
      cells: [{ x: 0, y: 0, glyph: [{ shape: "dot" }] }],
    };
    expect(
      insertScene(EMPTY_DOC, one, { size: 24, x: 0, y: 0 }).doc.items[0]?.group,
    ).toBeUndefined();
  });

  it("refuses scenes that do not fit the design", () => {
    const grid = pattern({ kind: "grid", cols: 32, rows: 16 }).scene;
    expect(code(() => insertScene(EMPTY_DOC, grid, { size: 24, x: 0, y: 0 }))).toBe("items");
    expect(grid.cells.length).toBeGreaterThan(LIMITS.items);
    const glyph = (i: number) => [{ shape: "dot" }, { shape: "dot", transform: { rotate: i } }];
    const many: Scene = {
      width: 24,
      height: 24,
      cells: Array.from({ length: 101 }, (_, i) => ({ x: 0, y: 0, glyph: glyph(i) })),
    };
    expect(code(() => insertScene(EMPTY_DOC, many, { size: 24, x: 0, y: 0 }, ids))).toBe("shapes");
  });
});

describe("styleOptions", () => {
  it("maps the colour modes to scene options", () => {
    expect(styleOptions(DEFAULT_STYLE)).toEqual({ size: 48, strokeWidth: 2 });
    expect(styleOptions({ ...DEFAULT_STYLE, colorMode: "custom", background: "#fff" })).toEqual({
      size: 48,
      strokeWidth: 2,
      color: "#ed2024",
      background: "#fff",
    });
    expect(styleOptions({ ...DEFAULT_STYLE, colorMode: "flag" }).colors).toEqual(FLAG_COLORS);
  });
});
