---
title: "deq-shapes (Rust)"
description: The Rust port of the Deq renderer and where to read its rustdoc reference.
sidebar:
  order: 11
---

The Rust crate [`deq-shapes`](../../rust/deq-shapes/) is a port of `@0xdolan/deq-core`. Its SVG and PDF output matches the reference renderer byte for byte ([ADR 0008](../decisions/0008-core-renderer-and-golden-fixtures.md), [ADR 0011](../decisions/0011-ports-and-clis.md)). The `deq` binary is in the [`deq-cli`](../../rust/deq-cli/) crate.

```toml
[dependencies]
deq-shapes = "1.0.0"
```

```rust
use serde_json::json;

fn main() -> deq_shapes::Result<()> {
    let svg = deq_shapes::render("roj-half-sun", &json!({ "size": 48, "color": "#d4a017" }))?;
    println!("{svg}");
    Ok(())
}
```

## Reference

The reference is written as rustdoc comments in the source. Every public item must have one: the workspace denies `missing_docs`, and CI builds the docs with `RUSTDOCFLAGS="-D warnings"`, so a broken intra-doc link also fails.

- Online: [docs.rs/deq-shapes](https://docs.rs/deq-shapes) and [docs.rs/deq-cli](https://docs.rs/deq-cli), available once the crates are published.
- Locally, from the repository root:

  ```sh
  cargo doc --workspace --no-deps --open
  ```

## What the crate exports

The crate root re-exports the names most programs need. The modules hold the rest.

| Item                                                                                   | What it does                                                                                 |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `render`, `compose`, `render_flag`                                                     | Render a shape, a composition of shapes or the Kurdish flag as SVG                           |
| `get_shape`, `has_shape`, `list_shapes`, `list_categories`                             | Read the shape catalog                                                                       |
| `leet`, `decode_leet`, `detect_script`, `leet_table`                                   | Write text in Deq Leet and read it back                                                      |
| `pattern`, `Random`                                                                    | Seeded patterns from motifs, with the same random stream as the TypeScript generator         |
| `Scene`, `Cell`, `scene_svg`                                                           | Glyphs placed on a canvas, written as one SVG                                                |
| `DeqError`, `ErrorCode`, `Result`                                                      | Errors with core's codes (`UNKNOWN_SHAPE`, `INVALID_OPTIONS`, …) and messages                |
| `export::export_shapes`                                                                | Files in `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp` and `ico`           |
| `validate::validate_spec`                                                              | Check a shape spec and render every parameter variant                                        |

Options are JSON values (`serde_json::Value`) with core's option names, so the [core reference](core.md) describes them too.
