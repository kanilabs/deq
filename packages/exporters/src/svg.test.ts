import { DeqError, compose, render } from "@0xdolan/deq-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_ITEMS, resolveItem, resolveItems } from "./input.js";
import {
  copyToClipboard,
  cssClass,
  splitSvg,
  svgDataUri,
  toCssBackground,
  toCssMask,
  toDataUri,
  toFigmaSvg,
  toHtml,
  toLayeredSvg,
  toSprite,
  toSvg,
} from "./svg.js";

describe("resolveItem", () => {
  it("accepts ids, items and compositions", () => {
    expect(resolveItem("roj-half-sun").name).toBe("roj-half-sun");
    const r = resolveItem(
      { shape: "roj-half-sun", name: "sun", params: { rays: 5 } },
      { params: { rays: 9 } },
    );
    expect(r.name).toBe("sun");
    expect(r.options.params).toEqual({ rays: 5 });
    const c = resolveItem(
      { parts: [{ shape: "roj-half-sun" }, { shape: "chevron" }] },
      { params: { rays: 3 } },
    );
    expect(c.name).toBe("composition");
    expect(c.options.params).toEqual({});
    expect(c.prepared.layers).toEqual(["roj-half-sun", "chevron"]);
  });

  it("merges params: defaults < item options < item params", () => {
    const r = resolveItem(
      {
        shape: "roj-half-sun",
        options: { params: { rays: 5, centerDot: false } },
        params: { rays: 3 },
      },
      { params: { rays: 9 } },
    );
    expect(r.options.params).toEqual({ rays: 3, centerDot: false });
  });

  it("rejects bad names, unknown shapes and bad lists", () => {
    expect(() => resolveItem({ shape: "chevron", name: "Bad Name" })).toThrow(DeqError);
    expect(() => resolveItem({ shape: "chevron", name: "a".repeat(65) })).toThrow(/kebab case/);
    expect(() => resolveItem("no-such-shape")).toThrow(DeqError);
    expect(() => resolveItems([])).toThrow(/1 to 512/);
    expect(() => resolveItems(Array.from({ length: MAX_ITEMS + 1 }, () => "chevron"))).toThrow(
      DeqError,
    );
    expect(() => resolveItems(["chevron", "chevron"])).toThrow(/duplicate name chevron/);
    expect(resolveItems(["chevron", { shape: "chevron", name: "chevron-2" }])).toHaveLength(2);
  });
});

describe("plain SVG formats", () => {
  it("svg and html are core's output", () => {
    expect(toSvg("chevron")).toBe(render("chevron"));
    expect(toSvg(resolveItem({ shape: "roj-half-sun", options: { color: "red" } }))).toBe(
      render("roj-half-sun", { color: "red" }),
    );
    expect(toHtml("chevron")).toBe(`${render("chevron")}\n`);
  });

  it("splitSvg reads core output and rejects other input", () => {
    const { attrs, inner } = splitSvg(render("chevron"));
    expect(attrs.find(([k]) => k === "viewBox")?.[1]).toBe("0 0 24 24");
    expect(inner).toContain("<line");
    expect(() => splitSvg("<div/>")).toThrow("not a Deq SVG document");
  });

  it("layered SVG marks every layer as an Inkscape layer", () => {
    const svg = toLayeredSvg({ shape: "roj-half-sun", options: { rotation: 90 } });
    expect(svg).toContain('xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"');
    const labels = [...svg.matchAll(/inkscape:groupmode="layer" inkscape:label="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(labels).toEqual(["arc", "rays", "center"]);
    // Each layer group carries the rotation, so layers stay in place when moved apart.
    expect(svg.match(/<g [^>]*transform="rotate\(90 12 12\)"/g)).toHaveLength(3);
  });

  it("sprite has one symbol per item without size or accessibility attributes", () => {
    const sprite = toSprite(resolveItems(["chevron", "roj-half-sun"]), "x-");
    expect(sprite).toMatch(
      /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" aria-hidden="true" style="display:none">/,
    );
    expect(
      [...sprite.matchAll(/<symbol id="([^"]*)" viewBox="0 0 24 24"/g)].map((m) => m[1]),
    ).toEqual(["x-chevron", "x-roj-half-sun"]);
    expect(sprite).not.toMatch(/<symbol[^>]* (?:width|role|aria-label)=/);
    expect(toSprite(resolveItems(["chevron"]))).toContain('id="deq-chevron"');
  });
});

describe("data URIs and CSS", () => {
  it("percent-encodes with readable characters and single quotes", () => {
    const uri = toDataUri("chevron");
    expect(uri.startsWith("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'")).toBe(
      true,
    );
    expect(uri).not.toMatch(/["<>#]/);
    expect(decodeURIComponent(uri.slice(19)).replace(/'/g, '"')).toBe(render("chevron"));
  });

  it("base64 round trips UTF-8", () => {
    const svg = render("chevron", { title: "Kurdî ☀" });
    const uri = svgDataUri(svg, true);
    const bin = atob(uri.slice("data:image/svg+xml;base64,".length));
    expect(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))).toBe(svg);
    expect(toDataUri("chevron", true).startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  it("CSS background and mask rules", () => {
    const bg = toCssBackground({ shape: "chevron", options: { size: 32 } });
    expect(bg).toMatch(
      /^\.deq-chevron \{\n {2}display: inline-block;\n {2}width: 32px;\n {2}height: 32px;/,
    );
    expect(bg).toContain('background: url("data:image/svg+xml,');
    const mask = toCssMask("chevron", "icon-sun");
    expect(mask.startsWith(".icon-sun {")).toBe(true);
    expect(mask).toContain("background-color: currentColor;");
    expect(mask).toContain("-webkit-mask: url(");
    expect(mask).toContain("\n  mask: url(");
  });

  it("rejects class names that could break out of the rule", () => {
    const r = resolveItem("chevron");
    expect(cssClass(r)).toBe("deq-chevron");
    for (const bad of ["a{}", "1a", "a b", "x".repeat(65), "A"]) {
      expect(() => cssClass(r, bad), bad).toThrow(DeqError);
    }
  });
});

describe("Figma SVG", () => {
  it("names layer groups and uses concrete colours", () => {
    const svg = toFigmaSvg({
      shape: "roj-half-sun",
      options: { layerColors: { rays: "#ff0000" } },
    });
    expect(svg).not.toContain("currentColor");
    expect(svg).not.toMatch(/ role=| aria-label=| color=/);
    expect(svg).toContain('<g id="arc" stroke="#000000">');
    expect(svg).toContain('<g id="rays" stroke="#ff0000">');
    expect(svg).toMatch(/<g id="center" stroke="#000000"><circle[^>]*fill="#000000"/);
    expect(svg).not.toContain("data-layer");
  });

  it("resolves currentColor with the given colour and the root colour", () => {
    expect(toFigmaSvg("chevron", [0, 0, 1, 1])).toContain('stroke="#0000ff"');
    const svg = toFigmaSvg({ shape: "chevron", options: { color: "green", title: "" } });
    expect(svg).toContain('stroke="#008000"');
    expect(svg).not.toContain("aria-hidden");
  });

  it("keeps composition layers", () => {
    const svg = toFigmaSvg({
      parts: [{ shape: "chevron" }, { shape: "roj-half-sun", layer: "sun" }],
    });
    expect([...svg.matchAll(/<g id="([^"]*)"/g)].map((m) => m[1])).toEqual(["chevron", "sun"]);
    expect(compose([{ shape: "chevron" }])).toContain("<line");
  });
});

describe("copyToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false without a clipboard", async () => {
    vi.stubGlobal("navigator", undefined);
    expect(await copyToClipboard("x")).toBe(false);
  });

  it("writes text and reports failures", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyToClipboard("<svg/>")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("<svg/>");
    vi.stubGlobal("navigator", {
      clipboard: { writeText: () => Promise.reject(new Error("denied")) },
    });
    expect(await copyToClipboard("x")).toBe(false);
  });
});
