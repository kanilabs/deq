---
title: Blender
description: Import Deq shapes into Blender as curves or Grease Pencil strokes and give them depth for 3D.
sidebar:
  order: 8
---

> Based on the Blender manual, linked below; not tested here. Corrections are welcome in the [issue tracker](https://github.com/kanilabs/deq/issues).

Blender reads only the path geometry of an SVG. Strokes, fills and colours are ignored, so a Deq shape arrives as its centre lines. Give them thickness in Blender, or turn the strokes into outlines first.

## Get the files

- **Download SVG** on an icon page, or `svg` from the [Studio](../guide/exporting.md), for the centre lines.
- For outlines that keep the exact stroke, open the SVG in [Inkscape](inkscape.md), select all, use **Path ‣ Stroke to Path** and save. Each stroke becomes a filled outline that Blender imports as a closed curve.

## Import as curves

1. **File ‣ Import ‣ SVG as Curves** (Scalable Vector Graphics).
2. The curves are created in the XY plane and scaled by the SVG's units, so a 24 px shape is small: scale it up in the viewport.

The manual says the importer supports SVG path geometry only and ignores gradients, fills, strokes, text, images and filters. Deq shapes also use circles, lines and other elements; **Stroke to Path** in Inkscape turns them all into paths, which is the safest route.

## Give it depth

Select the curve and open the **Object Data** properties, **Geometry** panel:

- **Depth** under **Bevel** sets the size of the round cross-section, which turns centre lines into tubes, close to a Deq stroke.
- **Extrude** pushes closed outlines (from Stroke to Path) out into solid shapes for 3D printing or relief.

## Import as Grease Pencil

**File ‣ Import ‣ SVG as Grease Pencil** creates 2D strokes instead. Its options include **Resolution**, **Scale**, **Scene Unit** and **Center on Bounds**.

## Recolour

Colours are not imported. Add a material to the curve and set its colour there.

## Sources

- [Import SVG as curves](https://docs.blender.org/manual/en/latest/files/import_export/svg_curve.html)
- [Import SVG as Grease Pencil](https://docs.blender.org/manual/en/latest/files/import_export/grease_pencil_svg.html)
- [Curve geometry](https://docs.blender.org/manual/en/latest/modeling/curves/properties/geometry.html)
