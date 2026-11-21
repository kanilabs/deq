# 21. API references

- Status: accepted
- Date: 2026-11-19

## Context

Phase 11b documents Deq for developers: every package's public API, the Python and Rust ports, and the `deq` commands. ADR 0008 already wrote `docs/api/core.md` with the TypeScript compiler API, because TypeDoc crashes on the minimatch version the workspace enforces. The references must read well on GitHub and on the website (ADR 0020), stay in step with the code, and add no dependencies.

## Decision

- **One TypeScript generator.** `scripts/api-docs.ts` (moved from `packages/core/scripts/`) writes `docs/api/<name>.md` for core, exporters, generator, icons, react, vue, svelte, elements and cli. It reads each package's exports from `src/index.ts` with the compiler API and prints signatures, TSDoc comments and the `@throws` and `@deprecated` tags. The page intro is the package's leading doc comment. The generated per-shape exports of the icon packages are summarised, not listed one by one. Each package has an `api-docs.test.ts` that regenerates its page in memory and fails when the committed file differs.
- **Python from the syntax tree.** `deq-spec api-docs` (`scripts/deq-spec/src/deq_spec/apidocs.py`) writes `docs/api/python.md` from `deq_shapes`'s `__all__`, parsed with the standard `ast` module, so nothing is imported and no documentation tool is needed. Docstrings are reStructuredText-lite: inline literals, roles, `:raises:` and doctests are turned into Markdown. `deq-spec lint` reports the page when it is stale.
- **Rust through rustdoc.** The workspace denies `missing_docs`, and `just lint` and the CI lint job run `cargo doc --workspace --no-deps --locked` with `RUSTDOCFLAGS=-D warnings`. The full reference is rustdoc, on docs.rs once the crates are published. `docs/api/rust.md` is a hand-written overview with an example and a table of the exports.
- **Commands from the interface.** `packages/cli/scripts/generate.ts` also writes `docs/api/commands.md` from `spec/cli.json`: every command with its usage, arguments and options, the formats and the exit codes. Like the help texts, it is checked fresh by the CLI tests.
- **Published on the site.** `PUBLISHED` adds `api/**/*.md`, the sidebar gets an "API reference" group, and `llms.txt` lists the guides, then the developer pages, then the references. The references are English only, like the developer pages.
- **Developer guides.** `docs/dev/` adds architecture, codegen, spec, adding a shape, writing an exporter, fonts, testing, releasing and security.
- `just api-docs` builds the packages and regenerates all the TypeScript and Python references.

## Consequences

- Public exports need doc comments; an undocumented export shows up as a bare signature in review. A Rust item without docs fails the lint.
- Changing an export, a docstring or `spec/cli.json` means running `just api-docs` or the CLI generator and committing the result; the tests name the command.
- Doc comments are public documentation: they must not cite the private PRD.
- TypeDoc, Sphinx and similar tools can be reconsidered when they no longer conflict with the pinned dependencies, but nothing depends on them.
