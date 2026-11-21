# @0xdolan/deq-icons

<img src="https://kanilabs.github.io/deq/brand/banner.png" width="640" height="160" alt="Deq · دەق: the Dot rosette logo, traditional Kurdish tattoo shapes as an open, parametric design system.">

All 93 Deq shapes, the motifs of traditional Kurdish tattoo (deq), as framework-free icon data, SVG strings, static SVG files and a sprite. Default output matches `render(id)` from `@0xdolan/deq-core` byte for byte.

```sh
npm install @0xdolan/deq-icons
```

```ts
import { rojHalfSun, toSvg } from "@0xdolan/deq-icons";

toSvg(rojHalfSun); // <svg ...><title>Half sun</title>...</svg>
toSvg(rojHalfSun, { size: 32, color: "#ED2024", title: "" });
```

Every icon is a named export (`roj-half-sun` → `rojHalfSun`), so bundlers keep only the icons you import. `icons` holds all of them by catalog id.

| Entry                               | Contents                                                  |
| ----------------------------------- | --------------------------------------------------------- |
| `@0xdolan/deq-icons`                | icon data (`DeqIcon`), `toSvg`, `rootAttributes`, names   |
| `@0xdolan/deq-icons/svg`            | ready SVG strings: `import { rojHalfSun } from ".../svg"` |
| `@0xdolan/deq-icons/svg/<id>.svg`   | one static SVG file per shape                             |
| `@0xdolan/deq-icons/sprite.svg`     | every shape as a `<symbol id="deq-<id>">`                 |
| `@0xdolan/deq-icons/icons.json`     | id, names (en, ckb, kmr), category, aliases and tags      |
| `@0xdolan/deq-icons/integrity.json` | SRI hashes of the sprite and `icons.json`                 |

## Options

| Option                | Default        | Notes                                                       |
| --------------------- | -------------- | ----------------------------------------------------------- |
| `size`                | `24`           | px number or a CSS length (`"2em"`)                         |
| `color`               | `currentColor` | any CSS colour                                              |
| `strokeWidth`         | `2`            | grid units on the 24×24 canvas                              |
| `absoluteStrokeWidth` | `false`        | keep the stroke `strokeWidth` px wide at any numeric `size` |
| `title`               | English name   | accessible label; `""` marks the icon decorative            |

Invalid options throw `DeqError` with code `INVALID_OPTIONS`. For rotation, dot scale, fills, layer colours or shape parameters, use `@0xdolan/deq-core` (`render`) or `@0xdolan/deq-exporters`.

## Sprite

```html
<svg width="24" height="24"><use href="/sprite.svg#deq-roj-half-sun" /></svg>
```

CDN links with SRI: [docs/cdn.md](../../docs/cdn.md).

License: GPL-3.0-or-later.
