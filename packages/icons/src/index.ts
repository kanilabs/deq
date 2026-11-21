/**
 * @0xdolan/deq-icons: Deq shapes as icon data, SVG strings, raw SVG files and a sprite.
 *
 * ```ts
 * import { rojHalfSun, toSvg } from "@0xdolan/deq-icons";
 * const svg = toSvg(rojHalfSun, { size: 32 });
 * ```
 *
 * @packageDocumentation
 */
export * from "./generated/icons.js";
export { iconComponentName, iconExportName } from "./names.js";
export { nodeMarkup, rootAttributes, toSvg } from "./svg.js";
export type { Attribute } from "./svg.js";
export type { DeqIcon, IconElement, IconNode, IconOptions } from "./types.js";

/** The npm package name. */
export const packageName = "@0xdolan/deq-icons" as const;
