---
title: Spec and schemas
description: The files in spec/, the JSON Schema that checks each one and the extra rules deq-spec lint adds.
sidebar:
  order: 6
---

`spec/` is the single source of truth for shapes ([ADR 0007](../decisions/0007-shape-spec-format.md)). Every renderer, package, font and page is built from it. The full format of a shape file, with every primitive and parameter type, is in the [shape spec guide](../design/shape-spec.md).

## Files

| File                              | What it holds                                                                                        | Schema                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| `grid.json`                       | The 24 × 24 grid, the live area, default stroke and dot sizes, and the modules shapes are built from | `schema/grid.schema.json`    |
| `shapes/<id>.json`                | One shape: names, cited meaning, layers, primitives, parameters, construction notes and metrics      | `schema/shape.schema.json`   |
| `catalog.json`                    | Categories, the display order of shapes, and motifs deferred until there is a reference image        | `schema/catalog.schema.json` |
| `flag.json`                       | The geometry and colours of the flag of Kurdistan                                                    | `schema/flag.schema.json`    |
| `reference/Flag_of_Kurdistan.svg` | The Wikimedia Commons SVG the flag is checked against, pinned by its SHA-256 in `flag.json`          |                              |
| `leet/{latin,sorani}.json`        | The Deq Leet tables: characters mapped to glyphs made of catalog shapes                              | `schema/leet.schema.json`    |
| `cli.json`                        | The interface every `deq` CLI shares: commands, flags, formats and exit codes                        | checked by the CLI generator |
| `fixtures/`                       | Golden output that every renderer must match byte for byte (generated; see [codegen](codegen.md))    |                              |

The schemas use JSON Schema 2020-12 and reject unknown keys. Editors that understand `$schema` validate shape files as you type.

## What the lint adds

A schema can only check the structure. `uv run deq-spec lint` also checks:

- the drawn shape stays inside the live area at every tested parameter combination, and numbers have at most three decimals;
- circle and dot radii come from the grid modules;
- every declared layer is used, and every top-level primitive has a layer;
- the declared `symmetry` holds at the defaults;
- every cited source id exists in `content/sources.json`, every image id in `assets/source-manifest.json`, and `sources` lists exactly the ids that are cited;
- `use` references point to catalog shapes, and the catalog lists every shape file;
- `metrics`, the contact sheets, the brand SVGs and `docs/api/python.md` are up to date;
- the flag matches the pinned reference SVG, including its colours and contrast ratios;
- the Leet tables only use existing shapes, keep their ink inside the 24 × 24 canvas and give every character its own basic glyph.

It runs in `just test` and in CI. `uv run deq-spec fmt` rewrites the files in their canonical layout and recomputes `metrics`.

## Changing the spec

- Ids never change. Increase a shape's `version` when its geometry changes.
- Never write a meaning or a Kurdish name without a citation. Kurdish names stay `needs-native-review` until a native speaker has checked them.
- Never edit `reference/` or a flag value without checking it against the reference.

[Adding a shape](adding-a-shape.md) walks through the whole process.
