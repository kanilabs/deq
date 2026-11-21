# @0xdolan/deq-vue

<img src="https://kanilabs.github.io/deq/brand/banner.png" width="640" height="160" alt="Deq · دەق: the Dot rosette logo, traditional Kurdish tattoo shapes as an open, parametric design system.">

The 93 Deq shapes as typed, tree-shakable Vue 3.5 components.

```sh
npm install @0xdolan/deq-vue
```

```vue
<script setup lang="ts">
import { DeqIcon, KurdishSun, RojHalfSun } from "@0xdolan/deq-vue";
</script>

<template>
  <RojHalfSun />
  <KurdishSun :size="48" color="#ED2024" :stroke-width="1.5" />
  <DeqIcon name="roj-half-sun" size="3em" title="" />
</template>
```

Components are named after the catalog id (`roj-half-sun` → `RojHalfSun`). `DeqIcon` picks an icon by name at run time and pulls in every icon, so prefer named imports. Other attributes fall through to the `<svg>`; the default slot is drawn after the shape. `createDeqIcon(icon, name)` turns custom `DeqIcon` data into a component.

| Option                | Default        | Notes                                                       |
| --------------------- | -------------- | ----------------------------------------------------------- |
| `size`                | `24`           | px number or a CSS length (`"2em"`)                         |
| `color`               | `currentColor` | any CSS colour                                              |
| `strokeWidth`         | `2`            | grid units on the 24×24 canvas                              |
| `absoluteStrokeWidth` | `false`        | keep the stroke `strokeWidth` px wide at any numeric `size` |
| `title`               | English name   | accessible label; `""` marks the icon decorative            |

Props are camelCase in script and kebab-case in templates (`stroke-width`, `absolute-stroke-width`). For rotation, dot scale, fills, layer colours or shape parameters, use `@0xdolan/deq-core` (`render`) or `@0xdolan/deq-exporters`.

License: GPL-3.0-or-later. Example app: [`examples/vue`](../../examples/vue).
