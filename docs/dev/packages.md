---
title: Packages
description: The Deq packages for JavaScript, Python and Rust, and what each one is for.
sidebar:
  order: 1
---

All packages share one version number and are licensed under GPL-3.0-or-later.

| Package                             | Use it for                                                     |
| ----------------------------------- | -------------------------------------------------------------- |
| `@0xdolan/deq-core`                 | The reference renderer: `render`, `renderFlag`, the shape data |
| `@0xdolan/deq-icons`                | Icon data, SVG strings and a sprite                            |
| `@0xdolan/deq-react`                | One React component per shape                                  |
| `@0xdolan/deq-vue`                  | One Vue component per shape                                    |
| `@0xdolan/deq-svelte`               | One Svelte component per shape                                 |
| `@0xdolan/deq-elements`             | The `<deq-icon>` custom element, also as a CDN bundle with SRI |
| `@0xdolan/deq-exporters`            | 23 export formats: SVG, PDF, AI, PSD, PNG, ICO and more        |
| `@0xdolan/deq-cli`                  | The `deq` command for Node.js                                  |
| `deq-shapes` (PyPI)                 | The Python port and `deq` command                              |
| `deq-shapes`, `deq-cli` (crates.io) | The Rust port and `deq` command                                |

## Icon components

```tsx
import { KurdishSun, RojHalfSun } from "@0xdolan/deq-react";

<RojHalfSun size={32} strokeWidth={1.5} />;
```

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@0xdolan/deq-elements@VERSION/dist/cdn/deq-elements.js"
  integrity="sha384-HASH"
  crossorigin="anonymous"
></script>
<deq-icon name="kurdish-sun" size="48"></deq-icon>
```

Always pin an exact `VERSION` and take `HASH` from the package's `integrity.json`, so the browser refuses a changed file.

The [API reference](../api/core.md) documents every export of every package, generated from the source.
