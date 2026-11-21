---
title: Colour and accessibility
description: Colouring Deq shapes, the flag colours and their contrast, and making icons accessible.
sidebar:
  order: 6
---

Deq shapes have no colour of their own. They are drawn in `currentColor`, so they take the colour of the text around them, and you choose the colour where you use them.

## Colour options

| Option          | Default        | What it does                                               |
| --------------- | -------------- | ---------------------------------------------------------- |
| `color`         | `currentColor` | Colour of strokes and dots (any CSS colour)                |
| `layerColors`   | none           | A colour per layer, for example `{ "rays": "#FEBD11" }`    |
| `fill`          | `none`         | Fill for closed outlines (circles, polygons, closed paths) |
| `fillOpacity`   | 1              | Opacity of the fill                                        |
| `strokeOpacity` | 1              | Opacity of strokes and dots                                |
| `background`    | `none`         | A colour behind the whole shape                            |

The same options are in the Studio inspector (**Colour**, **Layer colours**, **Fill**, **Background**), on the [command line](../api/commands.md) and in every package. Layer names are listed on each icon page. In design tools, recolour the groups of a layered SVG; the [tool guides](../tools/inkscape.md) show how.

## The flag colours

The flag of Kurdistan uses four colours, from [`spec/flag.json`](../../spec/flag.json):

| Colour | Hex       |
| ------ | --------- |
| Red    | `#ED2024` |
| White  | `#FFFFFF` |
| Green  | `#278E43` |
| Yellow | `#FEBD11` |

They are a natural palette for Deq designs, but no pair of them is strong enough for small text. Their contrast ratios (WCAG 2), checked by the lint:

| Pair            | Ratio | Use                                                      |
| --------------- | ----- | -------------------------------------------------------- |
| Red on white    | 4.35  | Graphics and large text only (needs 3:1); not small text |
| White on green  | 4.17  | Graphics and large text only                             |
| Red on yellow   | 2.59  | Decoration only                                          |
| Green on yellow | 2.48  | Decoration only                                          |
| Yellow on white | 1.68  | Never to carry meaning                                   |
| Red on green    | 1.04  | Never to carry meaning                                   |

When a shape carries meaning (a button, a status, a link), give it at least **3:1** against its background, the WCAG minimum for graphics. Black or white ink on a flag colour is usually the safe choice. Never recolour, stretch or change the rays of the flag itself; see the [flag guide](../guide/flag.md).

## Light and dark

`currentColor` follows the text colour, so a shape placed in text switches with a light or dark theme on its own. Fixed colours do not: check them on both backgrounds, or give a dark theme its own colours.

## Accessible icons

- A shape with meaning needs a name. The renderers give the SVG a `<title>`, `role="img"` and an `aria-label`, all the shape's English name by default. Set `title` or `ariaLabel` to describe what the icon does, for example "Download".
- A decorative shape next to text that already says the same thing should be hidden from screen readers: pass `title: ""`, and the SVG gets `aria-hidden="true"` instead.
- Do not use colour alone to tell shapes apart; change the shape too.
- Keep 24 px and the default stroke at small sizes. Lines thinner than 1.5 px are hard to see.

## Next

- [The tool guides](../tools/inkscape.md)
