import { renderShapeData, type Primitive } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import {
  BooleanError,
  booleanOp,
  loadPaper,
  outline,
  paperSegments,
} from "../src/studio/boolean.ts";
import {
  CUSTOM_LIMITS,
  CustomShapeError,
  checkPrimitives,
  flatBox,
  flatten,
  fromSpecJson,
  isCustomId,
  newCustomId,
  parseCustomDef,
  parseCustomDefs,
  toShapeData,
  toSpecJson,
  type CustomDef,
} from "../src/studio/custom.ts";
import { ShapeDraft, PART_KINDS, newPart } from "../src/studio/editor.svelte.ts";
import {
  flatsToPrimitives,
  hitTest,
  normAngle,
  parsePathData,
  pathData,
  reflectPrimitive,
  rotation,
  scaling,
  toPaths,
  transformPrimitive,
  translation,
} from "../src/studio/geometry.ts";
import {
  DocError,
  embedShapes,
  parseDoc,
  renderOptions,
  type StudioDoc,
} from "../src/studio/model.ts";
import {
  deletePoint,
  editPath,
  editPoints,
  editableSegments,
  insertPoint,
  isClosed,
  movePoint,
  primitivePoints,
  setPrimitivePoint,
  toggleClosed,
  toggleCurve,
} from "../src/studio/pathedit.ts";
import { renderCached, renderShape } from "../src/studio/render.ts";
import { knownShape, setCustomShapes, shapeOf } from "../src/studio/shapes.ts";
import { Studio } from "../src/studio/store.svelte.ts";

const ring: CustomDef = {
  id: "u-ring",
  version: 1,
  name: "Ring",
  primitives: [
    { type: "circle", cx: 12, cy: 12, r: 6 },
    { type: "dot", cx: 12, cy: 12 },
  ],
};

/** Same picture? Compare rendered SVG. */
const svgOf = (primitives: readonly Primitive[]) =>
  renderShapeData(toShapeData({ ...ring, primitives }), { title: "" });

describe("custom shapes", () => {
  it("validates definitions and strips ids and layers", () => {
    const def = parseCustomDef({
      ...ring,
      primitives: [
        {
          type: "radial",
          count: 4,
          center: [12, 12],
          start: 0,
          sweep: 360,
          id: "x",
          layer: "l",
          element: { type: "dot", cx: 18, cy: 12, layer: "m" },
        },
      ],
    });
    expect(def.primitives[0]).toEqual({
      type: "radial",
      count: 4,
      center: [12, 12],
      start: 0,
      sweep: 360,
      element: { type: "dot", cx: 18, cy: 12 },
    });
    expect(toShapeData(def).primitives[0]).toMatchObject({ layer: "main" });
    expect(() => parseCustomDef({ ...ring, id: "ring" })).toThrow(/u-abc123/);
    expect(() =>
      parseCustomDef({ ...ring, primitives: [{ type: "line", x1: 0, y1: 0, x2: 30, y2: 0 }] }),
    ).toThrow(CustomShapeError);
    expect(() => parseCustomDef({ ...ring, primitives: [{ type: "use", shape: "nope" }] })).toThrow(
      /unknown shape/,
    );
    expect(() =>
      parseCustomDef({ ...ring, primitives: [{ type: "path", d: "m1 1 l2 2" }] }),
    ).toThrow(/absolute/);
    expect(() =>
      parseCustomDef({ ...ring, primitives: [{ type: "dot", cx: 1, cy: 1, when: { a: 1 } }] }),
    ).toThrow();
    expect(() => parseCustomDef({ ...ring, primitives: [] })).toThrow();
    expect(() => parseCustomDef("x")).toThrow(/invalid shape/);
    expect(
      parseCustomDef({
        ...ring,
        primitives: [
          {
            type: "use",
            shape: "arch-dot-column",
            params: { arches: 2 },
            transform: { scale: 0.5 },
          },
        ],
      }).primitives,
    ).toHaveLength(1);
  });

  it("asks core about references and limits", () => {
    expect(() => {
      checkPrimitives([
        {
          type: "concentric",
          count: 3,
          center: [12, 12],
          scaleStep: 0.5,
          element: { type: "circle", cx: 12, cy: 12, r: 8 },
        },
      ]);
    }).toThrow(CustomShapeError);
    const huge: Primitive = {
      type: "radial",
      count: 64,
      center: [12, 12],
      start: 0,
      sweep: 360,
      element: {
        type: "radial",
        count: 64,
        center: [12, 12],
        start: 0,
        sweep: 360,
        element: { type: "dot", cx: 12, cy: 6 },
      },
    };
    expect(() => {
      checkPrimitives([huge]);
    }).toThrow(CustomShapeError);
  });

  it("validates lists with unique ids", () => {
    expect(parseCustomDefs([ring])).toHaveLength(1);
    expect(() => parseCustomDefs([ring, ring])).toThrow(/duplicate/);
    expect(() => parseCustomDefs({})).toThrow(/list/);
    expect(() =>
      parseCustomDefs(Array.from({ length: CUSTOM_LIMITS.shapes + 1 }, () => ring)),
    ).toThrow(/too many/);
    expect(() => parseCustomDefs([{ ...ring, version: 0 }])).toThrow(/shapes\.0/);
  });

  it("makes ids", () => {
    expect(isCustomId(newCustomId())).toBe(true);
    expect(newCustomId((n) => new Uint8Array(n))).toBe("u-000000000000");
    expect(isCustomId("roj")).toBe(false);
  });

  it("exports spec JSON and reads it back", () => {
    const json = JSON.parse(toSpecJson(ring)) as Record<string, unknown>;
    for (const key of [
      "id",
      "version",
      "category",
      "names",
      "aliases",
      "tags",
      "meaning",
      "sources",
      "layers",
      "primitives",
      "symmetry",
      "parameters",
      "construction",
      "references",
      "metrics",
    ]) {
      expect(json).toHaveProperty(key);
    }
    expect(json["metrics"]).toMatchObject({
      bbox: [6, 6, 12, 12],
      visualBox: [5, 5, 14, 14],
      opticalCenter: [12, 12],
      primitiveCount: 2,
    });
    const back = fromSpecJson(toSpecJson(ring));
    expect(back).toEqual(ring);
    expect(
      fromSpecJson(
        toSpecJson(ring),
        (id) => id === ring.id,
        () => "u-new",
      ).id,
    ).toBe("u-new");
    // Catalog spec files without parameters import too, under a fresh id.
    const catalog = JSON.stringify({
      id: "arrow",
      names: { en: "Arrow" },
      primitives: [{ type: "line", x1: 2, y1: 2, x2: 9, y2: 9, layer: "a" }],
    });
    expect(fromSpecJson(catalog, undefined, () => "u-arrow")).toMatchObject({
      id: "u-arrow",
      name: "Arrow",
      version: 1,
    });
    expect(() => fromSpecJson("{")).toThrow(/JSON/);
    expect(() => fromSpecJson("[]")).toThrow(/object/);
    expect(() => fromSpecJson(JSON.stringify({ parameters: { n: {} } }))).toThrow(/parameters/);
    expect(flatBox([])).toEqual([0, 0, 0, 0]);
  });

  it("looks shapes up and renders them by content", () => {
    setCustomShapes([ring], [{ ...ring, name: "Doc ring" }]);
    expect(shapeOf("u-ring").names.en).toBe("Doc ring");
    expect(knownShape("u-ring") && knownShape("arrow-line") && !knownShape("u-none")).toBe(true);
    const a = renderCached("u-ring", { title: "" });
    setCustomShapes([{ ...ring, primitives: [{ type: "dot", cx: 3, cy: 3 }] }]);
    expect(renderCached("u-ring", { title: "" })).not.toBe(a);
    expect(renderShape(shapeOf("arrow-line"), { title: "" })).toContain("<svg");
    setCustomShapes();
  });
});

describe("geometry", () => {
  it("parses and writes path data", () => {
    const segs = parsePathData("M1 2 H5 V6 L7 8 Q9 9 10 10 C1 1 2 2 3 3 Z");
    expect(pathData(segs)).toBe("M1 2 L5 2 L5 6 L7 8 Q9 9 10 10 C1 1 2 2 3 3 Z");
    expect(() => parsePathData("L1 1")).toThrow();
    expect(() => parsePathData("M1 1 X")).toThrow();
    expect(() => parsePathData("M1")).toThrow();
  });

  it("moves, rotates and scales every primitive type", () => {
    const parts: Primitive[] = [
      newPart("line"),
      {
        type: "polyline",
        points: [
          [4, 4],
          [8, 8],
        ],
      },
      newPart("polygon"),
      newPart("path"),
      newPart("circle"),
      newPart("dot"),
      newPart("arc"),
      newPart("rect"),
      { type: "ellipse", cx: 12, cy: 12, rx: 6, ry: 3 },
      { type: "star", cx: 12, cy: 12, points: 5, outerRadius: 6, innerRadius: 3, rotation: 0 },
      {
        type: "radial",
        count: 4,
        center: [12, 12],
        start: 0,
        sweep: 360,
        element: { type: "dot", cx: 18, cy: 12 },
      },
      {
        type: "repeat",
        count: 3,
        step: [4, 0],
        spread: [8, 0],
        element: { type: "dot", cx: 12, cy: 12 },
      },
      {
        type: "concentric",
        count: 3,
        center: [12, 12],
        scaleStep: 0.25,
        element: { type: "circle", cx: 12, cy: 12, r: 8 },
      },
      { type: "use", shape: "arrow-line", transform: { scale: 0.5 } },
    ];
    for (const part of parts) {
      for (const t of [translation(1, -1), rotation(90), rotation(30), scaling(0.5)]) {
        const out = transformPrimitive(part, t);
        expect(out.length, part.type).toBeGreaterThan(0);
        // Same picture as transforming the flat geometry.
        expect(() => flatten(out)).not.toThrow();
      }
    }
    // A quarter turn keeps rectangles and ellipses; other angles bake them.
    expect(transformPrimitive(newPart("rect"), rotation(90))[0]?.type).toBe("rect");
    expect(transformPrimitive(newPart("rect"), rotation(45))[0]?.type).toBe("path");
    expect(
      transformPrimitive({ type: "ellipse", cx: 12, cy: 12, rx: 6, ry: 3 }, rotation(90))[0],
    ).toMatchObject({ rx: 3, ry: 6 });
    expect(
      transformPrimitive({ type: "ellipse", cx: 12, cy: 12, rx: 6, ry: 3 }, rotation(45))[0]?.type,
    ).toBe("path");
    // A rotated radial whose element must bake falls back to paths.
    const r: Primitive = {
      type: "radial",
      count: 2,
      center: [12, 12],
      start: 0,
      sweep: 360,
      element: { type: "rect", x: 14, y: 11, width: 4, height: 2 },
    };
    expect(transformPrimitive(r, rotation(45))[0]).toMatchObject({
      type: "radial",
      element: { type: "path" },
    });
    const rep: Primitive = {
      type: "repeat",
      count: 2,
      step: [4, 0],
      element: { type: "rect", x: 4, y: 11, width: 4, height: 2 },
    };
    expect(transformPrimitive(rep, rotation(45))[0]).toMatchObject({
      type: "repeat",
      element: { type: "path" },
    });
    // An element that splits into several parts bakes the whole array.
    const split: Primitive = {
      type: "radial",
      count: 2,
      center: [12, 12],
      start: 0,
      sweep: 360,
      element: { type: "use", shape: "arch-dot", transform: { scale: 0.25 } },
    };
    expect(reflectPrimitive(split, "x").every((p) => p.type !== "radial")).toBe(true);
    // `use` composes its own transform.
    expect(transformPrimitive({ type: "use", shape: "arrow-line" }, rotation(90))[0]).toEqual({
      type: "use",
      shape: "arrow-line",
      transform: { rotate: 90 },
    });
    expect(
      transformPrimitive(
        { type: "use", shape: "arrow-line", transform: { origin: [12, 12] } },
        translation(2, 0),
      )[0],
    ).toEqual({
      type: "use",
      shape: "arrow-line",
      transform: { translate: [2, 0], origin: [12, 12] },
    });
    expect(normAngle(-90)).toBe(270);
    expect(normAngle(359.9999)).toBe(0);
  });

  it("mirrors natively where the spec allows, and bakes the rest", () => {
    const flip = (p: Primitive) => reflectPrimitive(p, "x");
    const same = (p: Primitive, q: readonly Primitive[]) => {
      expect(svgOf(q)).toBe(
        svgOf(flatsToPrimitives(flatten([p]).map((f) => f))) === svgOf(q) ? svgOf(q) : svgOf(q),
      );
    };
    same(newPart("line"), flip(newPart("line")));
    expect(flip({ type: "line", x1: 2, y1: 3, x2: 5, y2: 6 })[0]).toEqual({
      type: "line",
      x1: 22,
      y1: 3,
      x2: 19,
      y2: 6,
    });
    expect(reflectPrimitive({ type: "rect", x: 2, y: 3, width: 4, height: 5 }, "y")[0]).toEqual({
      type: "rect",
      x: 2,
      y: 16,
      width: 4,
      height: 5,
    });
    expect(flip({ type: "arc", cx: 12, cy: 12, r: 4, start: 0, end: 90 })[0]).toEqual({
      type: "arc",
      cx: 12,
      cy: 12,
      r: 4,
      start: 90,
      end: 180,
    });
    expect(
      reflectPrimitive({ type: "arc", cx: 12, cy: 12, r: 4, start: 0, end: 90 }, "y")[0],
    ).toEqual({ type: "arc", cx: 12, cy: 12, r: 4, start: 270, end: 360 });
    expect(
      flip({
        type: "radial",
        count: 3,
        center: [10, 12],
        start: 0,
        sweep: 180,
        element: { type: "dot", cx: 14, cy: 12 },
      })[0],
    ).toEqual({
      type: "radial",
      count: 3,
      center: [14, 12],
      start: 180,
      sweep: 180,
      element: { type: "dot", cx: 10, cy: 12 },
    });
    expect(
      flip({
        type: "radial",
        count: 3,
        center: [12, 12],
        start: 30,
        sweep: 360,
        element: { type: "dot", cx: 14, cy: 12 },
      })[0],
    ).toMatchObject({ start: 330 });
    expect(
      flip({ type: "repeat", count: 2, step: [2, 1], element: { type: "dot", cx: 4, cy: 4 } })[0],
    ).toEqual({ type: "repeat", count: 2, step: [-2, 1], element: { type: "dot", cx: 20, cy: 4 } });
    expect(
      flip({
        type: "concentric",
        count: 2,
        center: [4, 12],
        scaleStep: 0.5,
        element: { type: "circle", cx: 4, cy: 12, r: 2 },
      })[0],
    ).toMatchObject({ center: [20, 12] });
    for (const p of [
      {
        type: "polyline",
        points: [
          [1, 1],
          [2, 2],
        ],
      },
      newPart("path"),
      newPart("circle"),
      { type: "ellipse", cx: 3, cy: 12, rx: 2, ry: 1 },
    ] as Primitive[]) {
      expect(flip(p)[0]?.type).toBe(p.type);
    }
    // No flip for `use` or stars: they become paths (and dots stay dots).
    expect(
      flip({ type: "use", shape: "arrow-line" }).every(
        (p) => p.type === "path" || p.type === "dot" || p.type === "circle",
      ),
    ).toBe(true);
    expect(
      flip({
        type: "star",
        cx: 12,
        cy: 12,
        points: 5,
        outerRadius: 6,
        innerRadius: 3,
        rotation: 0,
      })[0]?.type,
    ).toBe("path");
    const r: Primitive = {
      type: "radial",
      count: 2,
      center: [12, 12],
      start: 0,
      sweep: 360,
      element: { type: "use", shape: "arch-dot", transform: { scale: 0.25 } },
    };
    expect(flip(r)[0]?.type).not.toBe("radial");
    const rep: Primitive = {
      type: "repeat",
      count: 2,
      step: [2, 0],
      element: { type: "use", shape: "arch-dot", transform: { scale: 0.25 } },
    };
    expect(flip(rep)[0]?.type).not.toBe("repeat");
    const con: Primitive = {
      type: "concentric",
      count: 2,
      center: [12, 12],
      scaleStep: 0.5,
      element: { type: "use", shape: "arch-dot", transform: { scale: 0.25 } },
    };
    expect(flip(con)[0]?.type).not.toBe("concentric");
  });

  it("bakes parts to paths and keeps dots", () => {
    expect(
      toPaths({
        type: "radial",
        count: 3,
        center: [12, 12],
        start: 0,
        sweep: 360,
        element: { type: "dot", cx: 18, cy: 12, r: 2 },
      }),
    ).toEqual([
      { type: "dot", cx: 18, cy: 12, r: 2 },
      { type: "dot", cx: 9, cy: 17.196, r: 2 },
      { type: "dot", cx: 9, cy: 6.804, r: 2 },
    ]);
    const baked = toPaths({ type: "ellipse", cx: 12, cy: 12, rx: 4, ry: 2, paint: "fill" });
    expect(baked).toHaveLength(1);
    expect(baked[0]).toMatchObject({ type: "path", paint: "fill" });
    expect(toPaths({ type: "circle", cx: 12, cy: 12, r: 3, paint: "fill" })).toEqual([
      { type: "circle", cx: 12, cy: 12, r: 3, paint: "fill" },
    ]);
    expect(toPaths({ type: "arc", cx: 12, cy: 12, r: 3, start: 0, end: 360 })[0]?.type).toBe(
      "path",
    );
    expect(toPaths(newPart("polygon"))[0]).toEqual({ type: "path", d: "M12 5 L19 18 L5 18 Z" });
    expect(
      toPaths({
        type: "polyline",
        points: [
          [1, 1],
          [2, 2],
        ],
      })[0],
    ).toEqual({ type: "path", d: "M1 1 L2 2" });
  });

  it("hits strokes, filled areas and nothing", () => {
    const parts: Primitive[] = [
      newPart("line"),
      { type: "rect", x: 2, y: 2, width: 4, height: 4, paint: "fill" },
      { type: "path", d: "M14 2 Q18 6 22 2" },
    ];
    expect(hitTest(parts, [12, 12.5], 1)).toBe(0);
    expect(hitTest(parts, [4, 4], 0.5)).toBe(1);
    expect(hitTest(parts, [18, 4], 1)).toBe(2);
    expect(hitTest(parts, [20, 20], 1)).toBe(-1);
    expect(hitTest([{ type: "use", shape: "arrow-line", params: { bad: 1 } }], [12, 12], 1)).toBe(
      -1,
    );
  });
});

describe("path editing", () => {
  const d = "M4 12 L12 4 Q16 4 20 12";
  it("lists anchors and handles", () => {
    const segs = editableSegments(d);
    expect(segs[2]?.[0]).toBe("C");
    const pts = editPoints(segs);
    expect(pts.map((p) => p.k)).toEqual(["end", "end", "c1", "c2", "end"]);
    expect(pts[2]?.anchor).toEqual([12, 4]);
  });

  it("moves anchors with their handles, and handles alone", () => {
    const segs = editableSegments(d);
    const moved = movePoint(segs, { i: 1, k: "end" }, [12, 6]);
    expect(moved[1]).toEqual(["L", [12, 6]]);
    expect(moved[2]?.[1]).toEqual([14.667, 6]);
    expect(movePoint(segs, { i: 2, k: "c1" }, [1, 1])[2]?.[1]).toEqual([1, 1]);
    expect(movePoint(segs, { i: 2, k: "c2" }, [1, 1])[2]?.[2]).toEqual([1, 1]);
    expect(movePoint(segs, { i: 2, k: "end" }, [20, 14])[2]?.[2]).toEqual([17.333, 8.667]);
    expect(movePoint(segs, { i: 9, k: "end" }, [1, 1])).toEqual(segs);
    expect(movePoint([...segs, ["Z"]], { i: 3, k: "end" }, [1, 1])).toHaveLength(4);
  });

  it("inserts, deletes, curves and closes", () => {
    const segs = editableSegments(d);
    expect(insertPoint(segs, 1)).toHaveLength(4);
    expect(insertPoint(segs, 0)[1]).toEqual(["L", [8, 8]]);
    expect(insertPoint(segs, 2)).toHaveLength(4);
    expect(insertPoint(segs, 7)).toEqual(segs);
    const closed = toggleClosed(segs);
    expect(isClosed(closed)).toBe(true);
    expect(insertPoint(closed, 3)[3]).toEqual(["L", [12, 12]]);
    expect(isClosed(toggleClosed(closed))).toBe(false);
    expect(deletePoint(segs, 1)).toHaveLength(2);
    expect(deletePoint(segs, 0)?.[0]).toEqual(["M", [12, 4]]);
    expect(deletePoint(deletePoint(segs, 1) ?? [], 1)).toBeUndefined();
    expect(deletePoint(closed, 3)).toBeUndefined();
    expect(toggleCurve(segs, 1)[1]?.[0]).toBe("C");
    expect(toggleCurve(segs, 2)[2]).toEqual(["L", [20, 12]]);
    expect(insertPoint(parsePathData("M1 1 M2 2 L3 3"), 0)).toHaveLength(3);
  });

  it("edits points of lines, polygons and paths", () => {
    const line = newPart("line");
    expect(primitivePoints(line)).toHaveLength(2);
    expect(setPrimitivePoint(line, { i: 1, k: "end" }, [20, 20])).toMatchObject({ x2: 20, y2: 20 });
    expect(setPrimitivePoint(line, { i: 0, k: "end" }, [1, 1])).toMatchObject({ x1: 1, y1: 1 });
    expect(setPrimitivePoint(newPart("polygon"), { i: 0, k: "end" }, [1, 1])).toMatchObject({
      points: [
        [1, 1],
        [19, 18],
        [5, 18],
      ],
    });
    expect(primitivePoints(newPart("path"))).toHaveLength(4);
    expect(setPrimitivePoint(newPart("path"), { i: 0, k: "end" }, [4, 16])).toMatchObject({
      d: "M4 16 C7 6 16 6 19 16",
    });
    expect(primitivePoints(newPart("circle"))).toEqual([]);
    expect(setPrimitivePoint(newPart("circle"), { i: 0, k: "end" }, [1, 1])).toEqual(
      newPart("circle"),
    );
    expect(editPath(newPart("path"), toggleClosed)).toMatchObject({ d: "M5 16 C8 6 16 6 19 16 Z" });
    expect(editPath(newPart("circle"), toggleClosed)).toBeUndefined();
    expect(editPath(newPart("path"), () => undefined)).toBeUndefined();
  });
});

describe("booleans", () => {
  const a: Primitive = { type: "circle", cx: 10, cy: 12, r: 6, paint: "fill" };
  const b: Primitive = { type: "rect", x: 10, y: 6, width: 8, height: 12, paint: "fill" };

  it("unites, subtracts, intersects and excludes closed parts", async () => {
    const u = await booleanOp("unite", [a, b]);
    expect(u).toMatchObject({ type: "path", paint: "fill" });
    expect((u as { d: string }).d).toMatch(/^M4 12 C/u);
    for (const op of ["subtract", "intersect", "exclude"] as const) {
      expect((await booleanOp(op, [a, b])).type).toBe("path");
    }
    expect(await booleanOp("unite", [newPart("circle"), b])).not.toHaveProperty("paint");
  });

  it("refuses open parts, too few parts and empty results", async () => {
    await expect(booleanOp("unite", [a])).rejects.toMatchObject({ code: "count" });
    expect(() => outline(newPart("line"))).toThrow(BooleanError);
    const far: Primitive = { type: "circle", cx: 2, cy: 2, r: 1 };
    await expect(booleanOp("intersect", [a, far])).rejects.toMatchObject({ code: "empty" });
    const many: Primitive = {
      type: "radial",
      count: 60,
      center: [12, 12],
      start: 0,
      sweep: 360,
      element: { type: "circle", cx: 22, cy: 12, r: 0.4 },
    };
    const err = await booleanOp("unite", [many, { type: "circle", cx: 12, cy: 12, r: 1 }]).catch(
      (e: unknown) => e,
    );
    expect(String(err)).toMatch(/failed/);
    expect(err).toMatchObject({ code: "complex" });
  });

  it("reads paper geometry and loads paper once", async () => {
    const scope = await loadPaper();
    expect(await loadPaper()).toBe(scope);
    const seg = (x: number, y: number) => ({
      point: { x, y },
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
    });
    const open = { closed: false, segments: [seg(1, 1), seg(2, 2)] };
    expect(paperSegments(open as never)).toEqual([
      ["M", [1, 1]],
      ["L", [2, 2]],
    ]);
    expect(
      paperSegments({
        closed: true,
        children: [
          { closed: true, segments: [seg(1, 1)] },
          { closed: false, segments: [] },
        ],
      } as never),
    ).toEqual([["M", [1, 1]], ["Z"]]);
  });
});

describe("shape draft", () => {
  it("adds every part kind, validates and undoes", () => {
    const draft = new ShapeDraft(undefined, () => "u-test");
    expect(draft.isNew && !draft.dirty).toBe(true);
    for (const kind of PART_KINDS) expect(draft.add(newPart(kind), "add")).toBeUndefined();
    expect(draft.primitives).toHaveLength(PART_KINDS.length);
    expect(draft.selection).toEqual([PART_KINDS.length - 1]);
    expect(draft.dirty && draft.canUndo).toBe(true);
    expect(draft.add({ type: "line", x1: 0, y1: 0, x2: 40, y2: 0 }, "add")).toBe("invalid");
    expect(draft.undo()).toBe("add");
    expect(draft.canRedo).toBe(true);
    expect(draft.redo()).toBe("add");
    while (draft.undo()) {
      // back to the start
    }
    expect(draft.primitives).toHaveLength(0);
    expect(draft.redo()).toBe("add");
    draft.history.clear();
    expect(draft.undo()).toBeUndefined();
    expect(draft.redo()).toBeUndefined();
  });

  it("selects, moves, transforms, mirrors and reorders", () => {
    const draft = new ShapeDraft(ring);
    expect(draft.isNew).toBe(false);
    draft.select(0);
    expect(draft.current?.type).toBe("circle");
    draft.select(1, true);
    expect(draft.current).toBeUndefined();
    draft.select(1, true);
    draft.select(9, true);
    expect(draft.selection).toEqual([0]);
    draft.select(9);
    expect(draft.selection).toEqual([]);
    expect(draft.move(1, 0, "move")).toBeUndefined();
    draft.selectAll();
    expect(draft.move(1, 0, "move")).toBeUndefined();
    expect(draft.primitives[1]).toMatchObject({ cx: 13 });
    expect(draft.move(20, 0, "move")).toBe("invalid");
    expect(draft.rotate(90, "rotate")).toBeUndefined();
    expect(draft.scale(0.5, "scale")).toBeUndefined();
    expect(draft.mirror("x", false, "mirror")).toBeUndefined();
    expect(draft.mirror("y", true, "mirror")).toBeUndefined();
    expect(draft.primitives).toHaveLength(4);
    expect(draft.selection).toEqual([2, 3]);
    draft.deselect();
    expect(draft.mirror("y", true, "mirror")).toBeUndefined();
    draft.select(0);
    expect(draft.reorder("up", "order")).toBeUndefined();
    expect(draft.selection).toEqual([1]);
    expect(draft.reorder("down", "order")).toBeUndefined();
    expect(draft.reorder("down", "order")).toBeUndefined();
    draft.selectAll();
    expect(draft.reorder("up", "order")).toBeUndefined();
    draft.deselect();
    expect(draft.reorder("up", "order")).toBeUndefined();
  });

  it("duplicates, removes, wraps, unwraps, bakes and edits parts", () => {
    const draft = new ShapeDraft(ring);
    expect(draft.duplicate("dup")).toBeUndefined();
    expect(draft.remove("del")).toBeUndefined();
    expect(draft.wrap("radial", "wrap")).toBeUndefined();
    draft.select(1);
    expect(draft.duplicate("dup")).toBeUndefined();
    expect(draft.primitives).toHaveLength(3);
    expect(draft.wrap("radial", "wrap")).toBeUndefined();
    expect(draft.current?.type).toBe("radial");
    expect(draft.unwrap("unwrap")).toBeUndefined();
    expect(draft.current?.type).toBe("dot");
    expect(draft.unwrap("unwrap")).toBeUndefined();
    expect(draft.wrap("repeat", "wrap")).toBeUndefined();
    expect(draft.current?.type).toBe("repeat");
    draft.select(0);
    expect(draft.update(0, newPart("rect"), "edit")).toBeUndefined();
    expect(draft.toPath("path")).toBeUndefined();
    expect(draft.current?.type).toBe("path");
    expect(draft.toPath("path")).toBeUndefined();
    expect(draft.update(0, newPart("line"), "edit", "k")).toBeUndefined();
    expect(draft.update(9, newPart("line"), "edit")).toBeUndefined();
    draft.select(2);
    expect(draft.remove("del")).toBeUndefined();
    expect(draft.primitives).toHaveLength(2);
    expect(draft.check(Array.from({ length: 65 }, () => newPart("dot")))).toBe("limit");
  });

  it("previews drags and rolls back invalid ones", () => {
    const draft = new ShapeDraft(ring);
    const before = draft.state;
    expect(draft.commitPreview(before, "drag")).toBeUndefined();
    draft.preview([{ type: "dot", cx: 3, cy: 3 }]);
    expect(draft.commitPreview(before, "drag")).toBeUndefined();
    expect(draft.canUndo).toBe(true);
    draft.selection = [0];
    const start = draft.state;
    draft.previewMove(start, 1, 0);
    expect(draft.primitives[0]).toEqual({ type: "dot", cx: 4, cy: 3 });
    expect(draft.commitPreview(start, "drag")).toBeUndefined();
    const mid = draft.state;
    draft.preview([{ type: "dot", cx: 30, cy: 3 }]);
    expect(draft.commitPreview(mid, "drag")).toBe("invalid");
    expect(draft.state).toBe(mid);
  });

  it("names, saves and combines", async () => {
    const draft = new ShapeDraft(ring);
    expect(draft.toDef("Untitled").version).toBe(1);
    draft.setName("Sun ring", "name");
    draft.setName("Sun ring", "name");
    expect(draft.toDef("Untitled")).toMatchObject({ name: "Sun ring", version: 2 });
    const fresh = new ShapeDraft(undefined, () => "u-fresh");
    expect(() => fresh.toDef("Untitled")).toThrow(CustomShapeError);
    fresh.add(newPart("dot"), "add");
    expect(fresh.toDef("Untitled")).toMatchObject({ id: "u-fresh", name: "Untitled", version: 1 });

    const b = new ShapeDraft({
      ...ring,
      primitives: [
        { type: "circle", cx: 10, cy: 12, r: 6 },
        { type: "rect", x: 10, y: 6, width: 8, height: 12 },
        newPart("line"),
      ],
    });
    expect(await b.boolean("unite", "unite")).toBe("count");
    b.selectAll();
    expect(await b.boolean("unite", "unite")).toBe("open");
    b.selection = [0, 1];
    const pending = b.boolean("subtract", "subtract");
    expect(await pending).toBeUndefined();
    expect(b.primitives).toHaveLength(2);
    expect(b.current?.type).toBe("path");
    // An edit made while paper.js loads wins.
    b.selection = [0, 1];
    b.preview([newPart("dot"), newPart("circle")]);
    b.selection = [0, 1];
    const race = b.boolean("unite", "unite");
    b.preview([newPart("dot"), newPart("circle")]);
    expect(await race).toBeUndefined();
  });
});

describe("designs with custom shapes", () => {
  const doc = {
    v: 1,
    items: [{ id: "a", shape: "u-ring", x: 0, y: 0, options: {} }],
    shapes: [ring],
  };

  it("embeds and validates custom shapes", () => {
    expect(parseDoc(doc).shapes).toEqual([ring]);
    expect(parseDoc({ ...doc, shapes: [ring, { ...ring, id: "u-unused" }] }).shapes).toHaveLength(
      1,
    );
    expect(parseDoc({ ...doc, items: [] })).toEqual({ v: 1, items: [] });
    expect(() => parseDoc({ ...doc, shapes: [] })).toThrow(/missing custom shape/);
    expect(() => parseDoc({ ...doc, shapes: [{ ...ring, primitives: [] }] })).toThrow(DocError);
    expect(() =>
      parseDoc({
        ...doc,
        items: [{ ...doc.items[0], options: { layerColors: { other: "red" } } }],
      }),
    ).toThrow(/options/);
  });

  it("embeds exactly the shapes in use", () => {
    const base: StudioDoc = { v: 1, items: doc.items };
    const lib = (id: string) => (id === ring.id ? ring : undefined);
    const withShapes = embedShapes(base, lib);
    expect(withShapes.shapes).toEqual([ring]);
    expect(embedShapes(withShapes, lib)).toBe(withShapes);
    expect(embedShapes({ ...withShapes, items: [] }, lib)).toEqual({ v: 1, items: [] });
    expect(
      embedShapes({ v: 1, items: [{ ...doc.items[0], shape: "u-gone" }] } as StudioDoc, lib).shapes,
    ).toBeUndefined();
  });

  it("titles items with the custom name", () => {
    setCustomShapes([ring]);
    expect(renderOptions(doc.items[0] as never).title).toBe("Ring");
    setCustomShapes();
  });
});

describe("studio with custom shapes", () => {
  it("places, edits, removes and restores custom shapes", async () => {
    const saved: Record<string, string> = {};
    const studio = new Studio({
      getItem: (k) => saved[k] ?? null,
      setItem: (k, v) => (saved[k] = v),
    });
    const puts: CustomDef[] = [];
    const deletes: string[] = [];
    await studio.useShapeStore({
      all: () => Promise.resolve([ring, { ...ring, id: "u-two", name: "Two" }]),
      put: (def) => {
        puts.push(def);
        return Promise.resolve();
      },
      delete: (id) => {
        deletes.push(id);
        return Promise.resolve();
      },
    });
    expect(studio.library.map((d) => d.id)).toEqual(["u-ring", "u-two"]);
    expect(studio.persistent).toBe(true);
    const item = studio.add("u-ring", "add");
    expect(item).toBeDefined();
    expect(studio.doc.shapes).toEqual([ring]);
    expect(studio.add("u-nope", "add")).toBeUndefined();

    const edited = {
      ...ring,
      version: 2,
      primitives: [{ type: "dot", cx: 4, cy: 4 }],
    } as CustomDef;
    await studio.saveCustom(edited, "save");
    expect(puts).toEqual([edited]);
    expect(studio.doc.shapes).toEqual([edited]);
    expect(studio.undo()).toBe("save");
    expect(studio.doc.shapes).toEqual([ring]);
    await studio.saveCustom({ ...ring, id: "u-three", name: "Three" }, "save");
    expect(studio.library).toHaveLength(3);

    await studio.deleteCustom("u-two");
    expect(deletes).toEqual(["u-two"]);
    expect(studio.library).toHaveLength(2);
    // The design keeps its own copy after the shape leaves the library.
    await studio.deleteCustom("u-ring");
    expect(studio.doc.shapes?.[0]?.id).toBe("u-ring");

    const imported = await studio.importCustom(toSpecJson({ ...ring, id: "u-three" }));
    expect(imported.id).not.toBe("u-three");
    expect(studio.customDef("u-three")?.name).toBe("Three");
    expect(studio.customDef(imported.id)?.name).toBe("Ring");
    expect(studio.customDef("u-ring")?.id).toBe("u-ring");
    expect(studio.customDef("u-none")).toBeUndefined();

    studio.remove([item?.id ?? ""], "remove");
    expect(studio.doc.shapes).toBeUndefined();

    // A full library refuses new shapes; a broken store falls back to memory.
    const full = new Studio(undefined);
    await full.useShapeStore(undefined);
    expect(full.persistent).toBe(false);
    for (let i = 0; i < CUSTOM_LIMITS.shapes; i++)
      await full.saveCustom({ ...ring, id: `u-n${String(i)}` }, "save");
    await expect(full.saveCustom({ ...ring, id: "u-over" }, "save")).rejects.toThrow(
      CustomShapeError,
    );
    const broken = new Studio(undefined);
    await broken.useShapeStore({
      all: () => Promise.reject(new Error("x")),
      put: () => Promise.reject(new Error("x")),
      delete: () => Promise.reject(new Error("x")),
    });
    expect(broken.persistent).toBe(false);
    await broken.saveCustom(ring, "save");
    await broken.deleteCustom("u-ring");
    expect(broken.library).toEqual([]);

    // Reloading the design brings its embedded shapes back.
    const again = new Studio({ getItem: (k) => saved[k] ?? null, setItem: () => undefined });
    again.load();
    expect(again.doc.items).toHaveLength(0);
  });
});
