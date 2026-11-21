---
title: Adobe Illustrator
description: Open Deq shapes in Illustrator, recolour them, change the stroke and build compositions.
sidebar:
  order: 2
---

> Based on Adobe's documentation, linked below; not tested here. Corrections are welcome in the [issue tracker](https://github.com/kanilabs/deq/issues).

## Get the files

- `ai` from the [Studio](../guide/exporting.md) is a PDF-compatible file with one PDF layer per shape layer.
- **PDF** has the same layers.
- `svg-layered` has one named group per shape layer.
- **Download SVG** on an icon page gives a plain SVG.

## Open

- Open AI and PDF files with **File ‣ Open**. For a PDF with several pages, the PDF Import Options dialog chooses the page; Deq files have one page.
- Bring an SVG or PDF into an existing document with **File ‣ Place**. A placed PDF stays linked unless you turn **Link** off; with Link off you can edit its parts.

Adobe's pages do not say whether Illustrator turns PDF layers into Illustrator layers. If a shape opens as a single group, open the layered SVG instead: each Deq layer is one group, which you can select, recolour or move to its own layer.

## Recolour

- Select a part and set its stroke colour. Dots are fills.
- **Recolor Artwork** changes all the colours of a selection at once: select the artwork and choose **Recolor** in the Properties panel.

## Change the stroke

**Window ‣ Stroke** opens the Stroke panel. Set the **Weight**, and choose the round cap and round join to match Deq. If caps and joins are hidden, choose **Show Options** from the panel menu.

A Deq shape exported at 24 px has a 2 px stroke. If you resize it, check that the stroke changes the way you want.

## Build compositions

Place shapes at the same size, move them without scaling, and line them up with the Align panel. Leave at least 1 grid unit (1 px at 24 px) between the ink of neighbouring shapes. See [spacing and composition](../designer/composition.md).

## Sources

- [Importing PDF files](https://helpx.adobe.com/illustrator/using/importing-pdf-files.html)
- [SVG in Illustrator](https://helpx.adobe.com/illustrator/using/svg.html)
- [Apply and configure strokes](https://helpx.adobe.com/illustrator/using/stroke-object.html)
- [Change line caps and joins](https://helpx.adobe.com/illustrator/desktop/paint-and-fill/apply-and-edit-strokes/change-the-caps-or-joins-of-a-line.html)
- [Recolor your artwork](https://helpx.adobe.com/my_en/illustrator/using/quick-actions/recolor.html)
