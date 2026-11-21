---
title: Optical corrections
description: How Deq shapes are nudged so they look centred and evenly weighted, with the maths for each case.
sidebar:
  order: 3
---

A shape can be centred by the numbers and still look off. Deq corrects this in a few fixed ways, and records each correction in the shape's `construction` steps, so the reason for every odd-looking number is written down.

## Centre the ink, not the geometry

Each shape is centred by its **visual box**: the box around the ink, stroke and round caps included. The visual box is centred on (12, 12) along every axis the shape's symmetry leaves free, rounded to 0.5. The `visualBox` in each shape's metrics (shown on its icon page) lets you check it. The lint checks the symmetry itself and that every parameter combination stays inside the live area.

Asymmetric shapes are therefore shifted as a whole. The [crescent](https://kanilabs.github.io/deq/icons/heyv-crescent/) is built from two circles:

- outer edge: r 9 about (10, 12);
- inner edge: r 7.5 about (5.5, 12), 4.5 to the left.

The circles cross where (x − 10)² − (x − 5.5)² = 9² − 7.5², which gives x = 5 and y = 12 ± √(81 − 25) = 12 ± 7.483. The ink runs from the horns at x = 5 − 1 = 4 to the outer edge at 10 + 9 + 1 = 20, so its centre is (4 + 20) / 2 = 12. The circle centres sit left of 12 so that the crescent as seen is centred.

## Fit the star to the keyline

A star with an odd number of points is taller above its centre than below it. The [Kurdish Sun](https://kanilabs.github.io/deq/icons/kurdish-sun/#construction) has 21 points with the first pointing straight up:

- The top point is R above the centre.
- The lowest points are the two either side of the bottom, R cos(π/21) below the centre.
- The height is therefore R (1 + cos(π/21)). Setting it to the 20-unit keyline gives R = 20 / (1 + cos(π/21)) = 10.0562.
- To centre the 2-to-22 box, the star's centre moves down to (12, 12.056).

The flag of Kurdistan does the same at its own scale: its sun's centre is at y = 300.842 on a 600-unit-high field. The [flag guide](../guide/flag.md) has the figures.

## Outline from the same edge

When a filled shape also has an outline variant, the outline is drawn 1 unit inside, so the outer edge of its 2-unit stroke lands where the filled edge was. The Kurdish Sun's outline uses R − 1 = 9.056 and inner radius 4.528. Filled and outline versions then have the same size.

## Square shapes are smaller

A square as wide as a circle looks bigger, because it covers more area. Square shapes therefore use the 18 × 18 square keyline instead of the circle's 20 × 20 box. See [the grid and keylines](grid.md).

## Spacing measured square to the stroke

Clear space between strokes is measured at right angles to them. For lines at an angle, the gap along an axis is larger than the real gap:

- Parallel 45° strokes repeat every 4.5 units, which is 3.18 square to the strokes.
- The [nested lozenge](https://kanilabs.github.io/deq/icons/lozenge-nested/) copies its outline at scales 1 and 0.5. Each edge is 72 / √145 = 5.98 from the centre, so the copies are 2.99 apart square to the edges, about 1 unit of clear space. A step of 1/3 would put the strokes too close, and a third copy does not fit.

## A larger dot when alone

Dots inside shapes have radius 1, as wide as a stroke. The standalone [`dot`](https://kanilabs.github.io/deq/icons/dot/) uses radius 2, so it does not disappear at 16 px.

## Next

- [Reading a construction](construction.md)
- [Spacing and composition](composition.md)
