---
title: The grid and keylines
description: The 24-unit canvas, the live area and the five keylines every Deq shape is drawn on.
sidebar:
  order: 1
---

Every Deq shape is drawn on the same square canvas, so any two shapes line up and look the same weight next to each other. The values on this page come from [`spec/grid.json`](../../spec/grid.json), the file the renderers, fonts and lint read.

## The canvas

- **24 × 24 units**, origin at the top left, y pointing down. One unit is one pixel when a shape is shown at 24 px.
- **Padding 1**, so the **live area** is the 22 × 22 square from (1, 1) to (23, 23). No ink leaves it, stroke edges included.
- Coordinates have **at most 3 decimals**.
- The centre of the canvas is (12, 12).

Because the default stroke is 2 units wide, half of it (1 unit) lies outside a stroke's centre line. Centre lines therefore stay between 2 and 22 on both axes.

## Keylines

Keylines are guide shapes. A shape fits the keyline that matches its outline, so a round shape and a square shape look the same size even though their boxes differ.

| Keyline   | Geometry                    | Use it for                              |
| --------- | --------------------------- | --------------------------------------- |
| Circle    | centre (12, 12), r 10       | Round shapes: suns, rosettes, rings     |
| Square    | 18 × 18 at (3, 3)           | Square shapes, so they match the circle |
| Portrait  | 16 wide × 20 high at (4, 2) | Tall shapes: stems, figures             |
| Landscape | 20 wide × 16 high at (2, 4) | Wide shapes: rows, bands, animals       |
| Live area | 22 × 22 at (1, 1)           | The outer limit for ink, never a target |

The square keyline is smaller than the circle's 20 × 20 box because a square of the same width covers more area and looks heavier. For example, [`x-mark`](https://kanilabs.github.io/deq/icons/x-mark/) runs its diagonals from (5, 5) to (19, 19), so with the round caps its visual box runs from 4 to 20 on both axes, inside the square keyline (3 to 21).

## Seeing the grid

- Every icon page on the website has a **Construction** section with the grid, the keylines and the live area drawn behind the shape, and dots on the centres of its circles, arcs, stars and repeats. See the [Kurdish Sun](https://kanilabs.github.io/deq/icons/kurdish-sun/#construction).
- In the [Studio](../guide/studio.md), **Grid** (G) and **Keylines** (K) in the toolbar show the same guides on the canvas, and **Snap** (S) snaps shapes to the grid.
- For your own drawings, the [tool guides](../tools/inkscape.md) explain how to set up a 24-unit grid in each app.

## Next

- [Strokes, dots and modules](strokes-and-dots.md): the parts every shape is built from.
- [Optical corrections](optical-corrections.md): why some centres are not exactly on 12, 12.
