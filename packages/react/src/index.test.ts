import { readFileSync } from "node:fs";

import { DeqError, listShapes, render } from "@0xdolan/deq-core";
import { iconComponentName, icons, rojHalfSun } from "@0xdolan/deq-icons";
import { createElement } from "react";
import type { FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { generate } from "../scripts/generate.ts";
import * as pkg from "./index.js";
import { DeqIcon, RojHalfSun, createDeqIcon, packageName } from "./index.js";
import type { DeqIconProps } from "./index.js";

/** React writes `<line ...></line>`; core writes the same element as `<line .../>`. */
const selfClose = (markup: string): string =>
  markup.replace(/><\/(?:circle|ellipse|line|path|polygon|polyline)>/g, "/>");

const html = (c: FunctionComponent<DeqIconProps>, props: DeqIconProps = {}): string =>
  selfClose(renderToStaticMarkup(createElement(c, props)));

describe("@0xdolan/deq-react", () => {
  it("is generated fresh", () => {
    const file = new URL("./generated/icons.ts", import.meta.url);
    expect(readFileSync(file, "utf8")).toBe(generate());
    expect(packageName).toBe("@0xdolan/deq-react");
  });

  it.each(listShapes().map((s) => s.id))("%s renders exactly like core", (id) => {
    const c = (pkg as unknown as Record<string, FunctionComponent<DeqIconProps>>)[
      iconComponentName(id)
    ];
    if (!c) throw new Error(id);
    expect(html(c)).toBe(render(id));
    expect(c.displayName).toBe(iconComponentName(id));
  });

  it("maps props to core options", () => {
    expect(html(RojHalfSun, { size: 48, color: "#ED2024", strokeWidth: 1.5 })).toBe(
      render("roj-half-sun", { size: 48, color: "#ED2024", strokeWidth: 1.5 }),
    );
    expect(html(RojHalfSun, { size: 64, strokeWidth: 1, absoluteStrokeWidth: true })).toBe(
      render("roj-half-sun", { size: 64, strokeWidth: 1, absoluteStrokeWidth: true }),
    );
    expect(html(RojHalfSun, { title: "" })).toBe(render("roj-half-sun", { title: "" }));
    expect(html(RojHalfSun, { title: "Sun & <moon>" })).toBe(
      render("roj-half-sun", { title: "Sun & <moon>" }),
    );
  });

  it("passes other SVG props and children through", () => {
    const out = renderToStaticMarkup(
      createElement(
        RojHalfSun,
        { className: "icon", id: "sun", strokeLinecap: "square" },
        createElement("desc", null, "d"),
      ),
    );
    expect(out).toContain('class="icon"');
    expect(out).toContain('id="sun"');
    expect(out).toContain('stroke-linecap="square"');
    expect(out).toMatch(/<desc>d<\/desc><\/svg>$/);
  });

  it("renders any icon by name", () => {
    expect(
      selfClose(renderToStaticMarkup(createElement(DeqIcon, { name: "kurdish-sun", size: 32 }))),
    ).toBe(render("kurdish-sun", { size: 32 }));
    expect(() => renderToStaticMarkup(createElement(DeqIcon, { name: "nope" }))).toThrow(DeqError);
    expect(() => renderToStaticMarkup(createElement(DeqIcon, { name: "toString" }))).toThrow(
      /unknown icon/,
    );
  });

  it("makes components from custom icon data", () => {
    const Custom = createDeqIcon(
      { ...rojHalfSun, node: [["circle", { cx: "12", cy: "12", r: "3", "fill-opacity": "0.5" }]] },
      "Custom",
    );
    expect(html(Custom)).toContain('<circle cx="12" cy="12" r="3" fill-opacity="0.5"/>');
    expect(Object.keys(icons)).toHaveLength(listShapes().length);
  });
});
