---
title: Affinity
description: Open Deq shapes in Affinity with their layers, recolour them, change the stroke and build compositions.
sidebar:
  order: 5
---

> Based on Affinity's documentation and forum, linked below; not tested here. Corrections are welcome in the [issue tracker](https://github.com/kanilabs/deq/issues).

Affinity is now a single free app from Canva for Mac, Windows and iPad. The older Affinity Designer 2 still works but gets no new features. The steps below apply to both.

## Get the files

- `svg-layered` from the [Studio](../guide/exporting.md), or `deq render kurdish-sun --layered --out kurdish-sun.svg`, has one named group per shape layer.
- `pdf` has one PDF layer per shape layer.
- **Download SVG** on an icon page gives a plain SVG.

## Open with layers

**Open** the SVG or PDF as a document rather than placing it into another one. According to an answer on the Affinity forum, a placed SVG arrives as a single embedded object, while an opened one shows its groups in the Layers panel, where you can select, hide or lock each part.

To combine shapes, open each one, copy its groups and paste them into your design.

## Recolour

Select a part in the Layers panel and pick a colour in the Colour panel. Strokes and fills have their own swatches; Deq strokes use the stroke colour and dots use the fill. To start from the right colours, set **Colour** and **Layer colours** in the Studio before exporting.

## Change the stroke

The Stroke panel sets the width, cap and join. Keep round caps and joins to match the other shapes. The Deq default is 2 at 24 px; see [strokes, dots and modules](../designer/strokes-and-dots.md).

## Build compositions

Set up a document grid with a spacing of 1 px for 24 px shapes, keep all shapes at the same size, and leave at least 1 grid unit between the ink of neighbours. See [spacing and composition](../designer/composition.md). Affinity can export the result to SVG and PDF with its layers.

## Sources

- [Affinity](https://www.affinity.studio/)
- [Affinity V2 apps](https://affinity.serif.com/v2/)
- [Affinity Designer 2 key features](https://affinity.help/designer2/English.lproj/pages/Introduction/keyFeatures.html)
- [Opening SVG files in Affinity Designer 2](https://forum.affinity.serif.com/index.php?/topic/183569-opening-svg-files-in-affinity-designer-2/) (forum)
