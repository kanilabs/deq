import { DeqError, listShapes, render } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import { generate, innerMarkup, parseNode } from "../scripts/generate.ts";
import * as strings from "./generated/svg.js";
import {
  iconComponentName,
  iconExportName,
  icons,
  kurdishSun,
  packageName,
  rojHalfSun,
  rootAttributes,
  toSvg,
} from "./index.js";
import type { IconOptions } from "./index.js";
import { readFileSync } from "node:fs";

describe("icon data", () => {
  it("is generated fresh from core", () => {
    const files = generate();
    const dir = new URL("./generated/", import.meta.url);
    expect(readFileSync(new URL("icons.ts", dir), "utf8")).toBe(files.icons);
    expect(readFileSync(new URL("svg.ts", dir), "utf8")).toBe(files.svg);
  });

  it("has every catalog shape, in catalog order", () => {
    expect(Object.keys(icons)).toEqual(listShapes().map((s) => s.id));
    expect(packageName).toBe("@0xdolan/deq-icons");
  });

  it.each(listShapes().map((s) => s.id))("%s matches core with default options", (id) => {
    const icon = icons[id];
    if (!icon) throw new Error(id);
    expect(toSvg(icon)).toBe(render(id));
    expect((strings as Record<string, string>)[iconExportName(id)]).toBe(render(id));
  });

  const OPTIONS: [IconOptions, Parameters<typeof render>[1]][] = [
    [{ size: 48 }, { size: 48 }],
    [
      { color: "#ED2024", strokeWidth: 1.5 },
      { color: "#ED2024", strokeWidth: 1.5 },
    ],
    [
      { size: 64, strokeWidth: 1, absoluteStrokeWidth: true },
      { size: 64, strokeWidth: 1, absoluteStrokeWidth: true },
    ],
    [{ title: "" }, { title: "" }],
    [{ title: "Sun & <moon>" }, { title: "Sun & <moon>" }],
  ];
  it.each(OPTIONS)("matches core with %j", (options, core) => {
    for (const icon of [rojHalfSun, kurdishSun])
      expect(toSvg(icon, options)).toBe(render(icon.name, core));
  });
});

describe("toSvg", () => {
  it("accepts CSS lengths and string stroke widths", () => {
    const svg = toSvg(rojHalfSun, { size: "2em", strokeWidth: "1.5" });
    expect(svg).toContain('width="2em" height="2em"');
    expect(svg).toContain('stroke-width="1.5"');
  });

  it.each<IconOptions>([
    { size: 0 },
    { size: "2 em" },
    { size: "calc(1px)" },
    { strokeWidth: -1 },
    { strokeWidth: "x" },
    { absoluteStrokeWidth: true, size: "2em" },
    { color: 'red" onload="x' },
    { color: "url(#a)" },
    { title: "x".repeat(257) },
  ])("rejects %j", (options) => {
    expect(() => toSvg(rojHalfSun, options)).toThrow(DeqError);
  });

  it("lists root attributes in core's order", () => {
    expect(rootAttributes(rojHalfSun, { color: "red", title: "" }).map(([k]) => k)).toEqual([
      "xmlns",
      "width",
      "height",
      "viewBox",
      "fill",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "color",
      "aria-hidden",
    ]);
  });
});

describe("names and parsing", () => {
  it("names exports and components", () => {
    expect(iconExportName("roj-half-sun")).toBe("rojHalfSun");
    expect(iconComponentName("roj-half-sun")).toBe("RojHalfSun");
    expect(() => iconExportName("1x")).toThrow(/not an icon id/);
  });

  it("rejects markup it does not expect", () => {
    expect(() => parseNode("x", "<g/>")).toThrow(/unexpected/);
    expect(() => parseNode("x", '<rect x="1"/>')).toThrow(/unexpected <rect>/);
    expect(() => parseNode("x", 'text<line x1="1"/>')).toThrow(/unexpected markup/);
    expect(() => parseNode("x", '<line x1="&amp;"/>')).toThrow(/escaped/);
    expect(parseNode("x", '<circle cx="1" cy="2" r="3"/>')).toEqual([
      ["circle", { cx: "1", cy: "2", r: "3" }],
    ]);
    expect(innerMarkup('<svg a="b"><line x1="1"/></svg>')).toBe('<line x1="1"/>');
    expect(() => innerMarkup("<svg>")).toThrow(/not an SVG/);
  });
});
