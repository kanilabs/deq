/**
 * Raster output: SVG is rendered with resvg (WASM) and encoded to PNG (resvg), JPG, WebP
 * and AVIF (jSquash WASM codecs). Works in Node and in browsers; see {@link initRaster}.
 */
import { DeqError } from "@0xdolan/deq-core";
import { Resvg, initWasm } from "@resvg/resvg-wasm";

import type { Rgba } from "./color.js";

/** Raster encodings. */
export type RasterFormat = "png" | "jpg" | "webp" | "avif";

/** Largest width or height of a raster export, in pixels. */
export const MAX_RASTER = 8192;

/** WASM sources for browsers and bundlers. Node finds the packaged files by itself. */
export interface RasterWasm {
  /**
   * The `@resvg/resvg-wasm/index_bg.wasm` file as a URL, a `Response`, its bytes or a
   * compiled `WebAssembly.Module` (or a promise of one of these).
   */
  readonly resvg?: unknown;
}

let resvgReady: Promise<void> | undefined;

const wasmValidate = (bytes: Uint8Array): boolean =>
  (
    globalThis as unknown as { WebAssembly: { validate: (b: Uint8Array) => boolean } }
  ).WebAssembly.validate(bytes);

const isNode = (): boolean =>
  typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node ===
  "string";

/** Read a file shipped inside a dependency (Node only). */
async function packageFile(specifier: string): Promise<Uint8Array> {
  const [{ readFile }, { createRequire }] = await Promise.all([
    import("node:fs/promises"),
    import("node:module"),
  ]);
  return readFile(createRequire(import.meta.url).resolve(specifier));
}

/**
 * Load the resvg WASM renderer once. Node loads the packaged file; browsers must pass
 * `wasm.resvg` (for example `new URL("@resvg/resvg-wasm/index_bg.wasm", import.meta.url)`)
 * before the first raster export. Later calls reuse the first result.
 */
export function initRaster(wasm: RasterWasm = {}): Promise<void> {
  resvgReady ??= (async () => {
    const source =
      wasm.resvg ?? (isNode() ? await packageFile("@resvg/resvg-wasm/index_bg.wasm") : undefined);
    if (source === undefined) {
      throw new DeqError(
        "INVALID_OPTIONS",
        "raster export needs the resvg WASM module: call initRaster({ resvg }) first",
        ["wasm.resvg: required outside Node"],
      );
    }
    try {
      await initWasm(source as Parameters<typeof initWasm>[0]);
    } catch (error) {
      // Another caller in this process (a second copy of this module) loaded it already.
      if (!(error instanceof Error && /already initialized/i.test(error.message))) throw error;
    }
  })().catch((error: unknown) => {
    resvgReady = undefined;
    throw error;
  });
  return resvgReady;
}

/** Emscripten options so jSquash finds its WASM in Node (browsers use `import.meta.url`). */
async function codecOptions(file: string): Promise<{ wasmBinary?: Uint8Array }> {
  return isNode() ? { wasmBinary: await packageFile(file) } : {};
}

/** The `ImageData` shape jSquash reads (the DOM type is not available in Node). */
interface Pixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly colorSpace: "srgb";
}
type Encoder = (data: Pixels, options?: Record<string, unknown>) => Promise<ArrayBuffer>;
const encoders = new Map<RasterFormat, Promise<Encoder>>();

function encoder(format: "jpg" | "webp" | "avif"): Promise<Encoder> {
  let e = encoders.get(format);
  if (!e) {
    e = (async (): Promise<Encoder> => {
      switch (format) {
        case "jpg": {
          const m = await import("@jsquash/jpeg/encode.js");
          await m.init(await codecOptions("@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm"));
          return m.default;
        }
        case "webp": {
          const m = await import("@jsquash/webp/encode.js");
          let file = "@jsquash/webp/codec/enc/webp_enc.wasm";
          if (isNode()) {
            // jSquash picks the SIMD build when the engine supports SIMD; match its binary.
            const simd = await packageFile("@jsquash/webp/codec/enc/webp_enc_simd.wasm");
            if (wasmValidate(simd)) file = "@jsquash/webp/codec/enc/webp_enc_simd.wasm";
          }
          await m.init(await codecOptions(file));
          return m.default;
        }
        case "avif": {
          const m = await import("@jsquash/avif/encode.js");
          await m.init(await codecOptions("@jsquash/avif/codec/enc/avif_enc.wasm"));
          return m.default;
        }
      }
    })().catch((error: unknown) => {
      encoders.delete(format);
      throw error;
    });
    encoders.set(format, e);
  }
  return e;
}

/** A rendered bitmap: straight (not premultiplied) RGBA. */
export interface Bitmap {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;
}

function checkWidth(width: number): void {
  if (!Number.isInteger(width) || width < 1 || width > MAX_RASTER) {
    const issue = `size: raster width must be an integer from 1 to ${String(MAX_RASTER)} px (got ${String(width)})`;
    throw new DeqError("INVALID_OPTIONS", `invalid export options: ${issue}`, [issue]);
  }
}

/** Render an SVG at `width` pixels (height follows the aspect ratio). */
async function renderSvg(
  svg: string,
  width: number,
): Promise<{ png: Uint8Array; bitmap: Bitmap; premul: Uint8Array }> {
  checkWidth(width);
  await initRaster();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
  });
  try {
    const img = resvg.render();
    try {
      const premul = img.pixels;
      const data = new Uint8ClampedArray(premul.length);
      for (let i = 0; i < premul.length; i += 4) {
        const a = premul[i + 3] ?? 0;
        data[i + 3] = a;
        if (a === 0) continue;
        for (let c = 0; c < 3; c++) data[i + c] = Math.round(((premul[i + c] ?? 0) * 255) / a);
      }
      return { png: img.asPng(), bitmap: { width: img.width, height: img.height, data }, premul };
    } finally {
      img.free();
    }
  } finally {
    resvg.free();
  }
}

/** Render an SVG to straight RGBA pixels. */
export async function rasterize(svg: string, width: number): Promise<Bitmap> {
  return (await renderSvg(svg, width)).bitmap;
}

export interface EncodeOptions {
  /** Quality 0 to 100 for JPG, WebP and AVIF. Default 90 (JPG, WebP) and 70 (AVIF). */
  readonly quality?: number;
  /** JPG has no transparency: transparent pixels are composited onto this colour. */
  readonly matte?: Rgba;
}

const asImageData = (b: Bitmap): Pixels => ({
  width: b.width,
  height: b.height,
  data: b.data,
  colorSpace: "srgb",
});

/** Render an SVG and encode it. */
export async function encodeSvg(
  svg: string,
  width: number,
  format: RasterFormat,
  options: EncodeOptions = {},
): Promise<Uint8Array> {
  const { png, bitmap, premul } = await renderSvg(svg, width);
  switch (format) {
    case "png":
      return png;
    case "jpg": {
      const [mr, mg, mb] = (options.matte ?? [1, 1, 1, 1]).map((c) => c * 255) as [
        number,
        number,
        number,
      ];
      const data = new Uint8ClampedArray(premul.length);
      for (let i = 0; i < premul.length; i += 4) {
        const rest = 1 - (premul[i + 3] ?? 0) / 255;
        data[i] = (premul[i] ?? 0) + mr * rest;
        data[i + 1] = (premul[i + 1] ?? 0) + mg * rest;
        data[i + 2] = (premul[i + 2] ?? 0) + mb * rest;
        data[i + 3] = 255;
      }
      const enc = await encoder("jpg");
      return new Uint8Array(
        await enc(asImageData({ ...bitmap, data }), { quality: options.quality ?? 90 }),
      );
    }
    case "webp": {
      const enc = await encoder("webp");
      return new Uint8Array(await enc(asImageData(bitmap), { quality: options.quality ?? 90 }));
    }
    case "avif": {
      const enc = await encoder("avif");
      return new Uint8Array(await enc(asImageData(bitmap), { quality: options.quality ?? 70 }));
    }
  }
}
