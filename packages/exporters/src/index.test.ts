import { DeqError, render } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import { FORMATS, exportShapes, packageName } from "./index.js";
import type { ExportFormat, ExportOptions } from "./index.js";

const ITEMS = ["roj-half-sun", { shape: "chevron", name: "arrow" }] as const;

const EXPECTED: Record<Exclude<ExportFormat, "favicon">, readonly [string[], string]> = {
  svg: [["roj-half-sun.svg", "arrow.svg"], "image/svg+xml"],
  "svg-layered": [["roj-half-sun.svg", "arrow.svg"], "image/svg+xml"],
  "svg-sprite": [["deq-sprite.svg"], "image/svg+xml"],
  html: [["roj-half-sun.html", "arrow.html"], "text/html"],
  jsx: [["RojHalfSun.jsx", "Arrow.jsx"], "text/jsx"],
  tsx: [["RojHalfSun.tsx", "Arrow.tsx"], "text/tsx"],
  vue: [["RojHalfSun.vue", "Arrow.vue"], "text/x-vue"],
  svelte: [["RojHalfSun.svelte", "Arrow.svelte"], "text/x-svelte"],
  "data-uri": [["roj-half-sun.txt", "arrow.txt"], "text/plain"],
  "css-background": [["deq-background.css"], "text/css"],
  "css-mask": [["deq-mask.css"], "text/css"],
  pdf: [["roj-half-sun.pdf", "arrow.pdf"], "application/pdf"],
  ai: [["roj-half-sun.ai", "arrow.ai"], "application/postscript"],
  eps: [["roj-half-sun.eps", "arrow.eps"], "application/postscript"],
  png: [["roj-half-sun.png", "arrow.png"], "image/png"],
  jpg: [["roj-half-sun.jpg", "arrow.jpg"], "image/jpeg"],
  webp: [["roj-half-sun.webp", "arrow.webp"], "image/webp"],
  avif: [["roj-half-sun.avif", "arrow.avif"], "image/avif"],
  ico: [["roj-half-sun.ico", "arrow.ico"], "image/vnd.microsoft.icon"],
  psd: [["roj-half-sun.psd", "arrow.psd"], "image/vnd.adobe.photoshop"],
  figma: [["roj-half-sun.figma.svg", "arrow.figma.svg"], "image/svg+xml"],
  "spec-json": [["roj-half-sun.json", "arrow.json"], "application/json"],
};

const latin1 = (d: string | Uint8Array): string =>
  typeof d === "string" ? d : new TextDecoder("latin1").decode(d);

describe("exportShapes", () => {
  it("covers every format", () => {
    expect([...Object.keys(EXPECTED), "favicon"].sort()).toEqual([...FORMATS].sort());
    expect(packageName).toBe("@0xdolan/deq-exporters");
  });

  it.each(Object.entries(EXPECTED))("%s", async (format, [names, mediaType]) => {
    const files = await exportShapes(format as ExportFormat, ITEMS);
    expect(files.map((f) => f.name)).toEqual(names);
    for (const f of files) {
      expect(f.mediaType).toBe(mediaType);
      expect(f.data.length).toBeGreaterThan(0);
    }
  });

  it("passes render options through and lets items override them", async () => {
    const [sun, arrow] = await exportShapes(
      "svg",
      ["roj-half-sun", { shape: "chevron", name: "arrow", options: { color: "blue" } }],
      { render: { color: "red", size: 32 } },
    );
    expect(sun?.data).toBe(`${render("roj-half-sun", { color: "red", size: 32 })}\n`);
    expect(arrow?.data).toBe(`${render("chevron", { color: "blue", size: 32 })}\n`);
  });

  it("writes raster and PSD scales with suffixes", async () => {
    const png = await exportShapes("png", ["chevron"], { scales: [1, 2, 3], render: { size: 16 } });
    expect(png.map((f) => f.name)).toEqual(["chevron.png", "chevron@2x.png", "chevron@3x.png"]);
    const width = (d: string | Uint8Array): number =>
      new DataView((d as Uint8Array).buffer, (d as Uint8Array).byteOffset).getUint32(16);
    expect(png.map((f) => width(f.data))).toEqual([16, 32, 48]);
    const psd = await exportShapes("psd", ["chevron"], { scales: [2], render: { size: 8 } });
    expect(psd.map((f) => f.name)).toEqual(["chevron@2x.psd"]);
  });

  it("uses currentColor, colour space, layers, prefix, base64, quality, matte and ICO sizes", async () => {
    const [pdf] = await exportShapes("pdf", ["chevron"], {
      currentColor: "#ff0000",
      colorSpace: "cmyk",
      layers: false,
    });
    expect(latin1(pdf?.data ?? "")).toContain("0 1 1 0 K");
    expect(latin1(pdf?.data ?? "")).not.toContain("/OCProperties");
    const [ai] = await exportShapes("ai", ["chevron"]);
    expect(latin1(ai?.data ?? "").startsWith("%PDF-")).toBe(true);
    const [eps] = await exportShapes("eps", ["chevron"], { colorSpace: "cmyk" });
    expect(eps?.data).toContain("setcmykcolor");
    const [eps2] = await exportShapes("eps", ["chevron"], { currentColor: "#0000ff" });
    expect(eps2?.data).toContain("0 0 1 setrgbcolor");
    const [figma] = await exportShapes("figma", ["chevron"], { currentColor: "lime" });
    expect(figma?.data).toContain('stroke="#00ff00"');
    const [sprite] = await exportShapes("svg-sprite", ["chevron"], { prefix: "ic-" });
    expect(sprite?.data).toContain('id="ic-chevron"');
    const [uri] = await exportShapes("data-uri", ["chevron"], { base64: true });
    expect(uri?.data).toMatch(/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+\n$/);
    const [jpg] = await exportShapes("jpg", ["chevron"], { quality: 50, matte: "black" });
    expect(jpg?.data.length).toBeGreaterThan(100);
    const [ico] = await exportShapes("ico", ["chevron"], { icoSizes: [16, 256] });
    expect(new DataView((ico?.data as Uint8Array).buffer).getUint16(4, true)).toBe(2);
    const [psd] = await exportShapes("psd", [{ shape: "chevron", options: { color: "red" } }], {
      render: { size: 8 },
    });
    expect(psd?.data.length).toBeGreaterThan(100);
    const css = await exportShapes("css-mask", ["chevron", "roj-half-sun"]);
    expect(css[0]?.data).toMatch(/^\.deq-chevron \{[\s\S]*\n\.deq-roj-half-sun \{/);
  });

  it("builds the favicon pack from exactly one item", async () => {
    const files = await exportShapes("favicon", ["kurdish-sun"], { favicon: { name: "Deq" } });
    expect(files).toHaveLength(7);
    expect((await exportShapes("favicon", ["kurdish-sun"])).at(-1)?.data).toContain(
      '"name": "Kurdish Sun"',
    );
    await expect(exportShapes("favicon", ["chevron", "kurdish-sun"])).rejects.toThrow(
      /exactly one item/,
    );
  });

  it("rejects bad formats, options and colliding file names", async () => {
    const bad: [string, ExportOptions][] = [
      ["svg", { scales: [0] }],
      ["svg", { scales: [2, 2] }],
      ["svg", { quality: 101 }],
      ["svg", { prefix: "Bad" }],
      ["svg", { colorSpace: "lab" as "rgb" }],
      ["svg", { favicon: { extra: 1 } as NonNullable<ExportOptions["favicon"]> }],
      ["svg", { nope: true } as ExportOptions],
      ["svg", { currentColor: "nope" }],
      ["svg", { matte: "nope" }],
      ["svg", { icoSizes: [300] }],
      ["gif", {}],
    ];
    for (const [format, options] of bad) {
      await expect(
        exportShapes(format as ExportFormat, ["chevron"], options),
        JSON.stringify(options),
      ).rejects.toThrow(DeqError);
    }
    await expect(exportShapes("gif" as ExportFormat, ["chevron"])).rejects.toThrow(
      /format: must be one of/,
    );
    await expect(exportShapes("svg", ["chevron"], { scales: [0] })).rejects.toThrow(/scales\.0: /);
    await expect(
      exportShapes("png", ["chevron"], { render: { size: 4096 }, scales: [3] }),
    ).rejects.toThrow(/chevron at 3x is 12288 px/);
    await expect(
      exportShapes("jsx", [
        { shape: "chevron", name: "roj-a" },
        { shape: "chevron", name: "roja" },
      ]),
    ).rejects.toThrow(/same file name Roja\.jsx/);
  });
});
