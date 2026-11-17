import { describe, expect, it } from "vitest";

import { DeqError, FLAG, flagSize, listFlagVariants, renderFlag } from "./index.js";

describe("renderFlag", () => {
  it("lists the spec variants in order", () => {
    expect(listFlagVariants()).toEqual(FLAG.variants.map((v) => v.id));
    expect(listFlagVariants()).toContain("full-color");
  });

  it("defaults to the full-colour flag at 900 x 600", () => {
    const svg = renderFlag();
    expect(svg).toMatch(/^<svg [^>]*width="900" height="600" viewBox="0 0 900 600"/);
    expect(svg).toContain('fill="#ED2024"');
    expect(svg).toContain("<title>Flag of Kurdistan</title>");
  });

  it("keeps the aspect ratio when scaling", () => {
    expect(renderFlag({ width: 300 })).toContain('width="300" height="200"');
    expect(renderFlag({ variant: "square", width: 64 })).toContain('width="64" height="64"');
    const square = FLAG.variants.find((v) => v.id === "square");
    expect(square && flagSize(square, 1)).toEqual([1, 1]);
  });

  it("escapes titles and supports decorative output", () => {
    expect(renderFlag({ title: "<b>" })).toContain('aria-label="&lt;b&gt;"');
    const svg = renderFlag({ title: "" });
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain("<title>");
  });

  it("rejects unknown variants and bad widths", () => {
    expect(() => renderFlag({ variant: "nope" })).toThrow(/variant: must be one of/);
    expect(() => renderFlag({ width: 0 })).toThrow(DeqError);
    expect(() => renderFlag({ width: 1.5 })).toThrow(DeqError);
    expect(() => renderFlag({ extra: 1 } as never)).toThrow(DeqError);
    expect(() => renderFlag(null as never)).toThrow(DeqError);
  });
});
