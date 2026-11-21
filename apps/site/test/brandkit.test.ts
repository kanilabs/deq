import type * as fs from "node:fs/promises";

import { listShapes } from "@0xdolan/deq-core";
import { FORMATS } from "@0xdolan/deq-exporters";
import { describe, expect, it, vi } from "vitest";

/** Paths under `public/` the next `readFile` calls pretend are missing. */
const missing = vi.hoisted(() => new Set<string>());

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    readFile: (path: string, ...rest: []) =>
      [...missing].some((m) => path.replaceAll("\\", "/").endsWith(m))
        ? Promise.reject(new Error("ENOENT"))
        : actual.readFile(path, ...rest),
  };
});

const {
  BRAND_PNGS,
  BRAND_SVGS,
  brandKit,
  brandPng,
  factSheet,
  faviconIco,
  pressKit,
  STORE_SHOTS,
  svgSize,
} = await import("../src/lib/brandkit.ts");

const PNG = [0x89, 0x50, 0x4e, 0x47];
/** The file names in a ZIP's central directory (signature PK\1\2, name at offset 46). */
function zipNames(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const names: string[] = [];
  for (let i = 0; i + 46 <= bytes.length; i++) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    const length = view.getUint16(i + 28, true);
    names.push(new TextDecoder().decode(bytes.subarray(i + 46, i + 46 + length)));
  }
  return names;
}

// The kits render every brand PNG with resvg, which takes longer than 5 s on CI runners.
describe("brand kit", { timeout: 60_000 }, () => {
  it("collects the brand SVGs by path, without the old concepts", () => {
    expect(BRAND_SVGS["logo.svg"]).toContain("<svg");
    expect(BRAND_SVGS["lockups/horizontal-color.svg"]).toContain("<svg");
    expect(BRAND_SVGS["guide/construction.svg"]).toContain("<svg");
    expect(Object.keys(BRAND_SVGS).some((name) => name.startsWith("concepts/"))).toBe(false);
  });

  it("reads drawn sizes and names the recipe for a missing file", () => {
    expect(svgSize("social-preview.svg")).toEqual({ width: 1280, height: 640 });
    expect(() => svgSize("nope.svg")).toThrow("just brand");
  });

  it("lists PNGs for every lockup except mono, at twice the drawn width", () => {
    expect(BRAND_PNGS["lockup-horizontal-color"]?.width).toBe(
      Math.round(svgSize("lockups/horizontal-color.svg").width * 2),
    );
    expect(Object.keys(BRAND_PNGS).some((name) => name.includes("mono"))).toBe(false);
    expect(() => brandPng("nope")).toThrow("no brand PNG nope");
  });

  it("renders a PNG once per build", async () => {
    const first = brandPng("mark-512");
    expect(brandPng("mark-512")).toBe(first);
    expect([...(await first).subarray(0, 4)]).toEqual(PNG);
  });

  it("packs favicon.ico with 16, 32 and 48 px images", async () => {
    const ico = await faviconIco();
    const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
    expect([view.getUint16(0, true), view.getUint16(2, true), view.getUint16(4, true)]).toEqual([
      0, 1, 3,
    ]);
    expect([ico[6], ico[22], ico[38]]).toEqual([16, 32, 48]);
  });

  it("builds the brand kit with folders and no animated files in svg/", async () => {
    const names = zipNames(await brandKit());
    expect(names).toEqual(
      expect.arrayContaining([
        "README.txt",
        "svg/logo.svg",
        "svg/lockups/stacked-ckb-flag.svg",
        "png/lockup-horizontal-color.png",
        "favicon/favicon.ico",
        "favicon/site.webmanifest",
        "animation/logo-animated.svg",
        "animation/logo-animated.mp4",
        "brand.json",
        "tokens.css",
      ]),
    );
    expect(names.filter((n) => n.startsWith("svg/") && n.includes("animated"))).toEqual([]);
  });

  it("builds the press kit with every store screenshot", async () => {
    const names = zipNames(await pressKit());
    expect(STORE_SHOTS).toHaveLength(16);
    for (const shot of STORE_SHOTS) {
      expect(names).toContain(`screens/${shot.file.slice("store/".length)}`);
    }
    expect(names).toEqual(
      expect.arrayContaining(["fact-sheet.txt", "logos/horizontal-reversed.png"]),
    );
  });

  it("takes the fact sheet's numbers from the packages", () => {
    const sheet = factSheet();
    expect(sheet).toContain(`${String(listShapes().length)} shapes`);
    expect(sheet).toContain(`${String(FORMATS.length)} export formats`);
    expect(sheet).toContain("English");
  });

  it("names the recipe when a recorded file is missing", async () => {
    missing.add("brand/logo-animated.mp4");
    try {
      await expect(brandKit()).rejects.toThrow("just brand-video");
    } finally {
      missing.clear();
    }
    missing.add("store/home-phone-light.webp");
    try {
      await expect(pressKit()).rejects.toThrow("just store");
    } finally {
      missing.clear();
    }
  });
});
