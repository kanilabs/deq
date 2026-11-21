---
title: Adobe Photoshop
description: Use Deq shapes in Photoshop as layered PSD files or scalable Smart Objects, recolour them and change the stroke.
sidebar:
  order: 3
---

> Based on Adobe's documentation, linked below; not tested here. Corrections are welcome in the [issue tracker](https://github.com/kanilabs/deq/issues).

Photoshop works in pixels, so choose the file by what you need to change later.

## Get the files

- `psd` from the [Studio](../guide/exporting.md) has one pixel layer per shape layer, at each scale you tick under **Scales** (1× to 4×).
- **PDF** keeps the shape as vectors. Placed in Photoshop it becomes a Smart Object that stays sharp when resized.
- **PNG** is a single flat image.

## Open

- **PSD**: **File ‣ Open**. Each Deq layer (for example `ring` and `rays`) is its own layer in the Layers panel. Click the eye icon to show or hide one; Alt-click (Option-click on a Mac) the eye to show only that layer.
- **PDF**: **File ‣ Place Embedded** stores the shape inside your document as a Smart Object; **File ‣ Place Linked** keeps a link to the file. Photoshop asks for crop options before placing a PDF.

## Recolour

- On a pixel layer, turn on **Lock transparent pixels** in the Layers panel and fill the layer with a new colour: only the painted pixels change.
- Or add a **Color Overlay** layer style, which you can change again later.
- Give each layer its own colour to colour the parts separately. You can also set **Layer colours** in the Studio before exporting.

## Change the stroke

The stroke of a pixel layer cannot be made thicker or thinner without redrawing it. Export again from the Studio with a different **Stroke width**, or from the command line with `--stroke-width`, and replace the layer. Use a size or scale large enough for the final design: pixel layers blur when scaled up.

## Build compositions

Drag layers between documents, or place several PDF Smart Objects. Keep shapes at the same size so their strokes match, and leave clear space between them. See [spacing and composition](../designer/composition.md).

## Sources

- [Place files in Photoshop](https://helpx.adobe.com/photoshop/desktop/create-open-import-images/import-files/place-a-file-in-photoshop.html)
- [Place Illustrator and PDF files in Photoshop](https://helpx.adobe.com/photoshop/desktop/app-integrations/place-illustrator-files-or-pdf-in-photoshop.html)
- [Lock layers](https://helpx.adobe.com/photoshop/desktop/create-manage-layers/transform-manipulate-layers/lock-layers.html)
- [Fill selections or layers with colour](https://helpx.adobe.com/photoshop/desktop/apply-painting-techniques/fill-objects-selections-layers/fill-selection-layer-color.html)
