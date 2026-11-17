# @0xdolan/deq-react

The 93 Deq shapes as typed, tree-shakable React 19 components.

```sh
npm install @0xdolan/deq-react
```

```tsx
import { DeqIcon, KurdishSun, RojHalfSun } from "@0xdolan/deq-react";

<RojHalfSun />
<KurdishSun size={48} color="#ED2024" strokeWidth={1.5} />
<DeqIcon name="roj-half-sun" size="3em" title="" />
```

Components are named after the catalog id (`roj-half-sun` → `RojHalfSun`). `DeqIcon` picks an icon by name at run time and pulls in every icon, so prefer named imports. Any other prop (`className`, `style`, `onClick`, `ref`, `aria-*`) goes to the `<svg>`. Children are drawn after the shape. `createDeqIcon(icon, displayName)` turns custom `DeqIcon` data into a component.

| Option                | Default        | Notes                                                       |
| --------------------- | -------------- | ----------------------------------------------------------- |
| `size`                | `24`           | px number or a CSS length (`"2em"`)                         |
| `color`               | `currentColor` | any CSS colour                                              |
| `strokeWidth`         | `2`            | grid units on the 24×24 canvas                              |
| `absoluteStrokeWidth` | `false`        | keep the stroke `strokeWidth` px wide at any numeric `size` |
| `title`               | English name   | accessible label; `""` marks the icon decorative            |

Server rendering matches `render(id)` from `@0xdolan/deq-core`. For rotation, dot scale, fills, layer colours or shape parameters, use `@0xdolan/deq-core` (`render`) or `@0xdolan/deq-exporters`.

License: GPL-3.0-or-later. Example app: [`examples/react`](../../examples/react).
