---
title: Spacing and composition
description: How to place Deq shapes next to each other, combine them into larger designs and keep the spacing even.
sidebar:
  order: 5
---

Deq shapes share one grid, one stroke and one set of parts, so they combine well as long as a few rules are kept.

## Inside a shape

- **3 units between parallel centre lines**, so 1 unit of clear space between 2-unit strokes. Measure square to the strokes for lines at an angle.
- **Rays start 2.5 beyond the circle** they belong to: the gap is the same on every sun.
- **Repeats use fixed pitches**: 4.5 for 45° strokes, 3 for teeth and ticks.

## Combining shapes

Several catalog shapes are compositions of other shapes. They place each part with `use` **at full size**:

- Scaling a shape would also scale its circles, dots and gaps, so they would no longer match the modules.
- The parts are moved, not resized. For example, [circle over comb](https://kanilabs.github.io/deq/icons/circle-over-comb/) puts the sun circle (r 5) with its centre on y 8.5 above a seven-tooth comb whose bar is on y 20.5. That leaves 2 units clear between the circle and the tooth tips, and the whole is centred on the grid.

Do the same in your own designs: move whole shapes, keep them at the same size, and leave at least 1 unit (preferably 2) of clear space between the ink of neighbouring shapes.

## Rows, grids and borders

- Place shapes at the **same size**, so their strokes match. Mixing a 24 px shape with a 48 px one doubles the stroke of one of them; use `absoluteStrokeWidth` if you must mix sizes.
- Space them on a **regular step**. The [pattern generator](../guide/generate.md) builds bands, grids, rosettes and borders on a cell grid, and its **Spacing** option adds grid units between cells.
- Bands look balanced with an odd number of cells, mirrored about the centre. The generator's bands use 3 to 63 cells.
- In the [Studio](../guide/studio.md), **Snap** keeps shapes on the grid, and **Arrange** aligns and distributes the selection.

## Shapes next to text

- Match the shape's size to the line height, for example 24 px with 16 px text. The [icon packages](../dev/packages.md) default to 24 px.
- Use `absoluteStrokeWidth` to keep the line as heavy as the text at larger sizes.
- The Deq Leet font draws text with motifs; see [Deq Leet](../guide/leet.md).

## Rotating and mirroring

`rotation`, `flipX` and `flipY` turn and mirror a shape about the canvas centre. A shape's symmetry (shown on its icon page) tells you which of these leave it unchanged: a `mirror-x` shape looks the same flipped left to right, and a `rotational-4` shape after a quarter turn.

## Next

- [Colour and accessibility](colour.md)
