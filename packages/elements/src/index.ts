/**
 * @0xdolan/deq-elements: the `<deq-icon>` custom element for any page or framework.
 *
 * ```html
 * <script type="module">
 *   import "@0xdolan/deq-elements/define";
 * </script>
 * <deq-icon name="roj-half-sun" size="32" stroke-width="1.5"></deq-icon>
 * ```
 *
 * @packageDocumentation
 */
export { DeqIconElement, defineDeqElements, drawIcon } from "./element.js";

/** The npm package name. */
export const packageName = "@0xdolan/deq-elements" as const;
