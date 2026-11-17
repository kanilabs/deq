/**
 * @0xdolan/deq-vue: Deq shapes as typed, tree-shakable Vue 3 components.
 *
 * ```vue
 * <script setup>
 * import { RojHalfSun, DeqIcon } from "@0xdolan/deq-vue";
 * </script>
 * <template>
 *   <RojHalfSun :size="32" :stroke-width="1.5" absolute-stroke-width />
 *   <DeqIcon name="kurdish-sun" color="#ED2024" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */
export * from "./generated/icons.js";
export { DeqIcon, createDeqIcon } from "./create.js";
export type { DeqIconComponent, DeqIconProps } from "./create.js";

/** The npm package name. */
export const packageName = "@0xdolan/deq-vue" as const;
