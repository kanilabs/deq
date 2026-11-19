import { DeqError } from "@0xdolan/deq-core";
import { decodeLeet, leet, pattern } from "@0xdolan/deq-generator";
import { initializeCanvas, readPsd } from "ag-psd";
import { describe, expect, it } from "vitest";

import { buildDrawing } from "./drawing.js";
import { FORMATS, SCENE_UNSUPPORTED, canvasPixels, exportShapes, resolveItem } from "./index.js";
import type { ExportFormat } from "./index.js";
import { toCssMask, toLayeredSvg, toSvg } from "./svg.js";

const LEET = { leet: "Deq", options: { level: "basic" as const } };

function pngSize(png: Uint8Array): [number, number] {
  const view = new DataView(png.buffer, png.byteOffset);
  return [view.getUint32(16), view.getUint32(20)];
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return e instanceof DeqError ? e.code : String(e);
  }
  return "no error";
}

describe("scene items", () => {
  it("resolves Leet text to the generator's SVG and a wide prepared canvas", () => {
    const r = resolveItem(LEET, { size: 48, rotation: 90, params: { a: 1 } });
    const direct = leet("Deq", { level: "basic", size: 48 });
    expect(r.name).toBe("deq-leet");
    expect(r.scene).toBe(direct.svg);
    expect(toSvg(r)).toBe(direct.svg);
    expect(decodeLeet(toSvg(r)).text).toBe("DEQ");
    expect(r.prepared.width).toBe(direct.scene.width);
    expect(r.prepared.layers).toHaveLength(direct.scene.cells.length);
    expect(r.shape.names.en).toBe("DEQ");
    const px = canvasPixels(r.prepared);
    expect(px.height).toBe(48);
    expect(px.width).toBeCloseTo((48 * direct.scene.width) / 24, 9);
  });

  it("resolves patterns with a default name per kind", () => {
    const r = resolveItem({ pattern: { kind: "rosette", seed: 3 } });
    expect(r.name).toBe("deq-rosette");
    expect(r.scene).toBe(pattern({ kind: "rosette", seed: 3 }).svg);
    expect(resolveItem({ pattern: {} }).name).toBe("deq-band");
    expect(resolveItem({ pattern: { seed: 1 }, name: "my-band" }).name).toBe("my-band");
  });

  it("writes one Inkscape layer per character", () => {
    const svg = toLayeredSvg(resolveItem(LEET));
    expect(svg.match(/inkscape:groupmode="layer"/g)).toHaveLength(3);
    expect(svg).toContain('inkscape:label="c3"');
  });

  it("sizes CSS rules to the scene", () => {
    const r = resolveItem({ ...LEET, options: { ...LEET.options, size: 24 } });
    const { width } = canvasPixels(r.prepared);
    expect(toCssMask(r)).toMatch(new RegExp(`width: ${String(Math.round(width * 1000) / 1000)}px`));
    expect(toCssMask(r)).toContain("height: 24px");
  });

  it("builds a wide drawing with the background over the whole canvas", () => {
    const r = resolveItem({
      ...LEET,
      options: { ...LEET.options, background: "#fff", padding: 2 },
    });
    const d = buildDrawing(r.prepared);
    const px = canvasPixels(r.prepared);
    expect(d.width).toBeCloseTo(px.width * 0.75, 9);
    expect(d.height).toBeCloseTo(px.height * 0.75, 9);
    expect(d.layers.map((l) => l.id)).toEqual(["c1", "c2", "c3"]);
    expect(d.background?.path[1]).toEqual(["l", (r.prepared.width ?? 0) + 2, -2]);
  });

  it("gives colours to characters in turn", () => {
    const r = resolveItem({ leet: "ab", options: { level: "basic", colors: ["#f00", "#00f"] } });
    expect(r.prepared.options.layerColors).toEqual({ c1: "#f00", c2: "#00f" });
  });

  it("exports to every format that takes scenes", async () => {
    const ok = FORMATS.filter((f) => !(SCENE_UNSUPPORTED as readonly string[]).includes(f));
    for (const format of ok) {
      const files = await exportShapes(format, [LEET], { render: { size: 24 } });
      expect(files.length, format).toBeGreaterThan(0);
    }
    const [svg] = await exportShapes("svg", [LEET]);
    expect(svg?.data).toBe(`${leet("Deq", { level: "basic" }).svg}\n`);
    const [jsx] = await exportShapes("tsx", [LEET]);
    expect(jsx?.name).toBe("DeqLeet.tsx");
    expect(jsx?.data).toContain("Height in px; the width follows the aspect ratio.");
    expect(jsx?.data).toContain(" height={size} fill=");
    expect(jsx?.data).not.toContain("width={size}");
    const [vue] = await exportShapes("vue", [LEET]);
    expect(vue?.data).not.toContain(':width="size"');
  });

  it("rasterises at the scene's aspect ratio", async () => {
    const r = resolveItem(LEET, { size: 24 });
    const px = canvasPixels(r.prepared);
    const [png] = await exportShapes("png", [LEET], { render: { size: 24 }, scales: [2] });
    const [w, h] = pngSize(png?.data as Uint8Array);
    expect(h).toBe(48);
    expect(w).toBe(Math.round(px.width * 2));
  });

  it("writes a PSD with one layer per character", async () => {
    initializeCanvas(() => {
      throw new Error("no canvas");
    });
    const [psd] = await exportShapes("psd", [LEET], { render: { size: 24 } });
    const doc = readPsd(psd?.data as Uint8Array, {
      skipLayerImageData: true,
      skipCompositeImageData: true,
      skipThumbnail: true,
    });
    expect(doc.height).toBe(24);
    expect(doc.children?.map((c) => c.name)).toEqual(expect.arrayContaining(["c1", "c2", "c3"]));
  });

  it("refuses square-only formats and oversized rasters", async () => {
    for (const format of SCENE_UNSUPPORTED) {
      expect(await code(exportShapes(format as ExportFormat, [LEET])), format).toBe(
        "INVALID_OPTIONS",
      );
    }
    const wide = { leet: "a".repeat(200), options: { level: "basic" as const } };
    expect(await code(exportShapes("png", [wide], { render: { size: 256 } }))).toBe(
      "INVALID_OPTIONS",
    );
  });

  it("validates generator input", async () => {
    expect(
      await code(exportShapes("svg", [{ leet: "x", options: { level: "max" as never } }])),
    ).toBe("INVALID_OPTIONS");
    expect(await code(exportShapes("svg", [{ pattern: { kind: "spiral" as never } }]))).toBe(
      "INVALID_OPTIONS",
    );
    expect(await code(exportShapes("svg", [{ ...LEET, name: "Bad Name" }]))).toBe(
      "INVALID_OPTIONS",
    );
  });

  it("exports a caller's scene after checking it", async () => {
    const band = pattern({ kind: "band", seed: 2, count: 3 }).scene;
    const text = leet("ab", { level: "basic" }).scene;
    const scene = {
      width: Math.max(band.width, text.width),
      height: 24 + 6 + text.height,
      cells: [...band.cells, ...text.cells.map((c) => ({ ...c, y: c.y + 30 }))],
    };
    const r = resolveItem({ scene, title: "ab", options: { colors: ["#c00"] } });
    expect(r.name).toBe("deq-scene");
    expect(r.prepared.layers).toHaveLength(scene.cells.length);
    expect(r.scene).toContain("<title>ab</title>");
    expect((await exportShapes("pdf", [{ scene }]))[0]?.name).toBe("deq-scene.pdf");
    const bad = [
      { ...scene, width: -1 },
      { ...scene, cells: [{ x: 0, y: 0, glyph: [] }] },
      { ...scene, cells: [{ x: 0, y: 0, glyph: [{ shape: "Bad Id" }] }] },
      { ...scene, cells: [{ x: 0, y: 0, glyph: [{ shape: "dot", extra: 1 }] }] },
      { ...scene, cells: [{ x: Infinity, y: 0, glyph: [{ shape: "dot" }] }] },
      { ...scene, cells: [{ x: 0, y: 0, glyph: [{ shape: "dot", transform: { scale: 9 } }] }] },
    ];
    for (const s of bad) {
      expect(await code(exportShapes("svg", [{ scene: s }]))).toBe("INVALID_OPTIONS");
    }
    const unknown = { ...scene, cells: [{ x: 0, y: 0, glyph: [{ shape: "no-such-shape" }] }] };
    expect(await code(exportShapes("svg", [{ scene: unknown }]))).toBe("UNKNOWN_SHAPE");
  });
});
