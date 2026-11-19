// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { flatBox, flatten } from "../src/studio/custom.ts";
import {
  SVG_LIMITS,
  SvgImportError,
  importSvg,
  mergeParts,
  nameFromFile,
  sanitizeSvg,
  svgToCustom,
} from "../src/studio/svgimport.ts";

// paper.js sets up a canvas view and reads colours by painting a pixel; happy-dom has no 2D
// context. This one paints black, transparent for `transparent` or zero-alpha `rgba()` .
(HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => {
  let style = "";
  return new Proxy(
    {},
    {
      get: (_, key) =>
        key === "getImageData"
          ? () => ({ data: [0, 0, 0, /transparent|,\s*0\)$/u.test(style) ? 0 : 255] })
          : () => ({}),
      set: (_, key, value) => {
        if (key === "fillStyle") style = String(value);
        return true;
      },
    },
  );
};

const svg = (body: string, attrs = 'viewBox="0 0 100 100"'): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

describe("sanitizeSvg", () => {
  it("strips scripts, handlers, foreign content and links", () => {
    const clean = sanitizeSvg(
      svg(
        '<script>alert(1)</script><circle cx="50" cy="50" r="40" onload="alert(2)"/>' +
          '<foreignObject><div>x</div></foreignObject><a href="javascript:alert(3)"><rect width="9" height="9"/></a>' +
          '<image href="https://evil.example/x.png"/><style>*{fill:url(https://evil.example)}</style>' +
          '<use href="#c"/>',
      ),
    );
    expect(clean).toContain("<circle");
    for (const bad of [
      "script",
      "onload",
      "foreignObject",
      "javascript",
      "<image",
      "<style",
      "<use",
      "evil",
    ]) {
      expect(clean).not.toContain(bad);
    }
  });

  it("keeps checked geometry and paint, style declarations included", () => {
    const clean = sanitizeSvg(
      svg(
        '<path d="M0 0 L9 9" style="fill: red; stroke:url(#g); behavior: x" fill="blue" stroke="#000"' +
          ' data-x="1" xlink:href="#a" xmlns:xlink="http://www.w3.org/1999/xlink"/>' +
          '<rect width="calc(1px)" height="9"/><svg:g xmlns:svg="http://www.w3.org/2000/svg"/>' +
          '<x:g xmlns:x="urn:x"><rect width="1" height="1"/></x:g>',
      ),
    );
    expect(clean).toContain('fill="red"');
    expect(clean).toContain('stroke="#000"');
    expect(clean).toContain('viewBox="0 0 100 100"');
    expect(clean).toContain('<rect height="9"');
    expect(clean).toContain("<g");
    for (const bad of ["url", "behavior", "data-x", "href", "calc", "urn:x"]) {
      expect(clean).not.toContain(bad);
    }
  });

  it("refuses large files, entities and non-SVG", () => {
    expect(() => sanitizeSvg(svg(" ".repeat(SVG_LIMITS.bytes)))).toThrow(SvgImportError);
    const xxe = `<?xml version="1.0"?><!DOCTYPE s [<!ENTITY x SYSTEM "file:///etc/passwd">]>${svg("&x;")}`;
    expect(() => sanitizeSvg(xxe)).toThrow(/invalid/);
    expect(() => sanitizeSvg("<html><body>hi</body></html>")).toThrow(/invalid/);
    expect(() => sanitizeSvg("<p>no svg here</p><svg")).toThrow(/invalid/);
    const many = svg('<circle r="1"/>'.repeat(SVG_LIMITS.elements + 1));
    expect(() => sanitizeSvg(many)).toThrow(/size/);
  });
});

describe("svgToCustom", () => {
  it("fits outlines into the keylines and keeps fill or stroke", async () => {
    const def = await svgToCustom(
      sanitizeSvg(
        svg(
          '<g transform="translate(10 0)"><rect x="0" y="0" width="40" height="80" fill="#000"/></g>' +
            '<circle cx="70" cy="40" r="20" fill="none" stroke="red"/>' +
            '<path d="M0 0 L5 5" fill="none" stroke="none"/>',
        ),
      ),
      "Door",
      undefined,
      "u-door",
    );
    expect(def.id).toBe("u-door");
    expect(def.name).toBe("Door");
    expect(def.primitives).toHaveLength(2);
    expect(def.primitives.map((p) => (p as { paint?: string }).paint)).toEqual(["fill", undefined]);
    expect(flatBox(flatten(def.primitives))).toEqual([2, 2, 20, 20]);
    expect(def.primitives[0]).toEqual({
      type: "path",
      d: "M2 22 L2 2 L12 2 L12 22 L2 22 Z",
      paint: "fill",
    });
  });

  it("reports SVG with nothing visible", async () => {
    await expect(svgToCustom(svg('<path d="M0 0 L9 9" fill="none"/>'), "x")).rejects.toThrow(
      /empty/,
    );
    await expect(svgToCustom(svg(""), "x")).rejects.toThrow(/empty/);
  });

  it("refuses a non-SVG root and outlines too long to keep", async () => {
    await expect(svgToCustom("<html/>", "x")).rejects.toThrow(/invalid/);
    const zigzag = Array.from({ length: 400 }, (_, i) => `L${String(i)} ${String(i % 2 ? 0 : 50)}`);
    await expect(
      svgToCustom(svg(`<path d="M0 0 ${zigzag.join(" ")}" stroke="#000" fill="none"/>`), "x"),
    ).rejects.toThrow(/complex/);
  });

  it("imports a whole file by name", async () => {
    const def = await importSvg(svg('<polygon points="0,0 50,100 100,0"/>'), "my_star-icon.svg");
    expect(def.name).toBe("my star icon");
    expect(def.id).toMatch(/^u-/u);
  });
});

describe("helpers", () => {
  it("names shapes after files", () => {
    expect(nameFromFile("arrow-up.svg")).toBe("arrow up");
    expect(nameFromFile(".svg")).toBe("Imported shape");
  });

  it("merges parts past the limit and refuses what cannot fit", () => {
    const parts = Array.from({ length: 100 }, (_, i) => ({
      type: "path" as const,
      d: `M${String(i % 20)} 1 L2 2`,
      ...(i % 2 ? { paint: "fill" as const } : {}),
    }));
    expect(mergeParts(parts.slice(0, 3))).toHaveLength(3);
    const sorted = [...parts.filter((_, i) => i % 2 === 0), ...parts.filter((_, i) => i % 2)];
    expect(mergeParts(sorted)).toHaveLength(2);
    expect(() => mergeParts(parts)).toThrow(/complex/);
    expect(() =>
      mergeParts([
        ...sorted,
        ...Array.from({ length: 70 }, () => ({ type: "dot" as const, cx: 1, cy: 1 })),
      ]),
    ).toThrow(/complex/);
  });
});
