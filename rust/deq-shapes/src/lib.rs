//! `deq-shapes`: traditional Kurdish tattoo (deq) motifs as parametric shapes.
//!
//! A port of the TypeScript reference renderer: SVG and PDF output match it byte for byte
//! (ADR 0008, ADR 0011).

// The renderer mirrors the TypeScript reference: exact float comparisons follow its `===`
// semantics, and short maths names (x, y, c, s) follow the formulas.
#![allow(
    clippy::float_cmp,
    clippy::many_single_char_names,
    clippy::format_push_string,
    clippy::format_collect
)]

pub mod color;
mod data;
pub mod drawing;
pub mod error;
pub mod expand;
pub mod export;
pub mod flag;
pub mod format;
pub mod geometry;
mod json;
pub mod options;
mod pattern;
pub mod pdf;
pub mod raster;
pub mod registry;
pub mod svg;
pub mod validate;

pub use error::{DeqError, ErrorCode, Result};
pub use flag::render_flag;
pub use registry::{get_shape, has_shape, list_categories, list_shapes};
pub use svg::{compose, render};

/// The crate name as published on crates.io.
pub const CRATE_NAME: &str = env!("CARGO_PKG_NAME");

/// The crate version (shared, unified Deq version).
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crate_name_matches() {
        assert_eq!(CRATE_NAME, "deq-shapes");
    }

    #[test]
    fn version_is_semver() {
        let parts: Vec<&str> = VERSION.split('.').collect();
        assert_eq!(parts.len(), 3);
        assert!(parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())));
    }
}
