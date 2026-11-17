import { readFileSync, readdirSync } from "node:fs";

import { DeqError, listShapes, render as core } from "@0xdolan/deq-core";
import { iconComponentName, rojHalfSun } from "@0xdolan/deq-icons";
import { createRawSnippet } from "svelte";
import type { Component } from "svelte";
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";

import { generate } from "../scripts/generate.ts";
import * as pkg from "./index.js";
import { DeqIcon, Icon, RojHalfSun, packageName } from "./index.js";
import { iconOptions } from "./options.js";

/** Svelte's hydration markers and `<line ...></line>` become core's plain markup. */
const plain = (markup: string): string => {
  let out = markup;
  for (let prev = ""; prev !== out;) {
    prev = out;
    out = out.replace(/<!--(?:\[-?\d*|\]|)-->/g, "");
  }
  return out.replace(/><\/(?:circle|ellipse|line|path|polygon|polyline)>/g, "/>");
};

const html = (c: Component<never>, props: Record<string, unknown> = {}): string =>
  plain(render(c as Component<Record<string, unknown>>, { props }).body);

const desc = createRawSnippet(() => ({ render: () => "<desc>d</desc>" }));

describe("@0xdolan/deq-svelte", () => {
  it("is generated fresh", () => {
    const dir = new URL("./generated/", import.meta.url);
    const files = generate();
    expect(readdirSync(dir).sort()).toEqual([...files.keys()].sort());
    for (const [name, text] of files) expect(readFileSync(new URL(name, dir), "utf8")).toBe(text);
    expect(packageName).toBe("@0xdolan/deq-svelte");
  });

  it.each(listShapes().map((s) => s.id))("%s renders exactly like core", (id) => {
    const c = (pkg as unknown as Record<string, Component<never>>)[iconComponentName(id)];
    if (!c) throw new Error(id);
    expect(html(c)).toBe(core(id));
  });

  it("maps props to core options", () => {
    expect(html(RojHalfSun, { size: 48, color: "#ED2024", strokeWidth: 1.5 })).toBe(
      core("roj-half-sun", { size: 48, color: "#ED2024", strokeWidth: 1.5 }),
    );
    expect(html(RojHalfSun, { size: 64, strokeWidth: 1, absoluteStrokeWidth: true })).toBe(
      core("roj-half-sun", { size: 64, strokeWidth: 1, absoluteStrokeWidth: true }),
    );
    expect(html(RojHalfSun, { title: "" })).toBe(core("roj-half-sun", { title: "" }));
    // Svelte leaves ">" unescaped in text and attributes, which is equally valid.
    expect(html(RojHalfSun, { title: "Sun & <moon>" })).toBe(
      core("roj-half-sun", { title: "Sun & <moon>" }).replaceAll("&gt;", ">"),
    );
  });

  it("passes attributes and children through", () => {
    const out = html(RojHalfSun, { class: "icon", "stroke-linecap": "square", children: desc });
    expect(out).toContain('class="icon"');
    expect(out).toContain('stroke-linecap="square"');
    expect(out).toMatch(/<desc>d<\/desc><\/svg>$/);
  });

  it("renders any icon by name, or icon data", () => {
    expect(html(DeqIcon, { name: "kurdish-sun", size: 32 })).toBe(
      core("kurdish-sun", { size: 32 }),
    );
    expect(() => html(DeqIcon, { name: "nope" })).toThrow(DeqError);
    expect(() => html(DeqIcon, { name: "toString" })).toThrow(/unknown icon/);
    const custom = { ...rojHalfSun, node: [["circle", { cx: "12", cy: "12", r: "3" }]] } as const;
    expect(html(Icon, { icon: custom })).toContain('<circle cx="12" cy="12" r="3"/>');
  });

  it("drops unset options", () => {
    expect(
      iconOptions({
        size: 2,
        color: undefined,
        strokeWidth: undefined,
        absoluteStrokeWidth: false,
        title: undefined,
      }),
    ).toEqual({ size: 2, absoluteStrokeWidth: false });
  });
});
