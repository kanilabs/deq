import { DeqError, getShape, render, renderShapeData } from "@0xdolan/deq-core";
import type { ShapeData } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import { FORMATS, exportShapes } from "./index.js";
import { resolveItem } from "./input.js";

const custom: ShapeData = {
  id: "u-moon",
  version: 1,
  category: "custom",
  names: {
    en: "Moon",
    ckb: { text: null, status: "needs-native-review" },
    kmr: { text: null, status: "needs-native-review" },
  },
  aliases: [],
  tags: [],
  layers: ["main"],
  symmetry: "none",
  parameters: {},
  primitives: [
    { type: "circle", layer: "main", cx: 12, cy: 12, r: 8 },
    { type: "use", layer: "main", shape: "chevron" },
  ] as unknown as ShapeData["primitives"],
};

describe("data items", () => {
  it("resolve like catalog shapes, named after the shape id", () => {
    const r = resolveItem({ data: custom, options: { color: "#c00" } });
    expect(r.name).toBe("u-moon");
    expect(r.shape).toBe(custom);
    expect(r.options.color).toBe("#c00");
  });

  it("export the same SVG core renders", async () => {
    const [svg] = await exportShapes("svg", [{ data: custom, name: "moon" }]);
    expect(svg?.name).toBe("moon.svg");
    expect(svg?.data).toBe(`${renderShapeData(custom, {})}\n`);
  });

  it("work in every format", async () => {
    for (const format of FORMATS) {
      const files = await exportShapes(format, [{ data: custom }]);
      expect(files.length, format).toBeGreaterThan(0);
    }
  });

  it("take parameters like a catalog shape", () => {
    const shape = getShape("arch-dot-column");
    const r = resolveItem({ data: { ...shape, id: "u-arches" }, params: { arches: 2 } });
    expect(r.options.params).toEqual({ arches: 2 });
    expect(renderShapeData(r.shape, r.options)).toBe(
      render("arch-dot-column", { params: { arches: 2 } }),
    );
  });

  it("reject malformed data with a path to the problem", () => {
    const bad = [
      { ...custom, id: "Not Kebab" },
      { ...custom, layers: [] },
      { ...custom, names: { en: 3 } },
      { ...custom, parameters: { n: { type: "integer", min: 0 } } },
      { ...custom, primitives: "circle" },
      null,
    ];
    for (const data of bad) {
      expect(() => resolveItem({ data: data as unknown as ShapeData })).toThrow(DeqError);
    }
    expect(() => resolveItem({ data: { ...custom, id: "X" } })).toThrow(/data\.id/);
  });

  it("reject unknown primitives and values that are not numbers", () => {
    const prims = [
      { type: "blob", layer: "main" },
      { type: "circle", layer: "main", cx: '"><script>', cy: 1, r: 1 },
      { type: "circle", layer: "main", cx: Number.NaN, cy: 1, r: 1 },
      { type: "circle", layer: "main", cx: 1, cy: 1, r: 1, onload: "x" },
      {
        type: "radial",
        count: 3,
        center: [12, 12],
        start: 0,
        sweep: 360,
        element: { type: "nope" },
      },
    ];
    for (const p of prims) {
      const data = { ...custom, primitives: [p] } as unknown as ShapeData;
      expect(() => resolveItem({ data }), JSON.stringify(p)).toThrow(/data\.primitives\.0/);
    }
  });

  it("accept every primitive type core renders", () => {
    const element = { type: "dot", cx: 12, cy: 4 };
    const primitives = [
      { type: "line", x1: 1, y1: 1, x2: 5, y2: 5 },
      {
        type: "polyline",
        points: [
          [1, 1],
          [4, 4],
          [7, 1],
        ],
      },
      {
        type: "polygon",
        points: [
          [1, 1],
          [4, 4],
          [7, 1],
        ],
        paint: "fill",
      },
      { type: "path", d: "M2 2 L6 6" },
      { type: "ellipse", cx: 12, cy: 12, rx: 4, ry: 2 },
      { type: "arc", cx: 12, cy: 12, r: 6, start: 0, end: 90 },
      { type: "rect", x: 2, y: 2, width: 4, height: 4 },
      { type: "star", cx: 12, cy: 12, points: 5, outerRadius: 6, innerRadius: 3, rotation: 0 },
      { type: "radial", count: 4, center: [12, 12], start: 0, sweep: 360, element },
      { type: "repeat", count: 3, step: [2, 0], align: "center", element },
      {
        type: "concentric",
        count: 2,
        center: [12, 12],
        scaleStep: 0.2,
        element: { type: "circle", cx: 12, cy: 12, r: 8 },
      },
      { type: "use", shape: "chevron", params: {}, transform: { scale: 0.5, origin: [12, 12] } },
    ].map((p) => ({ ...p, layer: "main" }));
    const data = { ...custom, primitives } as unknown as ShapeData;
    expect(renderShapeData(resolveItem({ data }).shape, {})).toContain("<svg");
  });
});
