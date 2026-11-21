# @0xdolan/deq-svelte

<img src="https://kanilabs.github.io/deq/brand/banner.png" width="640" height="160" alt="Deq · دەق: the Dot rosette logo, traditional Kurdish tattoo shapes as an open, parametric design system.">

The 93 Deq shapes as typed Svelte 5 components (runes).

```sh
npm install @0xdolan/deq-svelte
```

```svelte
<script lang="ts">
  import { DeqIcon, KurdishSun, RojHalfSun } from "@0xdolan/deq-svelte";
</script>

<RojHalfSun />
<KurdishSun size={48} color="#ED2024" strokeWidth={1.5} />
<DeqIcon name="roj-half-sun" size="3em" title="" />
```

Components are named after the catalog id (`roj-half-sun` → `RojHalfSun`). `DeqIcon` picks an icon by name at run time and pulls in every icon, so prefer named imports. Other attributes go to the `<svg>`; `children` is rendered after the shape. `Icon` draws custom `DeqIcon` data: `<Icon icon={data} />`.

| Option                | Default        | Notes                                                       |
| --------------------- | -------------- | ----------------------------------------------------------- |
| `size`                | `24`           | px number or a CSS length (`"2em"`)                         |
| `color`               | `currentColor` | any CSS colour                                              |
| `strokeWidth`         | `2`            | grid units on the 24×24 canvas                              |
| `absoluteStrokeWidth` | `false`        | keep the stroke `strokeWidth` px wide at any numeric `size` |
| `title`               | English name   | accessible label; `""` marks the icon decorative            |

For rotation, dot scale, fills, layer colours or shape parameters, use `@0xdolan/deq-core` (`render`) or `@0xdolan/deq-exporters`.

License: GPL-3.0-or-later. Example app: [`examples/svelte`](../../examples/svelte).
