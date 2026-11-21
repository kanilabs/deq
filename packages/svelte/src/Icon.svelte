<!--
  @component
  Draws icon data from `@0xdolan/deq-icons`. Other SVG attributes pass through to the
  `<svg>`; children are added after the shape.
-->
<script lang="ts">
  import { rootAttributes } from "@0xdolan/deq-icons";

  import { iconOptions } from "./options.js";
  import type { IconProps } from "./types.js";

  let { icon, size, color, strokeWidth, absoluteStrokeWidth, title, children, ...rest }: IconProps =
    $props();

  const options = $derived(iconOptions({ size, color, strokeWidth, absoluteStrokeWidth, title }));
  const attrs = $derived(Object.fromEntries(rootAttributes(icon, options)));
  const label = $derived(title ?? icon.title);
</script>

<svg {...attrs} {...rest}>{#if label !== ""}<title>{label}</title>{/if}{#each icon.node as [tag, a], i (i)}<svelte:element this={tag} {...a} />{/each}{@render children?.()}</svg>
