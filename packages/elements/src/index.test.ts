import { DeqError, listShapes, render } from "@0xdolan/deq-core";
import { rojHalfSun } from "@0xdolan/deq-icons";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeqIconElement, defineDeqElements, drawIcon, packageName } from "./index.js";

/** Core's markup as the DOM serialises it: no xmlns, explicit end tags. */
const asDom = (svg: string): string =>
  svg
    .replace(' xmlns="http://www.w3.org/2000/svg"', "")
    .replace(/<(circle|ellipse|line|path|polygon|polyline)\b([^>]*)\/>/g, "<$1$2></$1>");

function icon(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement("deq-icon");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("<deq-icon>", () => {
  defineDeqElements();

  it("registers once and is a DeqIconElement", () => {
    defineDeqElements();
    expect(customElements.get("deq-icon")).toBeDefined();
    expect(icon({ name: "roj-half-sun" })).toBeInstanceOf(DeqIconElement);
    expect(packageName).toBe("@0xdolan/deq-elements");
  });

  it.each(listShapes().map((s) => s.id))("%s draws core's markup", (id) => {
    expect(icon({ name: id }).innerHTML).toBe(asDom(render(id)));
  });

  it("maps attributes to options and redraws on change", () => {
    const el = icon({
      name: "roj-half-sun",
      size: "64",
      "stroke-width": "1",
      "absolute-stroke-width": "",
    });
    expect(el.innerHTML).toBe(
      asDom(render("roj-half-sun", { size: 64, strokeWidth: 1, absoluteStrokeWidth: true })),
    );
    el.setAttribute("color", "#ED2024");
    el.setAttribute("label", "");
    el.removeAttribute("absolute-stroke-width");
    expect(el.innerHTML).toBe(
      asDom(render("roj-half-sun", { size: 64, strokeWidth: 1, color: "#ED2024", title: "" })),
    );
    el.setAttribute("size", "2em");
    expect(el.innerHTML).toContain('width="2em"');
    el.setAttribute("name", "kurdish-sun");
    expect(el.querySelector("title")).toBeNull();
  });

  it("escapes nothing it should not: labels are text", () => {
    const el = icon({ name: "roj-half-sun", label: "<b>x</b>" });
    expect(el.querySelector("title")?.textContent).toBe("<b>x</b>");
    expect(el.querySelector("b")).toBeNull();
  });

  it("draws custom icon data from the icon property", () => {
    const el = document.createElement("deq-icon") as DeqIconElement;
    el.icon = { ...rojHalfSun, node: [["circle", { cx: "12", cy: "12", r: "3" }]] };
    document.body.append(el);
    expect(el.icon.node).toHaveLength(1);
    expect(el.querySelectorAll("circle")).toHaveLength(1);
  });

  it("does not draw while disconnected", () => {
    const el = document.createElement("deq-icon");
    el.setAttribute("name", "roj-half-sun");
    expect(el.childElementCount).toBe(0);
  });

  it("throws for unknown names and clears the element", () => {
    const el = icon({ name: "roj-half-sun" }) as DeqIconElement;
    el.setAttribute("name", "toString");
    expect(el.childElementCount).toBe(0);
    expect(() => {
      el.update();
    }).toThrow(DeqError);
    expect(el.childElementCount).toBe(0);
  });

  it("stays empty for invalid attributes", () => {
    const el = icon({ name: "roj-half-sun", color: "url(#x)" }) as DeqIconElement;
    expect(el.childElementCount).toBe(0);
    expect(() => {
      el.update();
    }).toThrow(/color/);
  });

  it("builds an svg element directly", () => {
    const svg = drawIcon(document, rojHalfSun, { title: "" });
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("does nothing without a custom element registry", async () => {
    vi.stubGlobal("customElements", undefined);
    defineDeqElements("deq-other");
    vi.unstubAllGlobals();
    expect(customElements.get("deq-other")).toBeUndefined();
    await import("./define.js");
    expect(customElements.get("deq-icon")).toBeDefined();
  });
});
