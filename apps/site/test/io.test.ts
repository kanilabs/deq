import { inflateRawSync } from "node:zlib";

import { DeqError, render } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import {
  CustomShapeError,
  parseCustomDef,
  toSpecJson,
  type CustomDef,
} from "../src/studio/custom.ts";
import {
  FORMATS,
  FORMAT_GROUPS,
  RASTER,
  exportItems,
  runExport,
  slug,
  toDownload,
} from "../src/studio/exporting.ts";
import { MAX_OPEN_BYTES, fileKind, ioErrorKey, openLimit } from "../src/studio/files.ts";
import { DocError, EMPTY_DOC, type Item, type StudioDoc } from "../src/studio/model.ts";
import {
  MAX_SHARE_CHARS,
  ShareError,
  decodeShare,
  encodeShare,
  shareToken,
  shareUrl,
} from "../src/studio/share.ts";
import { Studio } from "../src/studio/store.svelte.ts";
import { SVG_LIMITS, SvgImportError, dropsContent } from "../src/studio/svgimport.ts";
import { ZipError, crc32, deflateRaw, zip } from "../src/studio/zip.ts";

/** Read a ZIP back: name, method, CRC and contents of every entry. */
function unzip(data: Uint8Array): { name: string; method: number; crc: number; body: Buffer }[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const end = data.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50);
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const offset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(data.subarray(p + 46, p + 46 + nameLen));
    const localName = view.getUint16(offset + 26, true);
    const start = offset + 30 + localName;
    const raw = Buffer.from(data.subarray(start, start + size));
    out.push({ name, method, crc, body: method === 8 ? inflateRawSync(raw) : raw });
    p += 46 + nameLen;
  }
  return out;
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("stores small files, deflates repetitive ones and reads back", async () => {
    const big = "<svg>".repeat(400);
    const data = await zip(
      [
        { name: "a.svg", data: big },
        { name: "b.bin", data: new Uint8Array([1, 2, 3]) },
        { name: "سۆران.txt", data: "ok" },
      ],
      new Date(2026, 10, 18, 3, 4, 6),
    );
    const files = unzip(data);
    expect(files.map((f) => f.name)).toEqual(["a.svg", "b.bin", "سۆران.txt"]);
    expect(files[0]?.method).toBe(8);
    expect(files[0]?.body.toString()).toBe(big);
    expect(files[1]?.method).toBe(0);
    expect([...(files[1]?.body ?? [])]).toEqual([1, 2, 3]);
    for (const f of files) expect(f.crc).toBe(crc32(new Uint8Array(f.body)));
  });

  it("refuses empty lists, bad and duplicate names", async () => {
    await expect(zip([])).rejects.toThrow(ZipError);
    for (const name of ["", "../x", "a/b", "c:\\d", ".."]) {
      await expect(zip([{ name, data: "" }])).rejects.toThrow(ZipError);
    }
    await expect(
      zip([
        { name: "A.svg", data: "" },
        { name: "a.svg", data: "" },
      ]),
    ).rejects.toThrow(/duplicate/);
  });

  it("clamps dates before 1980", async () => {
    const data = await zip([{ name: "x", data: "x" }], new Date(1970, 0, 1));
    expect(new DataView(data.buffer).getUint16(12, true) >> 9).toBe(0);
  });
});

const doc: StudioDoc = {
  v: 1,
  items: [
    { id: "a1", shape: "kurdish-sun", x: 0, y: 0, options: { color: "#c00" } },
    { id: "b2", shape: "chevron", x: 48, y: 0, options: {}, name: "Wing" },
  ],
};

describe("share links", () => {
  it("round-trip a design through the URL fragment", async () => {
    const token = await encodeShare(doc);
    expect(token).toMatch(/^1\.[A-Za-z0-9_-]+$/u);
    const url = shareUrl("https://example.org/deq/studio/?x=1", token);
    expect(url).toBe(`https://example.org/deq/studio/?x=1#d=${token}`);
    expect(shareToken(new URL(url).hash)).toBe(token);
    expect(await decodeShare(token)).toEqual(doc);
    expect(shareToken("#other=1")).toBeUndefined();
  });

  it("reject designs too large for a link", async () => {
    const items: Item[] = Array.from({ length: 500 }, (_, i) => ({
      id: `i${String(i)}`,
      shape: "kurdish-sun",
      x: Math.random() * 1e5,
      y: Math.random() * 1e5,
      options: {},
      name: Math.random().toString(36).repeat(4),
    }));
    await expect(encodeShare({ v: 1, items })).rejects.toThrow(ShareError);
    await expect(decodeShare("1." + "a".repeat(MAX_SHARE_CHARS))).rejects.toThrow(/too long/);
  });

  it("reject damaged, unknown or invalid data", async () => {
    await expect(decodeShare("2.abc")).rejects.toThrow(/version/);
    await expect(decodeShare("1.!!")).rejects.toThrow(/bad characters/);
    await expect(decodeShare("1.AAAA")).rejects.toThrow(/damaged/);
    const bad = await encodeShare({ v: 1, items: [{ id: "x", shape: "nope" }] } as never);
    await expect(decodeShare(bad)).rejects.toThrow(/shape/);
  });

  it("stop inflating at the byte limit", async () => {
    const bomb = new TextEncoder().encode(" ".repeat(2_000_000));
    const raw = await deflateRaw(bomb);
    let bin = "";
    for (const b of raw) bin += String.fromCharCode(b);
    const token = "1." + btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    await expect(decodeShare(token)).rejects.toMatchObject({ code: "large" });
  });

  it("keep an empty design", async () => {
    expect(await decodeShare(await encodeShare(EMPTY_DOC))).toEqual(EMPTY_DOC);
  });
});

const moon: CustomDef = parseCustomDef({
  id: "u-moon",
  version: 1,
  name: "Moon gate",
  primitives: [{ type: "circle", cx: 12, cy: 12, r: 8 }],
});

describe("export", () => {
  it("groups every format exactly once", () => {
    expect(FORMAT_GROUPS.flatMap((g) => g.formats).toSorted()).toEqual([...FORMATS].toSorted());
  });

  it("makes kebab-case names", () => {
    expect(slug("Moon Gate!", "x")).toBe("moon-gate");
    expect(slug("Çira", "x")).toBe("cira");
    expect(slug("سۆران", "fallback")).toBe("fallback");
    expect(slug("a".repeat(60) + " b", "x")).toHaveLength(48);
  });

  it("maps items to catalog and data items with unique names", () => {
    const items: Item[] = [
      ...doc.items,
      { id: "c3", shape: "kurdish-sun", x: 0, y: 0, options: {} },
      { id: "d4", shape: "u-moon", x: 0, y: 0, options: { strokeWidth: 3 } },
    ];
    const out = exportItems(items, (id) => (id === "u-moon" ? moon : undefined));
    expect(out).toEqual([
      { shape: "kurdish-sun", options: { color: "#c00" }, name: "kurdish-sun" },
      { shape: "chevron", options: { title: "Wing" }, name: "wing" },
      { shape: "kurdish-sun", options: {}, name: "kurdish-sun-2" },
      expect.objectContaining({ name: "moon-gate", options: { strokeWidth: 3 } }),
    ]);
    expect(() =>
      exportItems([{ id: "e", shape: "u-gone", x: 0, y: 0, options: {} }], () => undefined),
    ).toThrow(/missing/);
  });

  it("downloads one file as is and several as a ZIP", async () => {
    const one = await runExport(
      "svg",
      exportItems(doc.items.slice(0, 1), () => undefined),
    );
    expect(one).toMatchObject({ name: "kurdish-sun.svg", type: "image/svg+xml", files: 1 });
    expect(one.data).toBe(`${render("kurdish-sun", { color: "#c00" })}\n`);
    const items = exportItems(
      [...doc.items, { id: "d4", shape: "u-moon", x: 0, y: 0, options: {} }],
      () => moon,
    );
    const many = await runExport("pdf", items);
    expect(many).toMatchObject({ name: "deq-export.zip", type: "application/zip", files: 3 });
    const names = unzip(many.data as Uint8Array).map((f) => f.name);
    expect(names).toEqual(["kurdish-sun.pdf", "wing.pdf", "moon-gate.pdf"]);
    await expect(toDownload([])).rejects.toThrow(ZipError);
  });

  it("prepares the rasteriser for raster formats only", async () => {
    const calls: string[] = [];
    const prepare = () => {
      calls.push("ready");
      return Promise.resolve();
    };
    const items = exportItems(doc.items.slice(0, 1), () => undefined);
    await runExport("svg", items, {}, prepare);
    expect(calls).toEqual([]);
    const png = await runExport("png", items, { scales: [1] }, prepare);
    expect(calls).toEqual(["ready"]);
    expect(png.type).toBe("image/png");
    expect([...RASTER].every((f) => FORMATS.includes(f))).toBe(true);
  });

  it("passes exporter errors through", async () => {
    await expect(
      runExport(
        "favicon",
        exportItems(doc.items, () => undefined),
      ),
    ).rejects.toThrow(DeqError);
  });
});

describe("studio files", () => {
  const sun: Item = { id: "s1", shape: "kurdish-sun", x: 0, y: 0, options: {} };

  it("opens a design as one undoable step", async () => {
    const studio = new Studio(undefined);
    studio.openDoc({ v: 1, items: [sun] }, "open");
    studio.select("s1");
    expect(
      await studio.openJson(JSON.stringify({ v: 1, items: [{ ...sun, id: "s2" }] }), "open"),
    ).toBe("design");
    expect(studio.selection).toEqual([]);
    expect(studio.doc.items.map((i) => i.id)).toEqual(["s2"]);
    expect(studio.undo()).toBe("open");
    expect(studio.doc.items.map((i) => i.id)).toEqual(["s1"]);
  });

  it("imports a shape file into My shapes and refuses bad files", async () => {
    const studio = new Studio(undefined);
    const def = await studio.openJson(toSpecJson({ ...moon, id: "u-other" }), "import");
    expect(def).toMatchObject({ name: "Moon gate" });
    expect(studio.library).toHaveLength(1);
    await expect(studio.openJson("{", "x")).rejects.toThrow(/not JSON/);
    await expect(studio.openJson(JSON.stringify({ v: 2, items: [] }), "x")).rejects.toThrow(
      /invalid design/,
    );
  });

  it("exports the selection, else every visible item", () => {
    const studio = new Studio(undefined);
    const hidden = { ...sun, id: "s2", hidden: true };
    const third = { ...sun, id: "s3" };
    studio.openDoc({ v: 1, items: [sun, hidden, third] }, "open");
    expect(studio.exportable.map((i) => i.id)).toEqual(["s1", "s3"]);
    studio.selectIds(["s3", "s2"]);
    expect(studio.exportable.map((i) => i.id)).toEqual(["s2", "s3"]);
  });
});

describe("file helpers", () => {
  it("routes files by type or extension", () => {
    expect(fileKind("a.SVG", "")).toBe("svg");
    expect(fileKind("a", "image/svg+xml")).toBe("svg");
    expect(fileKind("design.json", "application/json")).toBe("json");
    expect(openLimit("svg")).toBe(SVG_LIMITS.bytes);
    expect(openLimit("json")).toBe(MAX_OPEN_BYTES);
  });

  it("maps failures to messages", () => {
    expect(ioErrorKey(new SvgImportError("complex"))).toBe("studio.io.error.complex");
    expect(ioErrorKey(new ShareError("large", "x"))).toBe("studio.io.error.shareLarge");
    expect(ioErrorKey(new ShareError("invalid", "x"))).toBe("studio.io.error.shareInvalid");
    expect(ioErrorKey(new CustomShapeError("at most 100 custom shapes"))).toBe(
      "studio.io.error.full",
    );
    expect(ioErrorKey(new CustomShapeError("bad"))).toBe("studio.io.error.invalid");
    expect(ioErrorKey(new DocError("bad"))).toBe("studio.io.error.invalid");
    expect(ioErrorKey("?")).toBe("studio.io.error.invalid");
  });

  it("notices SVG content the import leaves out", () => {
    expect(dropsContent('<svg><path d="M0 0"/></svg>')).toBe(false);
    for (const tag of ["linearGradient", "svg:text", "image", "filter", "use", "mask"]) {
      expect(dropsContent(`<svg><${tag} x="1"/></svg>`)).toBe(true);
    }
  });
});
