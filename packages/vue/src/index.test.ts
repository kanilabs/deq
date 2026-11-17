import { readFileSync } from "node:fs";

import { DeqError, listShapes, render } from "@0xdolan/deq-core";
import { iconComponentName, rojHalfSun } from "@0xdolan/deq-icons";
import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import type { Component } from "vue";
import { renderToString } from "vue/server-renderer";

import { generate } from "../scripts/generate.ts";
import * as pkg from "./index.js";
import { DeqIcon, RojHalfSun, createDeqIcon, packageName } from "./index.js";

/** Vue writes `<line ...></line>`; core writes the same element as `<line .../>`. */
const selfClose = (markup: string): string =>
  markup.replace(/><\/(?:circle|ellipse|line|path|polygon|polyline)>/g, "/>");

const html = async (
  c: Component,
  props: Record<string, unknown> = {},
  slot?: () => unknown,
): Promise<string> =>
  selfClose(
    await renderToString(
      createSSRApp({ render: () => h(c, props, slot ? { default: slot } : undefined) }),
    ),
  );

describe("@0xdolan/deq-vue", () => {
  it("is generated fresh", () => {
    const file = new URL("./generated/icons.ts", import.meta.url);
    expect(readFileSync(file, "utf8")).toBe(generate());
    expect(packageName).toBe("@0xdolan/deq-vue");
  });

  it.each(listShapes().map((s) => s.id))("%s renders exactly like core", async (id) => {
    const c = (pkg as unknown as Record<string, Component>)[iconComponentName(id)];
    if (!c) throw new Error(id);
    expect(await html(c)).toBe(render(id));
  });

  it("maps props to core options", async () => {
    expect(await html(RojHalfSun, { size: 48, color: "#ED2024", strokeWidth: 1.5 })).toBe(
      render("roj-half-sun", { size: 48, color: "#ED2024", strokeWidth: 1.5 }),
    );
    expect(await html(RojHalfSun, { size: 64, strokeWidth: 1, absoluteStrokeWidth: true })).toBe(
      render("roj-half-sun", { size: 64, strokeWidth: 1, absoluteStrokeWidth: true }),
    );
    expect(await html(RojHalfSun, { title: "" })).toBe(render("roj-half-sun", { title: "" }));
    expect(await html(RojHalfSun, { title: "Sun & <moon>" })).toBe(
      render("roj-half-sun", { title: "Sun & <moon>" }),
    );
  });

  it("passes attributes and the default slot through", async () => {
    const out = await html(RojHalfSun, { class: "icon", "stroke-linecap": "square" }, () =>
      h("desc", "d"),
    );
    expect(out).toContain('class="icon"');
    expect(out).toContain('stroke-linecap="square"');
    expect(out).toMatch(/<desc>d<\/desc><\/svg>$/);
  });

  it("renders any icon by name", async () => {
    expect(await html(DeqIcon, { name: "kurdish-sun", size: 32 })).toBe(
      render("kurdish-sun", { size: 32 }),
    );
    expect(await html(DeqIcon, { name: "kurdish-sun" }, () => h("desc", "d"))).toContain("<desc>");
    await expect(html(DeqIcon, { name: "nope" })).rejects.toThrow(DeqError);
    await expect(html(DeqIcon, { name: "toString" })).rejects.toThrow(/unknown icon/);
  });

  it("makes components from custom icon data", async () => {
    const Custom = createDeqIcon(
      { ...rojHalfSun, node: [["circle", { cx: "12", cy: "12", r: "3" }]] },
      "Custom",
    );
    expect(await html(Custom)).toContain('<circle cx="12" cy="12" r="3"/>');
  });
});
