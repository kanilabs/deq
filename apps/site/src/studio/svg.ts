/**
 * Put renderer output into the DOM without HTML parsing: the markup is parsed as SVG XML
 * and imported, so nothing in it can become an HTML element or script. The markup comes
 * from core's renderer, which escapes every attribute and text value.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

/** Parse an SVG document string into an element owned by `document`, or undefined. */
export function parseSvg(markup: string): SVGSVGElement | undefined {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (root.namespaceURI !== SVG_NS || root.localName !== "svg") return undefined;
  if (doc.getElementsByTagName("parsererror").length > 0) return undefined;
  if (root.querySelector("script, foreignObject")) return undefined;
  return document.importNode(root, true) as unknown as SVGSVGElement;
}

/** Svelte action: replace the node's children with the parsed SVG markup. */
export function svgMarkup(node: Element, markup: string): { update: (m: string) => void } {
  const apply = (m: string) => {
    const svg = parseSvg(m);
    if (svg) node.replaceChildren(svg);
    else node.replaceChildren();
  };
  apply(markup);
  return { update: apply };
}
