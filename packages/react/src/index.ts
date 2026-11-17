/**
 * @0xdolan/deq-react: Deq shapes as typed, tree-shakable React components.
 *
 * ```tsx
 * import { RojHalfSun, DeqIcon } from "@0xdolan/deq-react";
 * <RojHalfSun size={32} strokeWidth={1.5} absoluteStrokeWidth />
 * <DeqIcon name="kurdish-sun" color="#ED2024" />
 * ```
 *
 * @packageDocumentation
 */
export * from "./generated/icons.js";
export { DeqIcon, createDeqIcon } from "./create.js";
export type { DeqIconByNameProps, DeqIconProps } from "./create.js";

/** The npm package name. */
export const packageName = "@0xdolan/deq-react" as const;
