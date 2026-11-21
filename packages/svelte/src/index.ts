/**
 * @0xdolan/deq-svelte: Deq shapes as typed, tree-shakable Svelte 5 components.
 *
 * ```svelte
 * <script>
 *   import { RojHalfSun, DeqIcon } from "@0xdolan/deq-svelte";
 * </script>
 * <RojHalfSun size={32} strokeWidth={1.5} absoluteStrokeWidth />
 * <DeqIcon name="kurdish-sun" color="#ED2024" />
 * ```
 *
 * @packageDocumentation
 */
export * from "./generated/icons.js";
/** Draws any catalog shape by id (`name`); props are `DeqIconByNameProps`. */
export { default as DeqIcon } from "./DeqIcon.svelte";
/** Draws icon data from `@0xdolan/deq-icons` (`icon`); props are `IconProps`. */
export { default as Icon } from "./Icon.svelte";
export type { DeqIconByNameProps, DeqIconProps, IconProps } from "./types.js";

/** The npm package name. */
export const packageName = "@0xdolan/deq-svelte" as const;
