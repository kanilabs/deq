---
title: Figma
description: Bring Deq shapes into Figma as editable vectors with named layers, recolour them and change the stroke.
sidebar:
  order: 4
---

> Based on Figma's documentation, linked below; not tested here. Corrections are welcome in the [issue tracker](https://github.com/kanilabs/deq/issues).

## Get the files

- The `figma` format in the [Studio](../guide/exporting.md) (Data group) is an SVG made for Figma: each shape layer is a group named after it, and `currentColor` is replaced by real colours, because Figma has no text colour to inherit.
- Any other Deq SVG works too, but `currentColor` parts may come in black.

## Import

Figma converts an imported SVG into editable vector layers.

- Drag the SVG file onto the canvas, or
- use **Place image/video** in the shape tools menu (Shift+⌘+K on a Mac, Shift+Ctrl+K on Windows), or
- copy SVG markup and paste it on the canvas (right-click ‣ **Paste here**).

Figma leaves out SVG `marker` and `pattern` elements. Deq shapes use neither.

## Keep layers

In the Figma export, each Deq layer arrives as a group with the layer's name (`ring`, `rays`, `dot`, ...), so you can select, hide or recolour each part from the Layers panel.

## Recolour

Select a group or vector and change its stroke colour in the right sidebar. Dots are fills. To start from the right colours, set **Colour** and **Layer colours** in the Studio before exporting.

## Change the stroke

Change the stroke weight in the right sidebar. Keep round caps and joins to match the other shapes. The Deq default is 2 at 24 px; see [strokes, dots and modules](../designer/strokes-and-dots.md).

## Build compositions

Use a 24 × 24 frame per shape, with a layout grid of 1 px, so shapes keep the Deq grid. Keep frames the same size when you combine them, and leave clear space between the ink of neighbours. See [spacing and composition](../designer/composition.md).

## Sources

- [Import files to the canvas](https://help.figma.com/hc/en-us/articles/360040028034)
- [Import and export SVG](https://help.figma.com/hc/en-us/articles/360040030374)
