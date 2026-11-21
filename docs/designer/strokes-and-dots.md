---
title: Strokes, dots and modules
description: The stroke width, caps, dot sizes and the few reusable parts every Deq shape is built from.
sidebar:
  order: 2
---

Deq shapes are line drawings, like the tattoos they come from. A small set of rules keeps every line and dot the same, so shapes can sit side by side, be combined, and share parts.

## Strokes

- **Width 2 units.** At 24 px that is 2 px; at 48 px, 4 px. The stroke scales with the shape unless you ask for an absolute width (see below).
- **Round caps and round joins.** A line therefore reaches 1 unit past its end points, and corners are rounded.
- **No fill, `currentColor` ink.** A stroke takes the colour of the text around it unless you set one.
- **3 units between parallel centre lines.** With a 2-unit stroke that leaves 1 unit of clear space between the strokes. For lines at an angle, measure square to the line, not along an axis.

### Changing the stroke

Every renderer, the Studio and the icon components accept the same options:

| Option                | Default | What it does                                          |
| --------------------- | ------- | ----------------------------------------------------- |
| `strokeWidth`         | 2       | Stroke width in grid units                            |
| `absoluteStrokeWidth` | false   | Keep the stroke `strokeWidth` pixels wide at any size |
| `linecap`             | `round` | `round`, `butt` or `square`                           |
| `linejoin`            | `round` | `round`, `miter` or `bevel`                           |
| `strokeOpacity`       | 1       | Opacity of strokes and dots                           |

A thinner stroke (1.5 or 1) suits large sizes and dense compositions. Keep 2 at 24 px and below, where thinner lines blur. With `absoluteStrokeWidth`, a 48 px icon keeps a 2 px line instead of growing to 4 px, which is useful next to text. The full list is in the [core API reference](../api/core.md).

## Dots

- **Dots are filled circles**, not strokes. Inside shapes they have **radius 1**, so a dot is as wide as a stroke.
- The **large dot** has radius 2. The standalone [`dot`](https://kanilabs.github.io/deq/icons/dot/) shape uses it so it still reads at small sizes.
- `dotScale` multiplies every dot radius, for example 1.5 for heavier dots at large sizes.

## Modules

Every shape is built from the same parts, listed under `modules` in [`spec/grid.json`](../../spec/grid.json). The lint rejects any other circle or dot radius.

| Module       | Size                                  | Example                                                                     |
| ------------ | ------------------------------------- | --------------------------------------------------------------------------- |
| Sun circle   | r 5                                   | [Sun circle](https://kanilabs.github.io/deq/icons/roj-sun-circle/)          |
| Ring         | r 3                                   | [Sun with rays](https://kanilabs.github.io/deq/icons/sun-rays/)             |
| Bead         | r 2 (stroked)                         | [Chain](https://kanilabs.github.io/deq/icons/chain/)                        |
| Dots         | r 1 (small), r 2 (large)              | [Dot rosette](https://kanilabs.github.io/deq/icons/dot-rosette/)            |
| Rays         | start 2.5 beyond the circle, 2.5 long | [Half sun](https://kanilabs.github.io/deq/icons/roj-half-sun/): r 7.5 to 10 |
| V            | two lines at 45°, 3 × 3 or 6 × 6      | –                                                                           |
| 45° pitch    | parallel 45° strokes 4.5 apart        | [Chevron stack](https://kanilabs.github.io/deq/icons/chevron-stack/)        |
| Teeth, ticks | 3 long, every 3 units                 | [Comb](https://kanilabs.github.io/deq/icons/comb/)                          |

Why 4.5 for the 45° pitch: two 45° lines 4.5 apart along an axis are 4.5 × sin 45° ≈ 3.18 apart square to the lines, just over the 3-unit minimum.

A V is always two separate lines from a shared apex, never one polyline, so each arm can be shown, hidden or recoloured on its own.

## Layers

Each part of a shape is its own layer (`sun`, `rays`, `dot`, ...), and the layered exports keep them apart: Inkscape layers in layered SVG, PDF layers in PDF and AI, pixel layers in PSD. The icon page lists a shape's layers, and `layerColors` gives each layer its own colour. See [Exporting](../guide/exporting.md).

## Next

- [Optical corrections](optical-corrections.md)
- [Reading a construction](construction.md)
