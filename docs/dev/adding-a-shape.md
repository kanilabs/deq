---
title: Adding a shape
description: Draw a new shape from a reference image, check it and carry it through every package, port and font.
sidebar:
  order: 7
---

A new shape starts from a reference image and ends in every renderer, package, font and page. Read the [shape spec guide](../design/shape-spec.md) first for the format, and the [spec page](spec.md) for what the lint checks.

## 1. Find the reference

Draw from an image listed in `assets/source-manifest.json`, never from a name alone. The image's `motifs` list says which designs it shows. Use one shape per design: split an image that shows several designs, and only merge references that show exactly the same design.

## 2. Write the shape file

Create `spec/shapes/<id>.json`. The id is kebab-case and never changes.

- Build from the grid modules in `spec/grid.json`: circles of radius 5, 3 and 2, dots of radius 1 and 2, the small and large V, the 45-degree pitch of 4.5 and teeth 3 long at pitch 3.
- Keep stroke centre lines between 2 and 22, and at least 3 units between parallel lines. For lines at an angle, measure square to the line.
- Use the generators (`repeat`, `radial`, `concentric`) instead of copied geometry, and `use` to build on another shape at full size.
- Give every part its own layer, and every top-level primitive an `id`.
- Write the maths in `construction`: the radii, angles and intersections, and why each number was chosen.
- Cite every name and meaning with a source id from `content/sources.json`. If no source gives a meaning, write `{ "status": "unknown" }`. Sorani and Kurmanji names stay `needs-native-review`.

## 3. Check it

```sh
uv run deq-spec fmt                            # canonical layout and metrics
uv run deq-spec sheet --set shapes --force     # contact sheet
uv run deq-spec lint                           # must pass
```

Open `docs/design/shapes-contact-sheet.svg` (or render it to PNG with Inkscape) and look at the new shape, especially at small sizes. Then list the id in its category in `spec/catalog.json`.

## 4. Generate everything else

```sh
pnpm --filter @0xdolan/deq-core generate       # core data and the ports' shapes.json
pnpm --filter @0xdolan/deq-core fixtures       # golden SVGs in spec/fixtures/
pnpm --filter @0xdolan/deq-icons generate
pnpm --filter @0xdolan/deq-react generate      # also vue and svelte
pnpm --filter @0xdolan/deq-icons font-data fonts/build/geometry.json
uv run deq-fonts codepoints                    # assigns the shape's font code point
just fonts                                     # builds the fonts into fonts/dist/
```

Review the new files in `spec/fixtures/`. The Python and Rust ports read the generated `shapes.json`, so they pick up the shape without code changes; their parity tests compare them with the new fixtures. Commit `fonts/codepoints.json` and `docs/fonts/codepoints.md` with the shape. A code point is never changed or reused.

The [codegen pipeline](codegen.md) explains each step.

## 5. Finish

- Run `just ci`. Every stale generated file fails a test.
- Add the shape to the `[Unreleased]` section of `CHANGELOG.md`.
- The website picks the shape up on the next build: its icon page, the Studio library and search.

Changing an existing shape follows the same steps. Increase its `version` when the geometry changes.
