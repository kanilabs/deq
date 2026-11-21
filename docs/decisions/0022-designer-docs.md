# 22. Designer docs and tool guides

- Status: accepted
- Date: 2026-11-20

## Context

Phase 11c documents Deq for designers: the grid and keylines, the stroke and dot rules, optical corrections, how each shape is constructed, spacing, colour and accessibility, and how to use the shapes in common design tools. Every shape file in `spec/shapes/` already records its construction steps, primitives and metrics (ADR 0007), so a per-shape page written by hand would duplicate the spec and drift from it. Most of the design tools are commercial and cannot be tested in CI.

## Decision

- **Construction on the icon pages.** Each `/icons/<id>/` page gets a Construction section built at build time by `apps/site/src/lib/construction.ts` from the shape's spec file: the 24-unit grid with keylines and markers at circle, dot, arc, star and generator centres under the shape (`gridSvg`, every value escaped), the `construction` steps, a table of the top-level primitives with their values and `when` conditions, and the metrics `deq-spec fmt` writes. Labels are `icon.construction.*` and `icon.metrics.*`. Nothing is copied into Markdown, so the section always matches the spec. `test/construction.test.ts` covers it.
- **Designer pages.** `docs/designer/` has six pages: grid and keylines, strokes and dots, optical corrections, reading a construction, spacing and composition, colour and accessibility. Every number comes from `spec/grid.json`, the shape files or the renderer.
- **Tool guides.** `docs/tools/` has one page each for Inkscape, Illustrator, Photoshop, Figma, Affinity, Sketch, Canva and Blender, covering import, keeping layers, recolouring, changing the stroke and compositions. The Inkscape guide was tested with Inkscape 1.4.3; the others start with "based on vendor docs, not tested here" and cite the vendor pages they rely on. Where vendor docs say nothing (Canva stroke width, Sketch borders on imported SVG), the guide says so and points to re-exporting from the Studio instead of guessing. Format names are the ids the Studio and CLI show (`svg-layered`, `figma`, `psd`, `ai`, `pdf`).
- **Languages.** Designer and tool pages are in English, with ckb and kmr drafts carrying the draft notice, like the user guides (ADR 0020). Tool-guide drafts keep menu names in English, because the tools' interfaces are not localized into Kurdish.
- **Navigation.** `PUBLISHED` adds `{designer,tools}/**` and `{ckb,kmr}/{designer,tools}/**`, the sidebar gets "Designers" and "Design tools" groups (`nav.docs.designer`, `nav.docs.tools`), `llms.txt` lists both after the user guides, and the README and the three docs indexes link every page.

## Consequences

- A change to a shape's construction, primitives or metrics shows up on its icon page without editing docs.
- Vendor interfaces change. Tool guides cite their sources so a reader can check them, and fixes come through the issue tracker. A guide moves to "tested" only after someone runs through it.
- New designer or tool pages need ckb and kmr files with the same name and `sidebar.order`; `test/docs.test.ts` fails otherwise.
