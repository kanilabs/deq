import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { constructionOf, formatPrimitive, formatValue, gridSvg } from "../src/lib/construction.ts";
import { SHAPES } from "../src/lib/data.ts";

describe("construction", () => {
  it("has steps, metrics and primitives for every shape", () => {
    for (const shape of SHAPES) {
      const c = constructionOf(shape.id);
      expect(c.steps.length, shape.id).toBeGreaterThan(0);
      expect(c.rows.length, shape.id).toBe(shape.primitives.length);
      expect(c.metrics.visualBox, shape.id).toHaveLength(4);
    }
  });

  it("matches the spec file", async () => {
    const spec = JSON.parse(await readFile("../../spec/shapes/kurdish-sun.json", "utf8")) as {
      construction: string[];
      metrics: { opticalCenter: number[] };
    };
    const c = constructionOf("kurdish-sun");
    expect(c.steps).toEqual(spec.construction);
    expect(c.metrics.opticalCenter).toEqual(spec.metrics.opticalCenter);
    expect(c.markers).toContainEqual({ x: 12, y: 12.056 });
    expect(c.rows[0]).toMatchObject({ type: "star", layer: "sun", when: "variant filled" });
    expect(c.rows[0]?.values).toContain("points param rays");
    expect(c.rows[0]?.values).toContain("filled");
  });

  it("formats values and generator elements", () => {
    expect(formatValue([12, 14])).toBe("(12, 14)");
    expect(formatValue({ param: "rays" })).toBe("param rays");
    expect(formatValue({ variant: ["a", "b"] })).toBe("variant a b");
    expect(
      formatPrimitive({
        type: "radial",
        count: 3,
        center: [12, 14],
        layer: "rays",
        element: { type: "line", x1: 17, y1: 14, x2: 19.5, y2: 14 },
      }),
    ).toBe("count 3, center (12, 14), element: line x1 17, y1 14, x2 19.5, y2 14");
  });

  it("rejects unknown shapes", () => {
    expect(() => constructionOf("nope")).toThrow(/nope/u);
  });

  it("draws the grid, keylines and markers with an escaped label", () => {
    const svg = gridSvg([{ x: 12, y: 12.056 }], 'Sun "<x>"');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('<circle class="key" cx="12" cy="12" r="10"/>');
    expect(svg).toContain('<rect class="live" x="1" y="1" width="22" height="22"/>');
    expect(svg).toContain('cy="12.056"');
    expect(svg).toContain("&quot;&lt;x&gt;&quot;");
  });
});
