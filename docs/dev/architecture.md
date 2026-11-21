---
title: Architecture
description: How the shape spec, the renderers, the packages, the ports and the website fit together.
sidebar:
  order: 4
---

Deq has one source of truth, the shape spec in `spec/`. Everything else is built from it, and tests check that every generated file is up to date.

```text
spec/ (shapes, grid, flag, Leet tables, CLI interface)
  │
  ├─ scripts/deq-spec ── lint, metrics, contact sheets, brand SVGs
  │
  └─ packages/core ───── reference renderer, golden fixtures in spec/fixtures/
       │
       ├─ packages/icons ── react, vue, svelte, elements
       ├─ packages/exporters (23 formats)
       ├─ packages/generator (Deq Leet, patterns)
       ├─ packages/cli (deq for Node.js)
       ├─ scripts/deq-fonts (icon and Leet fonts)
       ├─ python/deq-shapes, rust/deq-shapes, rust/deq-cli (ports, matched against the fixtures)
       └─ apps/site (website and Studio)
```

## The parts

| Folder                                                 | What it holds                                                                                                    | Decision                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `spec/`                                                | One JSON file per shape, the grid, the flag, the catalog, the Leet tables, `cli.json`, JSON Schemas and fixtures | [ADR 0007](../decisions/0007-shape-spec-format.md)                                                       |
| `scripts/deq-spec`                                     | The Python tool that lints and formats the spec and draws the contact sheets                                     | [ADR 0007](../decisions/0007-shape-spec-format.md)                                                       |
| `packages/core`                                        | The reference renderer: option validation, expansion, SVG; writes the golden fixtures                            | [ADR 0008](../decisions/0008-core-renderer-and-golden-fixtures.md)                                       |
| `packages/exporters`                                   | PDF, EPS, AI, PSD, rasters, components and more, built on core's `prepare`                                       | [ADR 0009](../decisions/0009-exporters.md)                                                               |
| `packages/icons`, `react`, `vue`, `svelte`, `elements` | Icon data and generated components; default output equals core's `render`                                        | [ADR 0010](../decisions/0010-icon-packages-and-fonts.md)                                                 |
| `scripts/deq-fonts`                                    | Static, variable and colour icon fonts, and the Deq Leet font                                                    | [ADR 0010](../decisions/0010-icon-packages-and-fonts.md), [ADR 0016](../decisions/0016-deq-leet-font.md) |
| `python/deq-shapes`, `rust/`                           | Ports of core and the generator, and the `deq` CLI in each language                                              | [ADR 0011](../decisions/0011-ports-and-clis.md)                                                          |
| `packages/generator`                                   | Deq Leet, decoding and seeded patterns                                                                           | [ADR 0015](../decisions/0015-deq-leet-and-pattern-generator.md)                                          |
| `apps/site`                                            | The Astro and Starlight website, the Studio, the story, the showcase and these docs                              | [ADR 0012](../decisions/0012-website-foundation.md), [ADR 0014](../decisions/0014-studio.md)             |

## Rules that hold everywhere

- **Core is the reference.** Python and Rust re-implement it and must write the same SVG and PDF byte for byte. A change to rendering lands in all three in the same pull request.
- **Generated files are never edited.** They carry a "generated, do not edit" header, and a test or lint fails when one is stale. The [codegen pipeline](codegen.md) lists them.
- **Every outside input is validated** against a schema before use, and errors are typed `DeqError`s with stable codes. See [security](security.md).
- **One version** is shared by every package, crate, font and asset.

The tooling is split by language: pnpm workspaces and Turborepo for TypeScript, a uv workspace for Python, a Cargo workspace for Rust, and `just` recipes that run all three ([ADR 0002](../decisions/0002-monorepo-and-toolchains.md)).
