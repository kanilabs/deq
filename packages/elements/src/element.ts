import { DeqError } from "@0xdolan/deq-core";
import { icons, rootAttributes, toSvg } from "@0xdolan/deq-icons";
import type { DeqIcon, IconOptions } from "@0xdolan/deq-icons";

const SVG_NS = "http://www.w3.org/2000/svg";
const NUMBER = /^\d{1,5}(?:\.\d{1,4})?$/;

/** HTMLElement in browsers; a stand-in on servers, so importing this module never throws. */
const Base =
  (globalThis.HTMLElement as typeof HTMLElement | undefined) ??
  (Object as unknown as typeof HTMLElement);

const numeric = (v: string): number | string => (NUMBER.test(v) ? Number(v) : v);

/**
 * `<deq-icon name="roj-half-sun">`: draws a Deq icon inline (light DOM, so CSS `color`
 * and selectors work). Attributes: `name`, `size`, `color`, `stroke-width`,
 * `absolute-stroke-width` and `label` (the accessible title; `label=""` marks the icon
 * decorative). Set the `icon` property to draw custom icon data instead of `name`.
 */
export class DeqIconElement extends Base {
  static readonly observedAttributes = [
    "name",
    "size",
    "color",
    "stroke-width",
    "absolute-stroke-width",
    "label",
  ];

  #icon: DeqIcon | undefined;

  /** Custom icon data; takes precedence over the `name` attribute. */
  get icon(): DeqIcon | undefined {
    return this.#icon;
  }

  set icon(value: DeqIcon | undefined) {
    this.#icon = value;
    if (this.isConnected) this.#draw();
  }

  connectedCallback(): void {
    this.#draw();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#draw();
  }

  /** The icon options from the attributes. */
  options(): IconOptions {
    const o: Record<string, unknown> = {};
    const size = this.getAttribute("size");
    const color = this.getAttribute("color");
    const stroke = this.getAttribute("stroke-width");
    const label = this.getAttribute("label");
    if (size !== null) o["size"] = numeric(size);
    if (color !== null) o["color"] = color;
    if (stroke !== null) o["strokeWidth"] = numeric(stroke);
    if (this.hasAttribute("absolute-stroke-width")) o["absoluteStrokeWidth"] = true;
    if (label !== null) o["title"] = label;
    return o;
  }

  /**
   * Redraw the icon now. Lifecycle callbacks redraw automatically and leave the element
   * empty for an unknown name or invalid attributes; this method throws instead.
   *
   * @throws {DeqError} `UNKNOWN_SHAPE` or `INVALID_OPTIONS`.
   */
  update(): void {
    this.replaceChildren();
    const name = this.getAttribute("name") ?? "";
    const icon = this.#icon ?? (Object.hasOwn(icons, name) ? icons[name] : undefined);
    if (!icon) throw new DeqError("UNKNOWN_SHAPE", `unknown icon: ${name}`);
    const options = this.options();
    toSvg(icon, options); // validates the options
    this.replaceChildren(drawIcon(this.ownerDocument, icon, options));
  }

  #draw(): void {
    try {
      this.update();
    } catch (error) {
      if (!(error instanceof DeqError)) throw error;
    }
  }
}

/** Build the `<svg>` element for `icon` with DOM calls (no HTML parsing). */
export function drawIcon(doc: Document, icon: DeqIcon, options: IconOptions = {}): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  for (const [k, v] of rootAttributes(icon, options)) if (k !== "xmlns") svg.setAttribute(k, v);
  const label = options.title ?? icon.title;
  if (label !== "") {
    const title = doc.createElementNS(SVG_NS, "title");
    title.textContent = label;
    svg.append(title);
  }
  for (const [tag, attrs] of icon.node) {
    const el = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

/**
 * Register `<deq-icon>` (or another tag name). Safe to call more than once and on servers,
 * where it does nothing.
 */
export function defineDeqElements(tag = "deq-icon"): void {
  const registry = (globalThis as { customElements?: CustomElementRegistry }).customElements;
  if (!registry || registry.get(tag)) return;
  registry.define(tag, class extends DeqIconElement {});
}
