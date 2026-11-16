import { DeqError, render, svgDocument } from "@0xdolan/deq-core";
import decodeAvif, { init as initAvifDec } from "@jsquash/avif/decode.js";
import decodeJpeg, { init as initJpegDec } from "@jsquash/jpeg/decode.js";
import decodeWebp, { init as initWebpDec } from "@jsquash/webp/decode.js";
import { initializeCanvas, readPsd } from "ag-psd";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

import { meanDiff, rgbaToGray } from "../test/tools.js";
import type { Gray } from "../test/tools.js";
import { ICO_SIZES, packIco, toFaviconPack, toIco } from "./favicon.js";
import { resolveItem } from "./input.js";
import { writePsd } from "./psd.js";
import { MAX_RASTER, encodeSvg, initRaster, rasterize } from "./raster.js";
import type { Bitmap } from "./raster.js";
import type * as Raster from "./raster.js";

const require = createRequire(import.meta.url);
const wasm = async (file: string): Promise<{ wasmBinary: Uint8Array }> => ({
  wasmBinary: await readFile(require.resolve(file)),
});

const SVG = render("roj-half-sun", { color: "#c00000", strokeWidth: 2 });

/** Width and height from a PNG's IHDR chunk. */
function pngSize(png: Uint8Array): [number, number] {
  const view = new DataView(png.buffer, png.byteOffset);
  return [view.getUint32(16), view.getUint32(20)];
}

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");
const arrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** jSquash decoders return DOM `ImageData`, which this Node project does not type. */
type Decode = (buffer: ArrayBuffer) => Promise<Bitmap | null>;
function orFail(b: Bitmap | null): Bitmap {
  if (!b) throw new Error("decode failed");
  return b;
}

/** Decode an encoded image back to straight RGBA (PNG through resvg, the rest through jSquash). */
async function decode(format: string, bytes: Uint8Array): Promise<Bitmap> {
  switch (format) {
    case "png": {
      const [w, h] = pngSize(bytes);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(w)}" height="${String(h)}"><image width="${String(w)}" height="${String(h)}" href="data:image/png;base64,${toBase64(bytes)}"/></svg>`;
      return rasterize(svg, w);
    }
    case "jpg":
      await initJpegDec(await wasm("@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm"));
      return orFail(await (decodeJpeg as unknown as Decode)(arrayBuffer(bytes)));
    case "webp":
      await initWebpDec(await wasm("@jsquash/webp/codec/dec/webp_dec.wasm"));
      return orFail(await (decodeWebp as unknown as Decode)(arrayBuffer(bytes)));
    default:
      await initAvifDec(await wasm("@jsquash/avif/codec/dec/avif_dec.wasm"));
      return orFail(await (decodeAvif as unknown as Decode)(arrayBuffer(bytes)));
  }
}

const gray = (b: Bitmap): Gray => rgbaToGray(b.width, b.height, b.data);

describe("raster encoders round trip", () => {
  const cases = [
    ["png", [0x89, 0x50, 0x4e, 0x47], 0.5],
    ["jpg", [0xff, 0xd8, 0xff], 4],
    ["webp", [0x52, 0x49, 0x46, 0x46], 4],
    ["avif", [], 6],
  ] as const;

  it.each(cases)("%s", async (format, magic, tolerance) => {
    const bytes = await encodeSvg(SVG, 64, format);
    expect([...bytes.subarray(0, magic.length)]).toEqual(magic);
    if (format === "webp") expect(new TextDecoder().decode(bytes.subarray(8, 12))).toBe("WEBP");
    if (format === "avif") expect(new TextDecoder().decode(bytes.subarray(4, 12))).toBe("ftypavif");
    const back = await decode(format, bytes);
    expect([back.width, back.height]).toEqual([64, 64]);
    // JPG has no alpha: compare on its default white matte, which rgbaToGray also uses.
    expect(meanDiff(gray(back), gray(await rasterize(SVG, 64)))).toBeLessThan(tolerance);
  });

  it("JPG composites transparency onto the matte and honours quality", async () => {
    const red = await decode("jpg", await encodeSvg(SVG, 32, "jpg", { matte: [0, 0, 1, 1] }));
    expect([...red.data.subarray(0, 3)].map((c) => Math.round(c / 32))).toEqual([0, 0, 8]);
    const small = await encodeSvg(SVG, 128, "jpg", { quality: 5 });
    const large = await encodeSvg(SVG, 128, "jpg", { quality: 100 });
    expect(small.length).toBeLessThan(large.length);
    const webp = await encodeSvg(SVG, 128, "webp", { quality: 5 });
    const avif = await encodeSvg(SVG, 128, "avif", { quality: 5 });
    expect(webp.length).toBeLessThan((await encodeSvg(SVG, 128, "webp", { quality: 100 })).length);
    expect(avif.length).toBeLessThan((await encodeSvg(SVG, 128, "avif", { quality: 100 })).length);
  });

  it("un-premultiplies pixels and keeps the aspect ratio", async () => {
    const wide = await rasterize(
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20" viewBox="0 0 30 20"><rect width="30" height="20"/></svg>',
      90,
    );
    expect([wide.width, wide.height]).toEqual([90, 60]);
    const half = await rasterize(render("dimlich", { strokeOpacity: 0.5, color: "#ff0000" }), 48);
    const i = half.data.findIndex((_, k) => k % 4 === 3 && (half.data[k] ?? 0) > 120);
    expect(half.data[i - 3]).toBe(255);
  });

  it("rejects widths outside 1 to MAX_RASTER", async () => {
    for (const w of [0, MAX_RASTER + 1, 1.5, Number.NaN]) {
      await expect(rasterize(SVG, w)).rejects.toThrow(DeqError);
    }
  });
});

describe("initRaster", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@resvg/resvg-wasm");
    vi.resetModules();
  });

  /** A fresh raster module whose resvg `initWasm` is a mock. */
  async function withInit(init: (source: unknown) => Promise<void>): Promise<typeof Raster> {
    vi.resetModules();
    vi.doMock("@resvg/resvg-wasm", () => ({ initWasm: init, Resvg: vi.fn() }));
    return import("./raster.js");
  }

  it("needs the WASM module outside Node", async () => {
    const fresh = await withInit(() => Promise.resolve());
    vi.stubGlobal("process", { versions: {} });
    const pending = fresh.initRaster();
    vi.unstubAllGlobals();
    await expect(pending).rejects.toThrow(/initRaster\(\{ resvg \}\)/);
    await expect(fresh.initRaster({ resvg: new Uint8Array([0]) })).resolves.toBeUndefined();
  });

  it("forgets a failed load so a later call can retry, and loads only once", async () => {
    const init = vi
      .fn<(source: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new Error("bad wasm"))
      .mockResolvedValue(undefined);
    const fresh = await withInit(init);
    await expect(fresh.initRaster({ resvg: "x" })).rejects.toThrow("bad wasm");
    await fresh.initRaster({ resvg: "y" });
    await fresh.initRaster({ resvg: "z" });
    expect(init.mock.calls.map((c) => c[0])).toEqual(["x", "y"]);
  });

  it("accepts a module another caller already loaded", async () => {
    const fresh = await withInit(() => Promise.reject(new Error("Already initialized.")));
    await expect(fresh.initRaster({ resvg: "x" })).resolves.toBeUndefined();
    await expect(initRaster()).resolves.toBeUndefined();
  });
});

describe("PSD", () => {
  // Node has no canvas; reading only needs ImageData-like buffers.
  const imageData = (width: number, height: number): Bitmap => ({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  });
  initializeCanvas(() => {
    throw new Error("no canvas in tests");
  }, imageData);

  it("has a named pixel layer per shape layer and a background layer", async () => {
    const r = resolveItem({
      shape: "roj-half-sun",
      options: { background: "#ffeecc", color: "#204080" },
    });
    const psd = readPsd(await writePsd(r.prepared, 96), {
      useImageData: true,
      skipThumbnail: true,
    });
    expect([psd.width, psd.height]).toEqual([96, 96]);
    const layers = psd.children ?? [];
    expect(layers.map((l) => l.name)).toEqual(["background", "arc", "rays", "center"]);
    const composite = psd.imageData as unknown as Bitmap;
    expect(
      meanDiff(gray(composite), gray(await rasterize(svgDocument(r.prepared), 96))),
    ).toBeLessThan(0.5);
    // A shape layer is transparent outside its own strokes.
    const rays = layers[2]?.imageData as unknown as Bitmap;
    const alpha = rays.data.filter((_, k) => k % 4 === 3);
    expect(alpha.some((a) => a === 0)).toBe(true);
    expect(alpha.some((a) => a === 255)).toBe(true);
  });

  it("skips the background layer and unused layers", async () => {
    const r = resolveItem({ shape: "roj-half-sun", params: { centerDot: false } });
    const psd = readPsd(await writePsd(r.prepared, 24), {
      useImageData: true,
      skipThumbnail: true,
    });
    expect(psd.children?.map((l) => l.name)).toEqual(["arc", "rays"]);
  });
});

describe("ICO and favicon pack", () => {
  /** ICO directory entries: [size byte, byte length, offset]. */
  function icoEntries(ico: Uint8Array): [number, number, number][] {
    const view = new DataView(ico.buffer, ico.byteOffset);
    expect([view.getUint16(0, true), view.getUint16(2, true)]).toEqual([0, 1]);
    return Array.from({ length: view.getUint16(4, true) }, (_, i) => {
      const e = 6 + 16 * i;
      expect(view.getUint16(e + 6, true)).toBe(32);
      return [ico[e] ?? -1, view.getUint32(e + 8, true), view.getUint32(e + 12, true)];
    });
  }

  it("packs PNG entries with correct offsets", async () => {
    const ico = await toIco(resolveItem("chevron"));
    const entries = icoEntries(ico);
    expect(entries.map((e) => e[0])).toEqual([...ICO_SIZES]);
    for (const [size, length, offset] of entries) {
      const png = ico.subarray(offset, offset + length);
      expect(pngSize(png)).toEqual([size, size]);
    }
    expect(entries.at(-1)?.[1] ?? 0).toBe(ico.length - (entries.at(-1)?.[2] ?? 0));
    const big = packIco([{ size: 256, png: new Uint8Array([1, 2]) }]);
    expect(icoEntries(big)).toEqual([[0, 2, 22]]);
  });

  it("writes every file of the pack", async () => {
    const files = await toFaviconPack(
      resolveItem({ shape: "kurdish-sun", options: { color: "red" } }),
    );
    expect(files.map((f) => f.name)).toEqual([
      "favicon.ico",
      "favicon.svg",
      "apple-touch-icon.png",
      "icon-192.png",
      "icon-512.png",
      "icon-maskable-512.png",
      "site.webmanifest",
    ]);
    const by = Object.fromEntries(files.map((f) => [f.name, f.data]));
    const svg = by["favicon.svg"] as string;
    expect(svg).toContain(
      "<style>:root{color:#ff0000}@media (prefers-color-scheme:dark){:root{color:#ffffff}}</style>",
    );
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('aria-hidden="true"');
    expect(pngSize(by["apple-touch-icon.png"] as Uint8Array)).toEqual([180, 180]);
    expect(pngSize(by["icon-maskable-512.png"] as Uint8Array)).toEqual([512, 512]);
    // The touch icon is opaque; the plain icons are transparent in the corners.
    const touch = await decode("png", by["apple-touch-icon.png"] as Uint8Array);
    expect(touch.data[3]).toBe(255);
    const plain = await decode("png", by["icon-192.png"] as Uint8Array);
    expect(plain.data[3]).toBe(0);
    const manifest = JSON.parse(by["site.webmanifest"] as string) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      name: "Kurdish Sun",
      short_name: "Kurdish Sun",
      theme_color: "#ffffff",
      background_color: "#ffffff",
      display: "standalone",
    });
    expect(icoEntries(by["favicon.ico"] as Uint8Array)).toHaveLength(3);
  });

  it("applies the favicon options", async () => {
    const files = await toFaviconPack(resolveItem("chevron"), {
      name: "Deq",
      shortName: "D",
      color: "navy",
      darkColor: "rgb(200 200 0)",
      background: "#123",
      themeColor: "black",
    });
    const svg = files.find((f) => f.name === "favicon.svg")?.data as string;
    expect(svg).toContain(":root{color:#000080}");
    expect(svg).toContain(":root{color:#c8c800}");
    const manifest = JSON.parse(files.at(-1)?.data as string) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      name: "Deq",
      short_name: "D",
      theme_color: "#000000",
      background_color: "#112233",
    });
  });
});
