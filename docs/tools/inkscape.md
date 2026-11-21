---
title: Inkscape
description: Open Deq shapes in Inkscape with their layers, recolour them, change the stroke and build compositions.
sidebar:
  order: 1
---

> Tested with Inkscape 1.4.3 on Linux. Menu names are from Inkscape 1.4; keyboard shortcuts use Ctrl, which is ⌘ on a Mac.

Inkscape works in SVG, Deq's native format, so it keeps everything: layers, round caps and exact coordinates.

## Get the files

- **Layered SVG** keeps each part of a shape as an Inkscape layer. Export it from the [Studio](../guide/exporting.md) (format `svg-layered`) or with the command line: `deq render kurdish-sun --layered --out kurdish-sun.svg`.
- **PDF** and **AI** exports keep the same layers as PDF layers.
- **Download SVG** on an icon page gives a plain SVG without layers, which is fine for single-colour use.

Export at the default 24 px if you want to redraw on the grid: one pixel is then one grid unit.

## Open with layers

1. **File ‣ Open** (Ctrl+O) and choose the layered SVG.
2. **Layer ‣ Layers and Objects** (Ctrl+Shift+L) lists the layers by name, for example `ring` and `rays` for the Sun with rays. Use the eye and lock buttons to hide or lock a layer.

**File ‣ Import** (Ctrl+I) adds a file to the open document instead, inside the current layer. Use Open when you want the layers.

For a PDF or AI file, keep the default PDF import option rather than **Poppler/Cairo import**: the default keeps the PDF layers as Inkscape layers, Poppler/Cairo import does not.

## Recolour

1. Select the parts to recolour. To take a whole layer, click it in **Layers and Objects** and choose **Edit ‣ Select All** (Ctrl+A).
2. Open **Object ‣ Fill and Stroke** (Ctrl+Shift+F).
3. Strokes: set the colour on the **Stroke paint** tab. Dots are filled circles: set them on the **Fill** tab.

Deq shapes use `currentColor`, which Inkscape shows as black until you set a colour. To skip this step, export with the colours already set: **Colour** and **Layer colours** in the Studio, or `--color` and `--layer-color rays=#FEBD11` on the command line.

## Change the stroke

On the **Stroke style** tab of **Fill and Stroke**, change the **Width**, the **Cap** and the **Join**. Keep round caps and joins to match the other shapes. Width 2 at 24 px is the Deq default; see [strokes, dots and modules](../designer/strokes-and-dots.md).

For cutting plotters, embroidery or 3D, **Path ‣ Stroke to Path** turns each stroke into a filled outline of the same shape.

## Build compositions

1. Turn on the grid: **File ‣ Document Properties** (Ctrl+Shift+D) holds the grid settings; use a spacing of 1 px for 24 px shapes. **View ‣ Page Grid** (#) shows or hides it.
2. **File ‣ Import** each shape, all exported at the same size.
3. Move whole shapes, keep them unscaled, and leave at least 1 grid unit between the ink of neighbours. **Object ‣ Align and Distribute** lines them up.

See [spacing and composition](../designer/composition.md) for the rules, and the [construction](../designer/construction.md) section of each icon page for exact coordinates.

## Sources

- Tested with Inkscape 1.4.3: menu names from its `menus.ui`, shortcuts from its default `keys/inkscape.xml`, and the layers of Deq's layered SVG and PDF files after import.
- [Inkscape documentation](https://inkscape.org/learn/)
