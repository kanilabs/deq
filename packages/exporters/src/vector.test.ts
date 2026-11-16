import { prepare, resolveOptions, svgDocument } from "@0xdolan/deq-core";
import type { Flat, Prepared, RenderOptions } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import {
  gsRender,
  hasGs,
  hasInkscape,
  inkDiff,
  inkscapeLayers,
  inkscapeToSvg,
  meanDiff,
  pdfHexText,
  pdfObjects,
  rgbaToGray,
} from "../test/tools.js";
import { buildDrawing } from "./drawing.js";
import { writeEps } from "./eps.js";
import { resolveItem } from "./input.js";
import { writePdf } from "./pdf.js";
import { rasterize } from "./raster.js";
import { toLayeredSvg } from "./svg.js";

/** Geometry no catalog shape uses: a rotated ellipse, cubic and quadratic paths, a full arc. */
function exotic(options: RenderOptions = {}): Prepared {
  const items: Flat[] = [
    { kind: "ellipse", cx: 12, cy: 12, rx: 8, ry: 4, rotation: 30, layer: "a", paint: "stroke" },
    {
      kind: "path",
      segments: [
        ["M", [4, 20]],
        ["C", [8, 14], [16, 26], [20, 20]],
        ["Q", [12, 16], [4, 20]],
        ["Z"],
      ],
      layer: "b",
      paint: "stroke",
    },
    {
      kind: "path",
      segments: [["M", [3, 3]], ["L", [8, 3]], ["Z"], ["L", [3, 8]]],
      layer: "b",
      paint: "stroke",
    },
    { kind: "arc", cx: 12, cy: 12, r: 3, start: 0, end: 360, layer: "c", paint: "stroke" },
    { kind: "arc", cx: 12, cy: 12, r: 6, start: 200, end: 340, layer: "c", paint: "stroke" },
    { kind: "poly", points: [], closed: false, layer: "c", paint: "stroke" },
    {
      kind: "poly",
      points: [
        [18, 3],
        [21, 6],
        [18, 9],
      ],
      closed: true,
      layer: "c",
      paint: "fill",
    },
  ];
  return {
    options: resolveOptions(options),
    items,
    layers: ["a", "b", "c"],
    defaultTitle: "Exotic",
  };
}

const CASES: readonly (readonly [string, () => Prepared])[] = [
  ["roj-half-sun", () => resolveItem("roj-half-sun").prepared],
  [
    "kurdish-sun rotated with fill",
    () => resolveItem({ shape: "kurdish-sun", options: { rotation: 30, fill: "#ccc" } }).prepared,
  ],
  [
    "dimlich flipped, padded, on a background",
    () =>
      resolveItem({
        shape: "dimlich",
        options: {
          flipX: true,
          flipY: true,
          padding: 2,
          background: "#ffeecc",
          linecap: "butt",
          linejoin: "miter",
        },
      }).prepared,
  ],
  ["kurdish-flag", () => resolveItem("kurdish-flag").prepared],
  [
    "lozenge with absolute stroke and bevel joins",
    () =>
      resolveItem({
        shape: "lozenge",
        options: {
          absoluteStrokeWidth: true,
          strokeWidth: 3,
          linejoin: "bevel",
          linecap: "square",
        },
      }).prepared,
  ],
  ["exotic geometry", () => exotic({ fill: "currentColor", fillOpacity: 0.3 })],
];

describe("drawing", () => {
  it("mirrors core's paint rules and options", () => {
    const d = buildDrawing(
      resolveItem({ shape: "roj-half-sun", options: { size: 48, padding: 2 } }).prepared,
    );
    expect(d.width).toBe(36);
    // 48 px is 36 pt over a padded 28-unit viewBox.
    const k = 36 / 28;
    expect(d.base).toEqual([k, 0, 0, -k, 2 * k, 36 - 2 * k]);
    expect(d.layers.map((l) => l.id)).toEqual(["arc", "rays", "center"]);
    expect(d.layers[2]?.ops[0]).toMatchObject({ fill: [0, 0, 0, 1] });
    expect(d.layers[0]?.ops[0]?.fill).toBeUndefined();
    expect(d.transforms).toEqual([]);
    expect(d.title).toBe("Half sun");
    expect(
      buildDrawing(resolveItem({ shape: "chevron", options: { title: "T" } }).prepared).title,
    ).toBe("T");
  });

  it("applies layer colours, opacities and absolute stroke width", () => {
    const d = buildDrawing(
      resolveItem({
        shape: "roj-half-sun",
        options: {
          color: "blue",
          layerColors: { rays: "red", center: "currentColor" },
          strokeOpacity: 0.5,
          absoluteStrokeWidth: true,
          size: 48,
        },
      }).prepared,
      [0, 1, 0, 1],
    );
    expect(d.layers[1]?.ops[0]?.stroke).toEqual([1, 0, 0, 0.5]);
    expect(d.layers[2]?.ops[0]?.fill).toEqual([0, 0, 1, 0.5]);
    expect(d.lineWidth).toBe(1);
  });
});

describe("PDF", () => {
  it("has a valid cross-reference table, info and one OCG per layer", () => {
    const pdf = writePdf(
      buildDrawing(
        resolveItem({ shape: "roj-half-sun", options: { background: "white", title: "Roj ☀ 𝄞" } })
          .prepared,
      ),
    );
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.7\n")).toBe(true);
    const objects = pdfObjects(pdf);
    expect(objects[0]).toContain("/OCProperties");
    expect(objects[0]).toContain("/PageMode /UseOC");
    const ocgs = objects.filter((o) => o.startsWith("<< /Type /OCG"));
    expect(ocgs.map((o) => pdfHexText(/\/Name (<[0-9A-F]+>)/.exec(o)?.[1] ?? ""))).toEqual([
      "background",
      "arc",
      "rays",
      "center",
    ]);
    expect(pdfHexText(/\/Title (<[0-9A-F]+>)/.exec(objects[4] ?? "")?.[1] ?? "")).toBe("Roj ☀ 𝄞");
    const stream = objects[3] ?? "";
    expect(Number(/\/Length (\d+)/.exec(stream)?.[1])).toBe(
      stream.slice(stream.indexOf("stream\n") + 7, stream.lastIndexOf("endstream")).length,
    );
    expect(stream).toContain("/OC /OCbg BDC");
    expect(stream).toContain("/OC /OC2 BDC");
  });

  it("is deterministic", () => {
    const d = buildDrawing(resolveItem("kurdish-sun").prepared);
    expect(writePdf(d)).toEqual(writePdf(d));
  });

  it("writes without layers, in CMYK and with alpha states", () => {
    const d = buildDrawing(
      resolveItem({ shape: "roj-half-sun", options: { color: "red", strokeOpacity: 0.5 } })
        .prepared,
    );
    const flat = new TextDecoder("latin1").decode(
      writePdf(d, { layers: false, colorSpace: "cmyk", creator: "me" }),
    );
    expect(flat).not.toContain("/OCProperties");
    expect(flat).not.toContain("BDC");
    expect(flat).toContain("0 1 1 0 K");
    expect(flat).toContain("/GS1 << /Type /ExtGState /CA 0.5 /ca 1 >>");
    expect(flat).toContain("/GS1 gs");
  });

  it.skipIf(!hasGs).each(CASES)("renders like the SVG in Ghostscript: %s", (_name, make) => {
    const p = make();
    const size = 96;
    const sized: Prepared = { ...p, options: { ...p.options, size } };
    const d = buildDrawing(sized);
    return rasterize(svgDocument(sized).replace(/currentColor/g, "#000"), size).then((bmp) => {
      const want = rgbaToGray(bmp.width, bmp.height, bmp.data);
      expect(meanDiff(gsRender(writePdf(d), "pdf", d.width, size), want)).toBeLessThan(5);
      // Ghostscript maps CMYK through ICC profiles, so compare where ink is, not its tone.
      expect(
        inkDiff(gsRender(writePdf(d, { colorSpace: "cmyk" }), "pdf", d.width, size), want),
      ).toBeLessThan(0.03);
    });
  });
});

describe("EPS", () => {
  it("has DSC headers, ASCII-only comments and no transparency operators", () => {
    const eps = writeEps(
      buildDrawing(
        resolveItem({
          shape: "roj-half-sun",
          options: { title: "Roj (sun) ☀", size: 30, background: "#eee" },
        }).prepared,
      ),
    );
    expect(eps.split("\n").slice(0, 4)).toEqual([
      "%!PS-Adobe-3.0 EPSF-3.0",
      "%%BoundingBox: 0 0 23 23",
      "%%HiResBoundingBox: 0 0 22.5 22.5",
      "%%Title: Roj ?sun? ?",
    ]);
    expect(eps).toContain("% layer: rays");
    expect(eps).toMatch(/[\x20-\x7e\n]*/);
    expect(eps.endsWith("showpage\n%%EOF\n")).toBe(true);
    expect(
      writeEps(buildDrawing(resolveItem("chevron").prepared), { colorSpace: "cmyk" }),
    ).toContain("0 0 0 1 setcmykcolor");
  });

  it.skipIf(!hasGs).each(CASES)("renders like the SVG in Ghostscript: %s", (_name, make) => {
    const p = make();
    const size = 96;
    const sized: Prepared = { ...p, options: { ...p.options, size, fillOpacity: 1 } };
    const d = buildDrawing(sized);
    return rasterize(svgDocument(sized).replace(/currentColor/g, "#000"), size).then((bmp) => {
      const want = rgbaToGray(bmp.width, bmp.height, bmp.data);
      expect(meanDiff(gsRender(writeEps(d), "eps", d.width, size), want)).toBeLessThan(5);
    });
  });
});

describe.skipIf(!hasInkscape)("Inkscape opens the layered files with their layers", () => {
  const item = { shape: "roj-half-sun", options: { background: "#eeeeee" } } as const;

  it("layered SVG", () => {
    expect(inkscapeLayers(inkscapeToSvg(toLayeredSvg(item), "svg"))).toEqual([
      "arc",
      "rays",
      "center",
    ]);
  });

  it("PDF and AI", () => {
    const pdf = writePdf(buildDrawing(resolveItem(item).prepared));
    const want = ["background", "arc", "rays", "center"];
    expect(inkscapeLayers(inkscapeToSvg(pdf, "pdf"))).toEqual(want);
    expect(inkscapeLayers(inkscapeToSvg(pdf, "ai"))).toEqual(want);
  });

  it("composition layers survive", () => {
    const r = resolveItem({
      parts: [{ shape: "chevron" }, { shape: "roj-half-sun", layer: "sun" }],
    });
    expect(inkscapeLayers(inkscapeToSvg(writePdf(buildDrawing(r.prepared)), "pdf"))).toEqual([
      "chevron",
      "sun",
    ]);
    expect(prepare(r.shape, r.options).layers).toEqual(["chevron", "sun"]);
  });
});
