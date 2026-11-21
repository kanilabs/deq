# deq-shapes

<img src="https://kanilabs.github.io/deq/brand/banner.png" width="640" height="160" alt="Deq · دەق: the Dot rosette logo, traditional Kurdish tattoo shapes as an open, parametric design system.">

Rust renderer for [Deq](https://github.com/kanilabs/deq) shapes: traditional Kurdish tattoo (deq) motifs drawn on a 24 × 24 grid. Its SVG and PDF output is byte for byte the output of `@0xdolan/deq-core`, checked against the shared golden fixtures ([ADR 0008](https://github.com/kanilabs/deq/blob/main/docs/decisions/0008-core-renderer-and-golden-fixtures.md), [ADR 0011](https://github.com/kanilabs/deq/blob/main/docs/decisions/0011-ports-and-clis.md)).

```toml
[dependencies]
deq-shapes = "1.0.0-rc.1"
```

```rust
use serde_json::json;

fn main() -> deq_shapes::Result<()> {
    let svg = deq_shapes::render("roj-half-sun", &json!({ "size": 48, "color": "#d4a017" }))?;
    let flag = deq_shapes::render_flag(&json!({ "variant": "full-color", "width": 900 }))?;
    let files = deq_shapes::export::export_shapes("png", &[json!("kurdish-sun")], &json!({ "render": { "size": 512 } }))?;
    println!("{svg}\n{flag}\n{} file(s)", files.len());
    Ok(())
}
```

- `render`, `compose`, `render_flag`, `get_shape`, `list_shapes`, `list_categories` and `has_shape` mirror core; options are JSON objects with core's option names.
- `export::export_shapes` writes `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp` and `ico` (WebP is lossless).
- `validate::validate_spec` checks a shape spec and renders every parameter variant.
- Errors are `DeqError` with core's codes (`UNKNOWN_SHAPE`, `INVALID_OPTIONS`, …) and messages. No `unsafe`, no panics.

The `deq` binary is in the [`deq-cli`](https://crates.io/crates/deq-cli) crate.

License: GPL-3.0-or-later.
