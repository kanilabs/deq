---
title: Docs
description: Guides for the Deq website, Studio, exports and fonts, designer docs, design-tool guides and the developer docs.
---

Deq draws traditional Kurdish tattoo (deq) motifs on one 24-unit grid, as icons, fonts and code. These pages explain how to use every part of it. They are the same files you can read on GitHub, in the `docs/` folder.

## Guides

- [Getting started](guide/getting-started.md): what Deq has, and the fastest way to use a shape.
- [The Studio](guide/studio.md): every panel of the design canvas.
- [Exporting](guide/exporting.md): all 23 formats and when to use each.
- [Your own shapes](guide/custom-shapes.md): the shape editor, the path editor and "My shapes".
- [Deq Leet](guide/leet.md): text written with Deq motifs.
- [Pattern generator](guide/generate.md): seeded bands, grids, rosettes and borders.
- [The flag](guide/flag.md): the flag of Kurdistan, its colours and variants.
- [Installing the fonts](guide/fonts.md): the icon and Leet fonts on Linux, macOS and Windows.
- [Install the site as an app](guide/pwa.md): use Deq offline.

## For designers

- [The grid and keylines](designer/grid.md): the 24-unit canvas, the live area and the keylines.
- [Strokes, dots and modules](designer/strokes-and-dots.md): the parts every shape is built from.
- [Optical corrections](designer/optical-corrections.md): why some shapes are moved or resized by eye.
- [Construction](designer/construction.md): the coordinates and maths behind each shape.
- [Spacing and composition](designer/composition.md): combining shapes into rows, borders and layouts.
- [Colour and accessibility](designer/colour.md): the flag colours, contrast and accessible icons.

## Design tools

Step-by-step guides to import Deq shapes with their layers, recolour them, change the stroke and build compositions: [Inkscape](tools/inkscape.md), [Illustrator](tools/illustrator.md), [Photoshop](tools/photoshop.md), [Figma](tools/figma.md), [Affinity](tools/affinity.md), [Sketch](tools/sketch.md), [Canva](tools/canva.md), [Blender](tools/blender.md).

## For developers

- [Packages](dev/packages.md): the JavaScript, Python and Rust packages.
- [Command line](dev/cli.md): the `deq` tool in Node.js, Python and Rust.
- [Development setup](dev/setup.md): build and test the project.
- [Architecture](dev/architecture.md) and the [codegen pipeline](dev/codegen.md): how the parts fit together.
- [Shape spec](dev/spec.md) and [adding a shape](dev/adding-a-shape.md).
- [Writing an exporter](dev/exporters.md) and the [font pipeline](dev/fonts.md).
- [Testing](dev/testing.md), [releasing](dev/releasing.md) and [security](dev/security.md).

## API reference

- JavaScript: [core](api/core.md), [exporters](api/exporters.md), [generator](api/generator.md), [icons](api/icons.md), [React](api/react.md), [Vue](api/vue.md), [Svelte](api/svelte.md), [elements](api/elements.md) and the [CLI package](api/cli.md).
- [Python](api/python.md), [Rust](api/rust.md) and the [`deq` commands](api/commands.md).

## Project

- [README](../README.md), [contributing](../CONTRIBUTING.md), [security policy](../SECURITY.md) and [code of conduct](../CODE_OF_CONDUCT.md)
- [Architecture decisions](decisions/0001-record-architecture-decisions.md) and the [changelog](../CHANGELOG.md)
