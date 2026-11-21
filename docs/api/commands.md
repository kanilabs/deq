---
title: "deq commands"
description: Every command, argument, option and exit code of the deq command-line tool.
sidebar:
  order: 12
---

<!-- Generated from spec/cli.json by packages/cli/scripts/generate.ts; do not edit. -->

Draw Deq shapes, traditional Kurdish tattoo motifs, as SVG, PDF and images. The Node.js, Python and Rust tools share this interface ([ADR 0011](../decisions/0011-ports-and-clis.md)); the [command line guide](../dev/cli.md) shows how to install them.

```text
deq <command> [options]
```

| Command | What it does |
| --- | --- |
| [`list`](#deq-list) | List the shapes in the catalog. |
| [`info`](#deq-info) | Show a shape's names, layers and parameters. |
| [`render`](#deq-render) | Render shapes to files. |
| [`export`](#deq-export) | Export shapes in several formats and sizes. |
| [`flag`](#deq-flag) | Draw the flag of Kurdistan. |
| [`leet`](#deq-leet) | Write text with Deq glyphs (Deq Leet), or read it back with --decode. |
| [`generate`](#deq-generate) | Generate a seeded pattern of Deq motifs. |
| [`validate`](#deq-validate) | Check a shape spec file and render every parameter variant. |
| [`completion`](#deq-completion) | Print a shell completion script. |

## Options of every command

| Option | What it does |
| --- | --- |
| `-h, --help` | Show help. |
| `-V, --version` | Print the version. |

## deq list

List the shapes in the catalog.

```text
deq list [options]
```

| Option | What it does |
| --- | --- |
| `--category <id>` | Only shapes in this category. |
| `--json` | Print JSON. |

## deq info

Show a shape's names, layers and parameters.

```text
deq info <shape> [options]
```

| Argument | What it is |
| --- | --- |
| `<shape>` | Shape id (see deq list). |

| Option | What it does |
| --- | --- |
| `--json` | Print JSON. |

## deq render

Render shapes to files.

```text
deq render <shape...> [options]
```

| Argument | What it is |
| --- | --- |
| `<shape...>` | Shape ids (see deq list). |

| Option | What it does |
| --- | --- |
| `--format <format>` | Output format. Default svg. Values: svg, svg-layered, svg-sprite, html, jsx, tsx, vue, svelte, data-uri, css-background, css-mask, pdf, ai, eps, png, jpg, webp, avif, ico, favicon, psd, figma, spec-json. |
| `--size <px>` | Width and height in px, 1 to 8192. Default 24. |
| `--layered` | SVG with one Inkscape layer per shape layer (same as --format svg-layered). |
| `--out <path>` | Output file, or a directory for several files; - writes one file to stdout. Default: the current directory. |
| `--color <color>` | Stroke and dot colour (any CSS colour). Default currentColor. |
| `--stroke-width <n>` | Stroke width in grid units, 0.05 to 12. Default 2. |
| `--absolute-stroke-width` | Keep the stroke the same width in px at any size. |
| `--fill <color>` | Fill for closed outlines, or none. Default none. |
| `--fill-opacity <0-1>` | Opacity of the fill. Default 1. |
| `--stroke-opacity <0-1>` | Opacity of strokes and dots. Default 1. |
| `--linecap <linecap>` | Line ends. Default round. Values: round, butt, square. |
| `--linejoin <linejoin>` | Line corners. Default round. Values: round, miter, bevel. |
| `--dot-scale <n>` | Multiply every dot radius, 0.1 to 4. Default 1. |
| `--rotation <deg>` | Rotate clockwise about the centre. Default 0. |
| `--flip-x` | Mirror left to right. |
| `--flip-y` | Mirror top to bottom. |
| `--padding <n>` | Space around the 24 x 24 canvas in grid units, 0 to 24. Default 0. |
| `--background <color>` | Background colour, or none. Default none. |
| `--layer-color <layer=color>` | Colour of one layer, for example sun=#FEBD11 (repeatable). |
| `--title <text>` | Accessible title. Default the English name; "" marks the image decorative. |
| `--param <name=value>` | Shape parameter, for example rays=9 (repeatable; see deq info). |
| `--current-color <color>` | What currentColor means in PDF and image formats. Default black. |
| `--matte <color>` | JPG background behind transparent pixels. Default white. |
| `--quality <0-100>` | JPG and WebP quality. Default 90. |
| `--force` | Overwrite existing files. |

## deq export

Export shapes in several formats and sizes.

```text
deq export [<shape...>] [options]
```

| Argument | What it is |
| --- | --- |
| `[<shape...>]` | Shape ids; or use --all. |

| Option | What it does |
| --- | --- |
| `--all` | Export every shape in the catalog. |
| `--format <list>` | Comma-separated formats. Default svg. Values: svg, svg-layered, svg-sprite, html, jsx, tsx, vue, svelte, data-uri, css-background, css-mask, pdf, ai, eps, png, jpg, webp, avif, ico, favicon, psd, figma, spec-json. |
| `--sizes <list>` | Comma-separated sizes in px. Default 24. |
| `--out <dir>` | Output directory; files go to <dir>/<format>/<size>/. Default the current directory. |
| `--color <color>` | Stroke and dot colour (any CSS colour). Default currentColor. |
| `--stroke-width <n>` | Stroke width in grid units, 0.05 to 12. Default 2. |
| `--absolute-stroke-width` | Keep the stroke the same width in px at any size. |
| `--fill <color>` | Fill for closed outlines, or none. Default none. |
| `--fill-opacity <0-1>` | Opacity of the fill. Default 1. |
| `--stroke-opacity <0-1>` | Opacity of strokes and dots. Default 1. |
| `--linecap <linecap>` | Line ends. Default round. Values: round, butt, square. |
| `--linejoin <linejoin>` | Line corners. Default round. Values: round, miter, bevel. |
| `--dot-scale <n>` | Multiply every dot radius, 0.1 to 4. Default 1. |
| `--rotation <deg>` | Rotate clockwise about the centre. Default 0. |
| `--flip-x` | Mirror left to right. |
| `--flip-y` | Mirror top to bottom. |
| `--padding <n>` | Space around the 24 x 24 canvas in grid units, 0 to 24. Default 0. |
| `--background <color>` | Background colour, or none. Default none. |
| `--layer-color <layer=color>` | Colour of one layer, for example sun=#FEBD11 (repeatable). |
| `--title <text>` | Accessible title. Default the English name; "" marks the image decorative. |
| `--param <name=value>` | Shape parameter, for example rays=9 (repeatable; see deq info). |
| `--current-color <color>` | What currentColor means in PDF and image formats. Default black. |
| `--matte <color>` | JPG background behind transparent pixels. Default white. |
| `--quality <0-100>` | JPG and WebP quality. Default 90. |
| `--force` | Overwrite existing files. |

## deq flag

Draw the flag of Kurdistan.

```text
deq flag [options]
```

| Option | What it does |
| --- | --- |
| `--variant <variant>` | Flag variant. Default full-color. Values: full-color, mono-black, mono-white, outline, high-contrast, square. |
| `--width <px>` | Width in px, 1 to 8192; the height follows. Default 900. |
| `--format <format>` | Output format. Default svg. Values: svg, png, jpg, webp. |
| `--title <text>` | Accessible title. Default "Flag of Kurdistan". |
| `--current-color <color>` | What currentColor means in image formats. Default black. |
| `--matte <color>` | JPG background behind transparent pixels. Default white. |
| `--quality <0-100>` | JPG and WebP quality. Default 90. |
| `--out <path>` | Output file or directory; - writes to stdout. Default: the current directory. |
| `--force` | Overwrite existing files. |

## deq leet

Write text with Deq glyphs (Deq Leet), or read it back with --decode.

```text
deq leet [<text>] [options]
```

| Argument | What it is |
| --- | --- |
| `[<text>]` | Latin, Kurmanji or Sorani text, at most 1024 characters. |

| Option | What it does |
| --- | --- |
| `--decode <file>` | Print the text of a Deq Leet SVG written at the basic level; pass the render flags used to write it. |
| `--level <level>` | basic is readable and decodable, advanced mixes in seeded alternatives, full uses motifs. Default basic. Values: basic, advanced, full. |
| `--script <script>` | Glyph table. Default sorani for Arabic-script text, else latin. Values: latin, sorani. |
| `--seed <n>` | Seed for the advanced level, 0 to 4294967295. Default 1. |
| `--letter-spacing <n>` | Space between glyphs in grid units, 0 to 24. Default 2. |
| `--line-spacing <n>` | Space between lines in grid units, 0 to 48. Default 6. |
| `--align <align>` | Line alignment; start is the right edge for Sorani. Default start. Values: start, center, end. |
| `--format <format>` | Output format. Default svg. Values: svg, png, jpg, webp. |
| `--size <px>` | Size in px of one 24 x 24 cell, 1 to 8192. Default 24. |
| `--colors <list>` | Comma-separated colours given to the glyphs in turn (1 to 16). |
| `--title <text>` | Accessible title. Default the normalised text; "" marks the image decorative. |
| `--out <path>` | Output file or directory; - writes to stdout. Default: the current directory. |
| `--color <color>` | Stroke and dot colour (any CSS colour). Default currentColor. |
| `--stroke-width <n>` | Stroke width in grid units, 0.05 to 12. Default 2. |
| `--absolute-stroke-width` | Keep the stroke the same width in px at any size. |
| `--fill <color>` | Fill for closed outlines, or none. Default none. |
| `--fill-opacity <0-1>` | Opacity of the fill. Default 1. |
| `--stroke-opacity <0-1>` | Opacity of strokes and dots. Default 1. |
| `--linecap <linecap>` | Line ends. Default round. Values: round, butt, square. |
| `--linejoin <linejoin>` | Line corners. Default round. Values: round, miter, bevel. |
| `--dot-scale <n>` | Multiply every dot radius, 0.1 to 4. Default 1. |
| `--padding <n>` | Space around the 24 x 24 canvas in grid units, 0 to 24. Default 0. |
| `--background <color>` | Background colour, or none. Default none. |
| `--current-color <color>` | What currentColor means in PDF and image formats. Default black. |
| `--matte <color>` | JPG background behind transparent pixels. Default white. |
| `--quality <0-100>` | JPG and WebP quality. Default 90. |
| `--force` | Overwrite existing files. |

## deq generate

Generate a seeded pattern of Deq motifs.

```text
deq generate [options]
```

| Option | What it does |
| --- | --- |
| `--kind <kind>` | Pattern kind. Default band. Values: band, grid, rosette, border. |
| `--seed <n>` | Seed, 0 to 4294967295; the same seed gives the same pattern. Default 1. |
| `--motifs <list>` | Comma-separated shape ids to choose from (1 to 64). Default every shape. |
| `--count <n>` | Band length, odd, 3 to 63. Default 9. |
| `--cols <n>` | Grid or border columns, 1 to 32 (border at least 3). Default 5 (grid), 7 (border). |
| `--rows <n>` | Grid or border rows, 1 to 32 (border at least 3). Default 5 (grid), 3 (border). |
| `--petals <n>` | Rosette petals, 3 to 24. Default 8. |
| `--spacing <n>` | Space between cells in grid units, 0 to 24. Default 2. |
| `--format <format>` | Output format. Default svg. Values: svg, png, jpg, webp. |
| `--size <px>` | Size in px of one 24 x 24 cell, 1 to 8192. Default 24. |
| `--colors <list>` | Comma-separated colours given to the glyphs in turn (1 to 16). |
| `--title <text>` | Accessible title. Default "Deq <kind> pattern"; "" marks the image decorative. |
| `--out <path>` | Output file or directory; - writes to stdout. Default: the current directory. |
| `--color <color>` | Stroke and dot colour (any CSS colour). Default currentColor. |
| `--stroke-width <n>` | Stroke width in grid units, 0.05 to 12. Default 2. |
| `--absolute-stroke-width` | Keep the stroke the same width in px at any size. |
| `--fill <color>` | Fill for closed outlines, or none. Default none. |
| `--fill-opacity <0-1>` | Opacity of the fill. Default 1. |
| `--stroke-opacity <0-1>` | Opacity of strokes and dots. Default 1. |
| `--linecap <linecap>` | Line ends. Default round. Values: round, butt, square. |
| `--linejoin <linejoin>` | Line corners. Default round. Values: round, miter, bevel. |
| `--dot-scale <n>` | Multiply every dot radius, 0.1 to 4. Default 1. |
| `--padding <n>` | Space around the 24 x 24 canvas in grid units, 0 to 24. Default 0. |
| `--background <color>` | Background colour, or none. Default none. |
| `--current-color <color>` | What currentColor means in PDF and image formats. Default black. |
| `--matte <color>` | JPG background behind transparent pixels. Default white. |
| `--quality <0-100>` | JPG and WebP quality. Default 90. |
| `--force` | Overwrite existing files. |

## deq validate

Check a shape spec file and render every parameter variant.

```text
deq validate <file> [options]
```

| Argument | What it is |
| --- | --- |
| `<file>` | Shape spec JSON file. |

## deq completion

Print a shell completion script.

```text
deq completion <shell> [options]
```

| Argument | What it is |
| --- | --- |
| `<shell>` | bash, zsh, fish or powershell. |

## Formats

The Node.js tool writes every format: `svg`, `svg-layered`, `svg-sprite`, `html`, `jsx`, `tsx`, `vue`, `svelte`, `data-uri`, `css-background`, `css-mask`, `pdf`, `ai`, `eps`, `png`, `jpg`, `webp`, `avif`, `ico`, `favicon`, `psd`, `figma`, `spec-json`.

The Python and Rust tools write `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp`, `ico` and exit with code 4 for the others.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | a shape, option or spec file is invalid |
| 2 | the command line is wrong |
| 3 | a file could not be read or written (or exists without --force) |
| 4 | the format is only available in the Node CLI |
