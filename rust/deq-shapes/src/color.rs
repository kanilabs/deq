//! CSS colour parsing for formats that need numbers (PDF, JPG matte, concrete raster SVG).
//!
//! Accepts everything option validation accepts: hex, named colours, `transparent`,
//! `currentColor`, and rgb/hsl/hwb/lab/lch/oklab/oklch with plain numeric arguments.

use crate::error::{DeqError, Result};
use crate::format::{js_mod, js_round, json_string, take_chars};
use crate::pattern::compile;
use regex::Regex;
use std::f64::consts::PI;
use std::sync::LazyLock;

/// Red, green, blue and alpha, each 0 to 1 (sRGB, not premultiplied).
pub type Rgba = (f64, f64, f64, f64);

/// Opaque black, the default for `currentColor` outside a browser.
pub const BLACK: Rgba = (0.0, 0.0, 0.0, 1.0);

/// The 148 CSS named colours (CSS Color 4) as 6-digit lower-case hex without `#`.
pub const NAMED_COLORS: [(&str, &str); 148] = [
    ("aliceblue", "f0f8ff"),
    ("antiquewhite", "faebd7"),
    ("aqua", "00ffff"),
    ("aquamarine", "7fffd4"),
    ("azure", "f0ffff"),
    ("beige", "f5f5dc"),
    ("bisque", "ffe4c4"),
    ("black", "000000"),
    ("blanchedalmond", "ffebcd"),
    ("blue", "0000ff"),
    ("blueviolet", "8a2be2"),
    ("brown", "a52a2a"),
    ("burlywood", "deb887"),
    ("cadetblue", "5f9ea0"),
    ("chartreuse", "7fff00"),
    ("chocolate", "d2691e"),
    ("coral", "ff7f50"),
    ("cornflowerblue", "6495ed"),
    ("cornsilk", "fff8dc"),
    ("crimson", "dc143c"),
    ("cyan", "00ffff"),
    ("darkblue", "00008b"),
    ("darkcyan", "008b8b"),
    ("darkgoldenrod", "b8860b"),
    ("darkgray", "a9a9a9"),
    ("darkgreen", "006400"),
    ("darkgrey", "a9a9a9"),
    ("darkkhaki", "bdb76b"),
    ("darkmagenta", "8b008b"),
    ("darkolivegreen", "556b2f"),
    ("darkorange", "ff8c00"),
    ("darkorchid", "9932cc"),
    ("darkred", "8b0000"),
    ("darksalmon", "e9967a"),
    ("darkseagreen", "8fbc8f"),
    ("darkslateblue", "483d8b"),
    ("darkslategray", "2f4f4f"),
    ("darkslategrey", "2f4f4f"),
    ("darkturquoise", "00ced1"),
    ("darkviolet", "9400d3"),
    ("deeppink", "ff1493"),
    ("deepskyblue", "00bfff"),
    ("dimgray", "696969"),
    ("dimgrey", "696969"),
    ("dodgerblue", "1e90ff"),
    ("firebrick", "b22222"),
    ("floralwhite", "fffaf0"),
    ("forestgreen", "228b22"),
    ("fuchsia", "ff00ff"),
    ("gainsboro", "dcdcdc"),
    ("ghostwhite", "f8f8ff"),
    ("gold", "ffd700"),
    ("goldenrod", "daa520"),
    ("gray", "808080"),
    ("green", "008000"),
    ("greenyellow", "adff2f"),
    ("grey", "808080"),
    ("honeydew", "f0fff0"),
    ("hotpink", "ff69b4"),
    ("indianred", "cd5c5c"),
    ("indigo", "4b0082"),
    ("ivory", "fffff0"),
    ("khaki", "f0e68c"),
    ("lavender", "e6e6fa"),
    ("lavenderblush", "fff0f5"),
    ("lawngreen", "7cfc00"),
    ("lemonchiffon", "fffacd"),
    ("lightblue", "add8e6"),
    ("lightcoral", "f08080"),
    ("lightcyan", "e0ffff"),
    ("lightgoldenrodyellow", "fafad2"),
    ("lightgray", "d3d3d3"),
    ("lightgreen", "90ee90"),
    ("lightgrey", "d3d3d3"),
    ("lightpink", "ffb6c1"),
    ("lightsalmon", "ffa07a"),
    ("lightseagreen", "20b2aa"),
    ("lightskyblue", "87cefa"),
    ("lightslategray", "778899"),
    ("lightslategrey", "778899"),
    ("lightsteelblue", "b0c4de"),
    ("lightyellow", "ffffe0"),
    ("lime", "00ff00"),
    ("limegreen", "32cd32"),
    ("linen", "faf0e6"),
    ("magenta", "ff00ff"),
    ("maroon", "800000"),
    ("mediumaquamarine", "66cdaa"),
    ("mediumblue", "0000cd"),
    ("mediumorchid", "ba55d3"),
    ("mediumpurple", "9370db"),
    ("mediumseagreen", "3cb371"),
    ("mediumslateblue", "7b68ee"),
    ("mediumspringgreen", "00fa9a"),
    ("mediumturquoise", "48d1cc"),
    ("mediumvioletred", "c71585"),
    ("midnightblue", "191970"),
    ("mintcream", "f5fffa"),
    ("mistyrose", "ffe4e1"),
    ("moccasin", "ffe4b5"),
    ("navajowhite", "ffdead"),
    ("navy", "000080"),
    ("oldlace", "fdf5e6"),
    ("olive", "808000"),
    ("olivedrab", "6b8e23"),
    ("orange", "ffa500"),
    ("orangered", "ff4500"),
    ("orchid", "da70d6"),
    ("palegoldenrod", "eee8aa"),
    ("palegreen", "98fb98"),
    ("paleturquoise", "afeeee"),
    ("palevioletred", "db7093"),
    ("papayawhip", "ffefd5"),
    ("peachpuff", "ffdab9"),
    ("peru", "cd853f"),
    ("pink", "ffc0cb"),
    ("plum", "dda0dd"),
    ("powderblue", "b0e0e6"),
    ("purple", "800080"),
    ("rebeccapurple", "663399"),
    ("red", "ff0000"),
    ("rosybrown", "bc8f8f"),
    ("royalblue", "4169e1"),
    ("saddlebrown", "8b4513"),
    ("salmon", "fa8072"),
    ("sandybrown", "f4a460"),
    ("seagreen", "2e8b57"),
    ("seashell", "fff5ee"),
    ("sienna", "a0522d"),
    ("silver", "c0c0c0"),
    ("skyblue", "87ceeb"),
    ("slateblue", "6a5acd"),
    ("slategray", "708090"),
    ("slategrey", "708090"),
    ("snow", "fffafa"),
    ("springgreen", "00ff7f"),
    ("steelblue", "4682b4"),
    ("tan", "d2b48c"),
    ("teal", "008080"),
    ("thistle", "d8bfd8"),
    ("tomato", "ff6347"),
    ("turquoise", "40e0d0"),
    ("violet", "ee82ee"),
    ("wheat", "f5deb3"),
    ("white", "ffffff"),
    ("whitesmoke", "f5f5f5"),
    ("yellow", "ffff00"),
    ("yellowgreen", "9acd32"),
];

static HEX: LazyLock<Regex> = LazyLock::new(|| compile(r"(?i)^[0-9a-f]+$"));
static ARG: LazyLock<Regex> = LazyLock::new(|| {
    compile(r"(?i)^([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[+-]?[0-9]+)?)(%|deg|turn|rad|grad)?$")
});
static FUNC: LazyLock<Regex> = LazyLock::new(|| compile(r"(?s)^([a-z]+)\((.*)\)$"));

fn clamp01(x: f64) -> f64 {
    x.clamp(0.0, 1.0)
}

fn fail(text: &str) -> DeqError {
    let issue = format!(
        "color: cannot convert {} to RGB",
        json_string(&take_chars(text, 80))
    );
    DeqError::options("invalid colour", vec![issue])
}

fn hex(h: &str, text: &str) -> Result<Rgba> {
    // Short forms #rgb and #rgba double each digit.
    let full: String = if h.chars().count() <= 4 {
        h.chars().flat_map(|c| [c, c]).collect()
    } else {
        h.to_owned()
    };
    if !HEX.is_match(&full) || !(full.len() == 6 || full.len() == 8) {
        return Err(fail(text));
    }
    let n = |i: usize| f64::from(u8::from_str_radix(&full[i..i + 2], 16).unwrap_or(0)) / 255.0;
    Ok((n(0), n(2), n(4), if full.len() == 8 { n(6) } else { 1.0 }))
}

fn arg(token: Option<&str>, percent_scale: f64, text: &str) -> Result<f64> {
    let token = token.ok_or_else(|| fail(text))?;
    if token == "none" {
        return Ok(0.0);
    }
    let m = ARG.captures(token).ok_or_else(|| fail(text))?;
    let value: f64 = m
        .get(1)
        .map_or("", |x| x.as_str())
        .parse()
        .map_err(|_| fail(text))?;
    let unit = m
        .get(2)
        .map_or(String::new(), |x| x.as_str().to_lowercase());
    Ok(match unit.as_str() {
        "%" => (value / 100.0) * percent_scale,
        "turn" => value * 360.0,
        "rad" => (value * 180.0) / PI,
        "grad" => value * 0.9,
        _ => value,
    })
}

fn srgb_gamma(c: f64) -> f64 {
    if c <= 0.003_130_8 {
        12.92 * c
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

fn from_linear(r: f64, g: f64, b: f64, a: f64) -> Rgba {
    (
        clamp01(srgb_gamma(r)),
        clamp01(srgb_gamma(g)),
        clamp01(srgb_gamma(b)),
        clamp01(a),
    )
}

fn hsl_to_rgb(h: f64, s: f64, light: f64) -> (f64, f64, f64) {
    let f = |n: f64| {
        let k = js_mod(n + h / 30.0, 12.0);
        let a = s * light.min(1.0 - light);
        light - a * (-1.0f64).max((k - 3.0).min(9.0 - k).min(1.0))
    };
    (f(0.0), f(8.0), f(4.0))
}

fn cube(t: f64) -> f64 {
    t.powi(3)
}

#[allow(clippy::unreadable_literal, clippy::excessive_precision)]
fn lab_to_rgb(lightness: f64, a: f64, b: f64, alpha: f64) -> Rgba {
    // CIE Lab (D50) -> XYZ D50 -> Bradford to D65 -> linear sRGB (CSS Color 4 matrices).
    let e = 216.0 / 24389.0;
    let k = 24389.0 / 27.0;
    let fy = (lightness + 16.0) / 116.0;
    let fx = fy + a / 500.0;
    let fz = fy - b / 200.0;
    let inv = |t: f64| {
        if cube(t) > e {
            cube(t)
        } else {
            (116.0 * t - 16.0) / k
        }
    };
    let x = inv(fx) * (0.3457 / 0.3585);
    let y = if lightness > k * e {
        cube(fy)
    } else {
        lightness / k
    };
    let z = inv(fz) * ((1.0 - 0.3457 - 0.3585) / 0.3585);
    let xx = 0.955473421488075 * x - 0.02309845494876471 * y + 0.06325924320057072 * z;
    let yy = -0.0283697093338637 * x + 1.0099953980813041 * y + 0.021041441191917323 * z;
    let zz = 0.012314014864481998 * x - 0.020507649298898964 * y + 1.330365926242124 * z;
    from_linear(
        3.2409699419045226 * xx - 1.537383177570094 * yy - 0.4986107602930034 * zz,
        -0.9692436362808796 * xx + 1.8759675015077202 * yy + 0.04155505740717559 * zz,
        0.05563007969699366 * xx - 0.20397695888897652 * yy + 1.0569715142428786 * zz,
        alpha,
    )
}

#[allow(clippy::unreadable_literal)]
fn oklab_to_rgb(lightness: f64, a: f64, b: f64, alpha: f64) -> Rgba {
    let l3 = cube(lightness + 0.3963377774 * a + 0.2158037573 * b);
    let m3 = cube(lightness - 0.1055613458 * a - 0.0638541728 * b);
    let s3 = cube(lightness - 0.0894841775 * a - 1.291485548 * b);
    from_linear(
        4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
        -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
        -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
        alpha,
    )
}

fn polar(c: f64, h: f64) -> (f64, f64) {
    (c * ((h * PI) / 180.0).cos(), c * ((h * PI) / 180.0).sin())
}

fn hue(x: f64) -> f64 {
    js_mod(js_mod(x, 360.0) + 360.0, 360.0)
}

fn func(name: &str, body: &str, text: &str) -> Result<Rgba> {
    // Both the legacy comma syntax and the modern space syntax with "/ alpha".
    let pieces: Vec<&str> = body.split('/').collect();
    if pieces.len() > 2 {
        return Err(fail(text));
    }
    let replaced = pieces[0].replace(',', " ");
    let mut parts: Vec<&str> = replaced.split_whitespace().collect();
    let mut alpha_token = pieces.get(1).map(|p| p.trim());
    if alpha_token.is_none() && parts.len() == 4 {
        alpha_token = parts.pop();
    }
    let [p0, p1, p2] = parts.as_slice() else {
        return Err(fail(text));
    };
    let (p0, p1, p2) = (Some(*p0), Some(*p1), Some(*p2));
    let alpha = match alpha_token {
        None => 1.0,
        Some(t) => clamp01(arg(Some(t), 1.0, text)?),
    };
    Ok(match name {
        "rgb" | "rgba" => (
            clamp01(arg(p0, 255.0, text)? / 255.0),
            clamp01(arg(p1, 255.0, text)? / 255.0),
            clamp01(arg(p2, 255.0, text)? / 255.0),
            alpha,
        ),
        "hsl" | "hsla" => {
            let (r, g, b) = hsl_to_rgb(
                hue(arg(p0, 360.0, text)?),
                clamp01(arg(p1, 100.0, text)? / 100.0),
                clamp01(arg(p2, 100.0, text)? / 100.0),
            );
            (r, g, b, alpha)
        }
        "hwb" => {
            let mut w = clamp01(arg(p1, 100.0, text)? / 100.0);
            let mut k = clamp01(arg(p2, 100.0, text)? / 100.0);
            if w + k > 1.0 {
                let total = w + k;
                w /= total;
                k /= total;
            }
            let (r, g, b) = hsl_to_rgb(hue(arg(p0, 360.0, text)?), 1.0, 0.5);
            let mix = |c: f64| c * (1.0 - w - k) + w;
            (mix(r), mix(g), mix(b), alpha)
        }
        "lab" => lab_to_rgb(
            arg(p0, 100.0, text)?,
            arg(p1, 125.0, text)?,
            arg(p2, 125.0, text)?,
            alpha,
        ),
        "lch" => {
            let (a, b) = polar(arg(p1, 150.0, text)?, arg(p2, 360.0, text)?);
            lab_to_rgb(arg(p0, 100.0, text)?, a, b, alpha)
        }
        "oklab" => oklab_to_rgb(
            arg(p0, 1.0, text)?,
            arg(p1, 0.4, text)?,
            arg(p2, 0.4, text)?,
            alpha,
        ),
        "oklch" => {
            let (a, b) = polar(arg(p1, 0.4, text)?, arg(p2, 360.0, text)?);
            oklab_to_rgb(arg(p0, 1.0, text)?, a, b, alpha)
        }
        _ => return Err(fail(text)),
    })
}

/// Parse a CSS colour; `currentColor` resolves to `current`.
///
/// # Errors
/// `InvalidOptions` when the colour cannot be converted.
pub fn parse_color(text: &str, current: Rgba) -> Result<Rgba> {
    let s = text.trim().to_lowercase();
    if s == "currentcolor" {
        return Ok(current);
    }
    if s == "transparent" {
        return Ok((0.0, 0.0, 0.0, 0.0));
    }
    if let Some(h) = s.strip_prefix('#') {
        return hex(h, text);
    }
    if let Some((_, named)) = NAMED_COLORS.iter().find(|(n, _)| *n == s) {
        return hex(named, text);
    }
    let m = FUNC.captures(&s).ok_or_else(|| fail(text))?;
    let (name, body) = (
        m.get(1).map_or("", |x| x.as_str()),
        m.get(2).map_or("", |x| x.as_str()),
    );
    if body.chars().count() > 64 {
        return Err(fail(text));
    }
    func(name, body, text)
}

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn byte(c: f64) -> String {
    // A value from 0 to 255 after clamping.
    format!("{:02x}", js_round(clamp01(c) * 255.0) as u8)
}

/// `#rrggbb`, or `#rrggbbaa` when not opaque.
#[must_use]
pub fn to_hex(c: Rgba) -> String {
    let (r, g, b, a) = c;
    format!(
        "#{}{}{}{}",
        byte(r),
        byte(g),
        byte(b),
        if a < 1.0 { byte(a) } else { String::new() }
    )
}

/// Naive device CMYK (no ICC profile): `k = 1 - max(r, g, b)`.
#[must_use]
pub fn to_cmyk(c: Rgba) -> (f64, f64, f64, f64) {
    let (r, g, b, _) = c;
    let k = 1.0 - r.max(g).max(b);
    if k >= 1.0 {
        return (0.0, 0.0, 0.0, 1.0);
    }
    (
        (1.0 - r - k) / (1.0 - k),
        (1.0 - g - k) / (1.0 - k),
        (1.0 - b - k) / (1.0 - k),
        k,
    )
}
