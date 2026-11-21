//! Raster output: SVG rendered with resvg and encoded to PNG, JPG and WebP, plus ICO packing.
//!
//! WebP output is lossless (the pure-Rust encoder has no lossy mode), so `quality` only affects
//! JPG here (ADR 0011).

use crate::color::Rgba;
use crate::error::{DeqError, ErrorCode, Result};
use crate::format::{js_str, round_half_even};
use resvg::{tiny_skia, usvg};

/// A raster format the port encodes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RasterFormat {
    /// PNG (lossless, with transparency).
    Png,
    /// JPEG, composited on a matte colour.
    Jpg,
    /// WebP (lossless, with transparency).
    Webp,
}

/// Largest width or height of a raster export, in pixels.
pub const MAX_RASTER: u32 = 8192;

/// Sizes in `.ico` files.
pub const ICO_SIZES: [u32; 3] = [16, 32, 48];

/// Check that `width` is a whole number of pixels from 1 to 8192.
///
/// # Errors
/// `InvalidOptions` otherwise.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub fn check_width(width: f64) -> Result<u32> {
    if width.fract() != 0.0 || !(1.0..=f64::from(MAX_RASTER)).contains(&width) {
        let issue = format!(
            "size: raster width must be an integer from 1 to {MAX_RASTER} px (got {})",
            js_str(&crate::format::number_value(width))
        );
        return Err(DeqError::options("invalid export options", vec![issue]));
    }
    Ok(width as u32)
}

fn render_error(what: &str, e: impl std::fmt::Display) -> DeqError {
    DeqError::new(ErrorCode::InvalidOptions, format!("could not {what}: {e}"))
}

fn rasterize(svg: &str, width: u32) -> Result<tiny_skia::Pixmap> {
    let tree = usvg::Tree::from_str(svg, &usvg::Options::default())
        .map_err(|e| render_error("parse the SVG", e))?;
    let size = tree
        .size()
        .to_int_size()
        .scale_to_width(width)
        .ok_or_else(|| render_error("size the image", "empty size"))?;
    let mut pixmap = tiny_skia::Pixmap::new(size.width(), size.height())
        .ok_or_else(|| render_error("allocate the image", "empty size"))?;
    #[allow(clippy::cast_precision_loss)]
    let transform = tiny_skia::Transform::from_scale(
        size.width() as f32 / tree.size().width(),
        size.height() as f32 / tree.size().height(),
    );
    resvg::render(&tree, transform, &mut pixmap.as_mut());
    Ok(pixmap)
}

/// Render an SVG at `width` pixels (the height follows the aspect ratio) as PNG.
///
/// # Errors
/// `InvalidOptions` for a bad width or an SVG that cannot be rendered.
pub fn render_png(svg: &str, width: f64) -> Result<Vec<u8>> {
    let pixmap = rasterize(svg, check_width(width)?)?;
    pixmap
        .encode_png()
        .map_err(|e| render_error("encode PNG", e))
}

/// Straight (not premultiplied) RGBA8 pixels.
fn rgba8(pixmap: &tiny_skia::Pixmap) -> Vec<u8> {
    pixmap
        .pixels()
        .iter()
        .flat_map(|p| {
            let c = p.demultiply();
            [c.red(), c.green(), c.blue(), c.alpha()]
        })
        .collect()
}

/// Render an SVG and encode it. JPG has no transparency, so it is composited on `matte`.
///
/// # Errors
/// As [`render_png`], plus encoder failures.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub fn encode_svg(
    svg: &str,
    width: f64,
    fmt: RasterFormat,
    quality: Option<u8>,
    matte: Rgba,
) -> Result<Vec<u8>> {
    if fmt == RasterFormat::Png {
        return render_png(svg, width);
    }
    let w = check_width(width)?;
    let mut pixmap = rasterize(svg, w)?;
    let mut out = Vec::new();
    if fmt == RasterFormat::Jpg {
        let byte = |c: f64| round_half_even(c * 255.0).clamp(0.0, 255.0) as u8;
        let mut base = tiny_skia::Pixmap::new(pixmap.width(), pixmap.height())
            .ok_or_else(|| render_error("allocate the image", "empty size"))?;
        base.fill(tiny_skia::Color::from_rgba8(
            byte(matte.0),
            byte(matte.1),
            byte(matte.2),
            255,
        ));
        base.draw_pixmap(
            0,
            0,
            pixmap.as_ref(),
            &tiny_skia::PixmapPaint::default(),
            tiny_skia::Transform::identity(),
            None,
        );
        pixmap = base;
        let rgb: Vec<u8> = pixmap
            .pixels()
            .iter()
            .flat_map(|p| [p.red(), p.green(), p.blue()])
            .collect();
        let (pw, ph) = (
            u16::try_from(pixmap.width()),
            u16::try_from(pixmap.height()),
        );
        let (Ok(pw), Ok(ph)) = (pw, ph) else {
            return Err(render_error("encode JPG", "image too large"));
        };
        jpeg_encoder::Encoder::new(&mut out, quality.unwrap_or(90))
            .encode(&rgb, pw, ph, jpeg_encoder::ColorType::Rgb)
            .map_err(|e| render_error("encode JPG", e))?;
    } else {
        image_webp::WebPEncoder::new(&mut out)
            .encode(
                &rgba8(&pixmap),
                pixmap.width(),
                pixmap.height(),
                image_webp::ColorType::Rgba8,
            )
            .map_err(|e| render_error("encode WebP", e))?;
    }
    Ok(out)
}

/// Pack PNG images `(size, bytes)` into one ICO file.
#[must_use]
#[allow(clippy::cast_possible_truncation)]
pub fn pack_ico(images: &[(u32, Vec<u8>)]) -> Vec<u8> {
    let count = images.len() as u16;
    let mut out = Vec::new();
    for v in [0u16, 1, count] {
        out.extend_from_slice(&v.to_le_bytes());
    }
    let mut offset = 6 + 16 * images.len() as u32;
    for (size, png) in images {
        let side = if *size >= 256 { 0 } else { *size as u8 };
        out.extend_from_slice(&[side, side, 0, 0]);
        out.extend_from_slice(&1u16.to_le_bytes());
        out.extend_from_slice(&32u16.to_le_bytes());
        out.extend_from_slice(&(png.len() as u32).to_le_bytes());
        out.extend_from_slice(&offset.to_le_bytes());
        offset += png.len() as u32;
    }
    for (_, png) in images {
        out.extend_from_slice(png);
    }
    out
}

/// Render an SVG at several square sizes into one ICO file.
///
/// # Errors
/// As [`render_png`].
pub fn to_ico(svg: &str, sizes: &[u32]) -> Result<Vec<u8>> {
    let images = sizes
        .iter()
        .map(|s| Ok((*s, render_png(svg, f64::from(*s))?)))
        .collect::<Result<Vec<_>>>()?;
    Ok(pack_ico(&images))
}
