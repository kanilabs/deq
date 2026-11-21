---
title: Sketch
description: Bring Deq shapes into Sketch as editable layers, recolour them and change the stroke.
sidebar:
  order: 6
---

> Based on Sketch's documentation, linked below; not tested here. Corrections are welcome in the [issue tracker](https://github.com/kanilabs/deq/issues).

## Get the files

- `svg-layered` from the [Studio](../guide/exporting.md) has one named group per shape layer.
- The `figma` format suits Sketch too: it has the same named groups, with `currentColor` replaced by real colours.
- **Download SVG** on an icon page gives a plain SVG.

## Import

- Drag SVG files onto the Sketch icon in the Dock or straight onto the canvas.
- Or open the SVG file in a text editor, copy its code and paste it on the canvas: Sketch turns it into a layer.

## Keep layers

Each Deq layer comes in as a group in the layer list, named after the layer (`ring`, `rays`, ...) in the `figma` export and `layer-ring`, `layer-rays`, ... in `svg-layered`, so you can select, hide or recolour each part.

## Recolour

Select a layer and change its colour in the Inspector: dots are fills, set in the **Fills** section; the lines are borders. To start from the right colours, set **Colour** and **Layer colours** in the Studio before exporting.

## Change the stroke

Sketch calls strokes borders. Change the border thickness in the Inspector and keep round ends and joins to match the other shapes. If the options are unclear, export again with a different **Stroke width** in the Studio instead. The Deq default is 2 at 24 px; see [strokes, dots and modules](../designer/strokes-and-dots.md).

## Build compositions

Use a 24 × 24 artboard per shape, with a 1 px grid, and keep artboards the same size when you combine them. Leave at least 1 grid unit between the ink of neighbours. See [spacing and composition](../designer/composition.md).

## Sources

- [Importing and exporting](https://www.sketch.com/docs/designing/importing-and-exporting/)
- [Fills](https://www.sketch.com/docs/components-and-styles/styling/fills/)
