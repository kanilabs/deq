//! Deq Leet: text written with Deq glyphs, and decoding of `basic` output (ADR 0015).
//!
//! The tables come from `data/leet.json`, generated from `spec/leet/`.

use std::collections::HashMap;
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value};
use unicode_normalization::UnicodeNormalization;

use crate::error::{DeqError, ErrorCode, Result};
use crate::format::{is_integer, js_round, js_str, num};
use crate::options::{number, picklist};
use crate::pattern::compile;
use crate::random::{MAX_SEED, Random};
use crate::scene::{Cell, Scene, glyph_markup, resolve_scene_options, scene_svg};

/// The longest input accepted, in UTF-16 code units.
pub const MAX_INPUT: usize = 1024;
/// The most glyphs one text may draw.
pub const MAX_GLYPHS: usize = MAX_GLYPHS_U32 as usize;
/// The most lines one text may have.
pub const MAX_LINES: usize = MAX_LINES_U32 as usize;
// The caps as `u32`, for exact conversion to `f64`.
const MAX_GLYPHS_U32: u32 = 256;
const MAX_LINES_U32: u32 = 32;

/// Largest SVG [`decode_leet`] reads, in UTF-16 code units.
pub const MAX_DECODE_INPUT: usize = 4 * 1024 * 1024;

static TABLES: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../data/leet.json")).unwrap_or(Value::Null)
});

static INDEX: LazyLock<[HashMap<String, &'static Value>; 2]> =
    LazyLock::new(|| [build_index(Script::Latin), build_index(Script::Sorani)]);

const NUM: &str = r"[0-9]+(?:\.[0-9]+)?";
static META: LazyLock<Regex> = LazyLock::new(|| {
    compile(&format!(
        r#"^<svg [^>]*?data-deq-leet="(latin|sorani) (basic|advanced|full) ({NUM}) ({NUM})""#
    ))
});
static GROUP: LazyLock<Regex> = LazyLock::new(|| {
    compile(&format!(
        r#"(?s)<g data-layer="c[0-9]+" transform="translate\((-?{NUM}) (-?{NUM})\)"(?: color="[^"<>]*" stroke="currentColor")?>(.*?)</g>"#
    ))
});

/// A script with a Leet table.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Script {
    /// Latin and Kurmanji letters, digits and punctuation, left to right.
    Latin,
    /// Sorani in Arabic script, right to left.
    Sorani,
}

impl Script {
    /// The script's name in the tables and options.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Latin => "latin",
            Self::Sorani => "sorani",
        }
    }

    fn from_name(name: &str) -> Self {
        if name == "sorani" {
            Self::Sorani
        } else {
            Self::Latin
        }
    }

    fn slot(self) -> usize {
        match self {
            Self::Latin => 0,
            Self::Sorani => 1,
        }
    }
}

/// The table of `script`: `{version, script, direction, aliases, glyphs}` as in `spec/leet/`.
#[must_use]
pub fn leet_table(script: Script) -> &'static Value {
    &TABLES[script.as_str()]
}

fn build_index(script: Script) -> HashMap<String, &'static Value> {
    leet_table(script)["glyphs"]
        .as_array()
        .map(|glyphs| {
            glyphs
                .iter()
                .filter_map(|e| e["char"].as_str().map(|c| (c.to_owned(), e)))
                .collect()
        })
        .unwrap_or_default()
}

/// The entry for an already normalised character, if the table has one.
#[must_use]
pub fn entry_of(script: Script, ch: &str) -> Option<&'static Value> {
    INDEX[script.slot()].get(ch).copied()
}

/// Sorani when `text` has Arabic-script letters, else Latin.
#[must_use]
pub fn detect_script(text: &str) -> Script {
    if text.chars().any(|c| ('\u{600}'..='\u{6FF}').contains(&c)) {
        Script::Sorani
    } else {
        Script::Latin
    }
}

// Joiners, tatweel and bidi controls carry no letter of their own.
fn ignored(c: char) -> bool {
    matches!(c, '\u{200B}'..='\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}' | '\u{640}' | '\u{FEFF}')
}

fn space(c: char) -> bool {
    matches!(
        c,
        '\t' | ' ' | '\u{A0}' | '\u{2000}'..='\u{200A}' | '\u{202F}' | '\u{205F}' | '\u{3000}'
    )
}

/// What JavaScript's `trimStart` removes.
fn js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{B}' | '\u{C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

fn utf16_len(s: &str) -> usize {
    s.encode_utf16().count()
}

fn limit(message: String) -> DeqError {
    DeqError::new(ErrorCode::LimitExceeded, message)
}

/// The result of [`normalize`].
#[derive(Debug, Clone, PartialEq)]
pub struct Normalized {
    /// Lines of tokens (a table entry, or `None` for a space), trimmed.
    pub lines: Vec<Vec<Option<&'static Value>>>,
    /// The normalised text (what decoding `basic` output gives back).
    pub text: String,
    /// Characters with no glyph in the table, in first-seen order.
    pub unknown: Vec<String>,
}

/// Normalise `text` for `script`: NFC, LF, no joiners or tatweel, upper case, aliases.
///
/// # Errors
/// `LimitExceeded` for input over [`MAX_INPUT`], more than [`MAX_GLYPHS`] glyphs or more
/// than [`MAX_LINES`] lines.
pub fn normalize(text: &str, script: Script) -> Result<Normalized> {
    if utf16_len(text) > MAX_INPUT {
        return Err(limit(format!("text is longer than {MAX_INPUT} characters")));
    }
    let aliases = &leet_table(script)["aliases"];
    let mut unknown: Vec<String> = Vec::new();
    let mut raw: Vec<Vec<Option<&'static Value>>> = vec![Vec::new()];
    let mut glyphs = 0usize;
    let clean: String = text
        .nfc()
        .collect::<String>()
        .replace("\r\n", "\n")
        .replace('\r', "\n");
    for ch in clean.chars().filter(|c| !ignored(*c)) {
        if ch == '\n' {
            raw.push(Vec::new());
            continue;
        }
        let Some(line) = raw.last_mut() else { continue };
        if space(ch) {
            line.push(None);
            continue;
        }
        for up in ch.to_uppercase() {
            let up = up.to_string();
            let key = aliases.get(&up).and_then(Value::as_str).unwrap_or(&up);
            if let Some(entry) = entry_of(script, key) {
                line.push(Some(entry));
                glyphs += 1;
            } else {
                let original = ch.to_string();
                if !unknown.contains(&original) {
                    unknown.push(original);
                }
            }
        }
    }
    if glyphs > MAX_GLYPHS {
        return Err(limit(format!("text has more than {MAX_GLYPHS} glyphs")));
    }
    let mut lines: Vec<Vec<Option<&'static Value>>> = raw
        .into_iter()
        .map(|row| {
            let a = row.iter().position(Option::is_some).unwrap_or(row.len());
            let b = row.iter().rposition(Option::is_some).map_or(a, |b| b + 1);
            row.get(a..b).map(<[_]>::to_vec).unwrap_or_default()
        })
        .collect();
    let first = lines
        .iter()
        .position(|l| !l.is_empty())
        .unwrap_or(lines.len());
    let last = lines
        .iter()
        .rposition(|l| !l.is_empty())
        .map_or(first, |b| b + 1);
    lines = lines
        .get(first..last)
        .map(<[_]>::to_vec)
        .unwrap_or_default();
    if lines.len() > MAX_LINES {
        return Err(limit(format!("text has more than {MAX_LINES} lines")));
    }
    let text = lines
        .iter()
        .map(|row| {
            row.iter()
                .map(|t| t.and_then(|e| e["char"].as_str()).unwrap_or(" "))
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("\n");
    Ok(Normalized {
        lines,
        text,
        unknown,
    })
}

/// A check of one option: `None` when the value is fine, else the problem.
pub(crate) type Check = fn(&Value) -> Option<String>;

pub(crate) fn integer(v: &Value, lo: f64, hi: f64) -> Option<String> {
    if !is_integer(v) {
        return Some("must be an integer".to_owned());
    }
    let x = v.as_f64().unwrap_or(f64::NAN);
    if (lo..=hi).contains(&x) {
        None
    } else {
        Some(format!(
            "must be from {} to {} (got {})",
            num(lo),
            num(hi),
            js_str(v)
        ))
    }
}

pub(crate) fn seed_check(v: &Value) -> Option<String> {
    integer(v, 0.0, f64::from(MAX_SEED))
}

/// A whole number already checked to be in range, as an index type.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub(crate) fn to_usize(v: f64) -> usize {
    v as usize
}

/// A seed already checked to be in range.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub(crate) fn to_seed(v: Option<&Value>) -> u32 {
    v.and_then(Value::as_f64).map_or(1, |s| s as u32)
}

const LEET_CHECKS: [(&str, Check); 6] = [
    ("level", |v| picklist(v, &["basic", "advanced", "full"])),
    ("script", |v| picklist(v, &["latin", "sorani"])),
    ("seed", seed_check),
    ("letterSpacing", |v| number(v, 0.0, 24.0, false)),
    ("lineSpacing", |v| number(v, 0.0, 48.0, false)),
    ("align", |v| picklist(v, &["start", "center", "end"])),
];

/// Split `options` into checked own options and the scene options left over.
pub(crate) fn split_options(
    options: &Value,
    checks: &[(&str, Check)],
    what: &str,
) -> Result<(Map<String, Value>, Value)> {
    let Value::Object(map) = options else {
        return Ok((Map::new(), options.clone()));
    };
    let mut scene = map.clone();
    let mut own = Map::new();
    let mut issues = Vec::new();
    for (key, check) in checks {
        if let Some(v) = scene.shift_remove(*key) {
            match check(&v) {
                None => {
                    own.insert((*key).to_owned(), v);
                }
                Some(problem) => issues.push(format!("{key}: {problem}")),
            }
        }
    }
    if issues.is_empty() {
        Ok((own, Value::Object(scene)))
    } else {
        Err(DeqError::options(&format!("invalid {what}"), issues))
    }
}

/// The result of [`leet`].
#[derive(Debug, Clone, PartialEq)]
pub struct LeetResult {
    /// The SVG document, one `<g data-layer="cN">` per glyph in reading order.
    pub svg: String,
    /// The normalised text that was drawn.
    pub text: String,
    /// The script used.
    pub script: Script,
    /// `basic`, `advanced` or `full`.
    pub level: String,
    /// Input characters with no glyph, in first-seen order (they are left out).
    pub unknown: Vec<String>,
    /// The placed glyphs.
    pub scene: Scene,
}

fn glyph_for(entry: &Value, level: &str, random: &mut Random) -> Value {
    match level {
        "basic" => entry["basic"].clone(),
        "full" => entry["full"].clone(),
        _ => {
            let mut choices = vec![&entry["basic"]];
            if let Some(alts) = entry["advanced"].as_array() {
                choices.extend(alts.iter());
            }
            random
                .pick(&choices)
                .map_or_else(|| entry["basic"].clone(), |g| (*g).clone())
        }
    }
}

/// Write `text` with Deq glyphs.
///
/// The input is plain text: length-capped, normalised and never parsed as markup.
/// Characters without a glyph are left out and listed in `unknown`; Sorani runs right to
/// left. Options are `level`, `script`, `seed`, `letterSpacing`, `lineSpacing`, `align`,
/// `colors` and the render options except the per-shape ones.
///
/// # Errors
/// `InvalidOptions` (also when nothing is left to draw) or `LimitExceeded`.
#[allow(clippy::cast_precision_loss)]
pub fn leet(text: &str, options: &Value) -> Result<LeetResult> {
    let (own, scene) = split_options(options, &LEET_CHECKS, "leet options")?;
    resolve_scene_options(&scene)?;
    let level = own.get("level").and_then(Value::as_str).unwrap_or("basic");
    let sc = own
        .get("script")
        .and_then(Value::as_str)
        .map_or_else(|| detect_script(text), Script::from_name);
    let rtl = leet_table(sc)["direction"] == "rtl";
    let norm = normalize(text, sc)?;
    if norm.lines.iter().all(Vec::is_empty) {
        let issue = format!("text: no characters of the {} table", sc.as_str());
        return Err(DeqError::options("invalid text", vec![issue]));
    }
    let f = |key: &str, default: f64| own.get(key).and_then(Value::as_f64).unwrap_or(default);
    let ls = f("letterSpacing", 2.0);
    let lh = f("lineSpacing", 6.0);
    let ax = 24.0 + ls;
    let ay = 24.0 + lh;
    let cols = norm.lines.iter().map(Vec::len).max().unwrap_or(0);
    let width = cols as f64 * ax - ls;
    let height = norm.lines.len() as f64 * ay - lh;
    let mut random = Random::new(to_seed(own.get("seed")));
    let at = own.get("align").and_then(Value::as_str).unwrap_or("start");
    let mut cells = Vec::new();
    for (row, tokens) in norm.lines.iter().enumerate() {
        let len = tokens.len();
        let free = width - (len as f64 * ax - ls);
        // The offset of the line's leftmost cell.
        let left = if at == "center" {
            free / 2.0
        } else if (at == "end") != rtl {
            free
        } else {
            0.0
        };
        for (col, token) in tokens.iter().enumerate() {
            let Some(entry) = token else { continue };
            let slot = if rtl { len - 1 - col } else { col };
            cells.push(Cell {
                x: left + slot as f64 * ax,
                y: row as f64 * ay,
                glyph: glyph_for(entry, level, &mut random),
            });
        }
    }
    let placed = Scene {
        width,
        height,
        cells,
    };
    let meta = format!(
        " data-deq-leet=\"{} {level} {} {}\"",
        sc.as_str(),
        num(ax),
        num(ay)
    );
    let svg = scene_svg(&placed, &scene, &norm.text.replace('\n', " "), &meta)?;
    Ok(LeetResult {
        svg,
        text: norm.text,
        script: sc,
        level: level.to_owned(),
        unknown: norm.unknown,
        scene: placed,
    })
}

/// The result of [`decode_leet`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedLeet {
    /// The text; glyphs that are not basic glyphs read as U+FFFD.
    pub text: String,
    /// The script named in the SVG.
    pub script: Script,
    /// How many glyph groups were not basic glyphs of the table.
    pub unmatched: usize,
}

fn not_leet(issue: &str) -> DeqError {
    DeqError::options("invalid input", vec![issue.to_owned()])
}

/// Read the text back from Leet SVG written by [`leet`] at the `basic` level.
///
/// `options` must be the render options used to write it. The SVG is treated as text and
/// only matched against what [`leet`] writes.
///
/// # Errors
/// `InvalidOptions` when the input is not Deq Leet SVG, or `LimitExceeded` (input over
/// [`MAX_DECODE_INPUT`], more than [`MAX_GLYPHS`] glyphs).
pub fn decode_leet(svg: &str, options: &Value) -> Result<DecodedLeet> {
    if utf16_len(svg) > MAX_DECODE_INPUT {
        return Err(limit(format!(
            "SVG is larger than {MAX_DECODE_INPUT} characters"
        )));
    }
    let Some(meta) = META.captures(svg.trim_start_matches(js_space)) else {
        return Err(not_leet(
            "svg: not Deq Leet SVG (no data-deq-leet attribute)",
        ));
    };
    let script = Script::from_name(&meta[1]);
    let ax: f64 = meta[3].parse().unwrap_or(0.0);
    let ay: f64 = meta[4].parse().unwrap_or(0.0);
    // The advances leet() can write: 24 plus the letter (0..24) or line (0..48) spacing.
    if !(24.0..=48.0).contains(&ax) || !(24.0..=72.0).contains(&ay) {
        return Err(not_leet("svg: data-deq-leet advances out of range"));
    }
    let o = resolve_scene_options(options)?.render;
    let mut by_markup: HashMap<String, String> = HashMap::new();
    if let Some(glyphs) = leet_table(script)["glyphs"].as_array() {
        for entry in glyphs {
            let ch = entry["char"].as_str().unwrap_or_default().to_owned();
            by_markup.insert(glyph_markup(&entry["basic"], &o)?, ch);
        }
    }
    let mut text = String::new();
    let mut unmatched = 0usize;
    let mut prev: Option<(f64, f64)> = None;
    for (n, m) in GROUP.captures_iter(svg).enumerate() {
        if n >= MAX_GLYPHS {
            return Err(limit(format!("SVG has more than {MAX_GLYPHS} glyphs")));
        }
        let x: f64 = m[1].parse().unwrap_or(0.0);
        let y: f64 = m[2].parse().unwrap_or(0.0);
        if let Some((px, py)) = prev {
            // Gaps are capped at what leet() can write, so crafted offsets cannot blow up.
            let rows = js_round((y - py) / ay).min(f64::from(MAX_LINES_U32));
            let gap = js_round((x - px).abs() / ax) - 1.0;
            if rows > 0.0 {
                text.push_str(&"\n".repeat(to_usize(rows)));
            } else {
                text.push_str(&" ".repeat(to_usize(gap.clamp(0.0, f64::from(MAX_GLYPHS_U32)))));
            }
        }
        prev = Some((x, y));
        if let Some(ch) = by_markup.get(&m[3]) {
            text.push_str(ch);
        } else {
            unmatched += 1;
            text.push('\u{FFFD}');
        }
    }
    Ok(DecodedLeet {
        text,
        script,
        unmatched,
    })
}
