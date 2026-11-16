import { DeqError } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import { BLACK, parseColor, toCmyk, toHex } from "./color.js";

const hexOf = (c: string): string => toHex(parseColor(c));

describe("parseColor", () => {
  it("reads hex in every length", () => {
    expect(hexOf("#c00")).toBe("#cc0000");
    expect(hexOf("#C00A")).toBe("#cc0000aa");
    expect(hexOf("#123456")).toBe("#123456");
    expect(hexOf("#12345678")).toBe("#12345678");
  });

  it("reads keywords and named colours", () => {
    expect(parseColor("currentColor", [1, 0, 0, 1])).toEqual([1, 0, 0, 1]);
    expect(parseColor("CURRENTCOLOR")).toEqual(BLACK);
    expect(parseColor("transparent")).toEqual([0, 0, 0, 0]);
    expect(hexOf("RebeccaPurple")).toBe("#663399");
    expect(hexOf(" white ")).toBe("#ffffff");
  });

  it("reads rgb and hsl in legacy and modern syntax", () => {
    expect(hexOf("rgb(255, 0, 0)")).toBe("#ff0000");
    expect(hexOf("rgba(0,0,255,0.5)")).toBe("#0000ff80");
    expect(hexOf("rgb(100% 50% 0% / 25%)")).toBe("#ff800040");
    expect(hexOf("rgb(none 0 0)")).toBe("#000000");
    expect(hexOf("hsl(120 100% 25%)")).toBe("#008000");
    expect(hexOf("hsla(-120, 100%, 50%, 1)")).toBe("#0000ff");
    expect(hexOf("hsl(0.5turn 100% 50%)")).toBe("#00ffff");
    expect(hexOf("hsl(3.14159rad 100% 50%)")).toBe("#00ffff");
    expect(hexOf("hsl(200grad 100% 50%)")).toBe("#00ffff");
    expect(hexOf("hsl(180deg 100% 50%)")).toBe("#00ffff");
  });

  it("reads hwb, normalising whiteness plus blackness above 100%", () => {
    expect(hexOf("hwb(0 0% 0%)")).toBe("#ff0000");
    expect(hexOf("hwb(0 60% 60%)")).toBe("#808080");
  });

  it("reads lab, lch, oklab and oklch", () => {
    expect(hexOf("lab(100 0 0)")).toBe("#ffffff");
    expect(hexOf("lab(0% 0 0)")).toBe("#000000");
    expect(hexOf("lch(54.29 106.84 40.85)")).toBe("#ff0000");
    expect(hexOf("oklab(1 0 0)")).toBe("#ffffff");
    expect(hexOf("oklab(62.8% 0.2249 0.1258)")).toBe("#ff0000");
    expect(hexOf("oklch(0.628 0.2577 29.23)")).toBe("#ff0000");
    expect(hexOf("oklch(50% 100% 0 / 0.5)").length).toBe(9);
  });

  it("rejects what it cannot convert", () => {
    for (const bad of [
      "#12",
      "#12345",
      "#ggg",
      "nope",
      "rgb(1 2)",
      "rgb(1 2 3 / 4 / 5)",
      "rgb(a b c)",
      "color(srgb 1 0 0)",
      `rgb(${"1 ".repeat(40)})`,
      "rgb(1, 2, 3, 4, 5)",
    ]) {
      expect(() => parseColor(bad), bad).toThrow(DeqError);
    }
  });
});

describe("toHex and toCmyk", () => {
  it("clamps and drops opaque alpha", () => {
    expect(toHex([2, -1, 0.5, 1])).toBe("#ff0080");
  });

  it("converts to naive CMYK", () => {
    expect(toCmyk([0, 0, 0, 1])).toEqual([0, 0, 0, 1]);
    expect(toCmyk([1, 1, 1, 1])).toEqual([0, 0, 0, 0]);
    expect(toCmyk([1, 0, 0, 1])).toEqual([0, 1, 1, 0]);
    const [c, m, y, k] = toCmyk([0.5, 0.25, 0, 1]);
    expect([c, m, y]).toEqual([0, 0.5, 1]);
    expect(k).toBeCloseTo(0.5);
  });
});
