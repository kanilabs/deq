//! Deq Leet and patterns match the golden fixtures in `spec/fixtures/leet/` (ADR 0015).

use deq_shapes::leet::{MAX_DECODE_INPUT, entry_of, normalize};
use deq_shapes::scene::resolve_scene_options;
use deq_shapes::{
    Cell, ErrorCode, Scene, Script, decode_leet, detect_script, leet, leet_table, pattern,
    scene_svg,
};
use serde_json::{Value, json};
use std::path::PathBuf;

const OWN: [&str; 6] = [
    "level",
    "script",
    "seed",
    "letterSpacing",
    "lineSpacing",
    "align",
];

fn dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../spec/fixtures/leet")
}

fn read(name: &str) -> Result<String, String> {
    let path = dir().join(name);
    std::fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))
}

fn err_of<T: std::fmt::Debug>(r: deq_shapes::Result<T>) -> deq_shapes::DeqError {
    match r {
        Err(e) => e,
        Ok(v) => deq_shapes::DeqError::new(ErrorCode::InvalidOptions, format!("no error: {v:?}")),
    }
}

#[test]
fn fixtures_match() -> Result<(), String> {
    let manifest: Value =
        serde_json::from_str(&read("manifest.json")?).map_err(|e| e.to_string())?;
    let cases = manifest["cases"].as_array().cloned().unwrap_or_default();
    assert!(cases.len() >= 20, "manifest has {} cases", cases.len());
    let mut failed = Vec::new();
    for case in &cases {
        let name = &case["name"];
        let want = read(case["file"].as_str().unwrap_or(""))?;
        let got = if let Some(l) = case.get("leet") {
            let options = l.get("options").cloned().unwrap_or(json!({}));
            leet(l["text"].as_str().unwrap_or(""), &options).map(|r| r.svg)
        } else {
            pattern(&case["pattern"]).map(|r| r.svg)
        };
        match got {
            Ok(svg) if svg == want => {}
            Ok(svg) => failed.push(format!("{name}: differs\n  got  {svg}\n  want {want}")),
            Err(e) => failed.push(format!("{name}: {e}")),
        }
        if let Some(text) = case.get("decoded").and_then(Value::as_str) {
            let mut render = case["leet"]
                .get("options")
                .and_then(Value::as_object)
                .cloned()
                .unwrap_or_default();
            render.retain(|k, _| !OWN.contains(&k.as_str()));
            match decode_leet(&want, &Value::Object(render)) {
                Ok(d) if d.text == text => {}
                Ok(d) => failed.push(format!("{name}: decodes to {:?}", d.text)),
                Err(e) => failed.push(format!("{name}: decode {e}")),
            }
        }
    }
    assert!(failed.is_empty(), "{}", failed.join("\n"));
    Ok(())
}

#[test]
fn tables_and_script() {
    assert_eq!(leet_table(Script::Sorani)["direction"], "rtl");
    assert!(entry_of(Script::Latin, "A").is_some());
    assert!(entry_of(Script::Latin, "\u{2603}").is_none());
    assert_eq!(detect_script("\u{628}"), Script::Sorani);
    assert_eq!(detect_script("abc"), Script::Latin);
}

#[test]
fn normalizes() -> deq_shapes::Result<()> {
    let norm = normalize("  ab\u{200b} \r\n\r\n c\u{2603}d \n\n", Script::Latin)?;
    assert_eq!(norm.text, "AB\n\nCD");
    assert_eq!(norm.unknown, vec!["\u{2603}".to_owned()]);
    let long = err_of(normalize(&"a".repeat(1025), Script::Latin));
    assert!(long.message.contains("longer than 1024"), "{long}");
    assert_eq!(long.code, ErrorCode::LimitExceeded);
    let many = err_of(normalize(&"a".repeat(257), Script::Latin));
    assert!(many.message.contains("more than 256 glyphs"), "{many}");
    let lines = err_of(normalize(&"a\n".repeat(33), Script::Latin));
    assert!(lines.message.contains("more than 32 lines"), "{lines}");
    Ok(())
}

#[test]
fn leet_result_and_layout() -> deq_shapes::Result<()> {
    let r = leet("Hi \u{2603}", &json!({ "align": "center" }))?;
    assert_eq!(
        (r.text.as_str(), r.script, r.level.as_str()),
        ("HI", Script::Latin, "basic")
    );
    assert_eq!(r.unknown, vec!["\u{2603}".to_owned()]);
    let end = leet("ab\nc", &json!({ "align": "end" }))?;
    assert_eq!(end.scene.cells[2].x, 26.0);
    let rtl = leet("\u{628}\u{627}\n\u{628}", &json!({ "align": "end" }))?;
    assert_eq!(rtl.scene.cells[2].x, 0.0);
    Ok(())
}

#[test]
fn leet_bad_options() {
    let cases = [
        (
            json!({"level": "loud"}),
            "level: must be one of basic, advanced, full",
        ),
        (json!({"seed": -1}), "seed: must be from 0 to 4294967295"),
        (json!({"seed": 1.5}), "seed: must be an integer"),
        (
            json!({"letterSpacing": 25}),
            "letterSpacing: must be from 0 to 24",
        ),
        (
            json!({"rotation": 90}),
            "rotation: not available for scenes",
        ),
        (
            json!({"colors": []}),
            "colors: must be a list of 1 to 16 colours",
        ),
        (json!({"colors": ["#zz"]}), "colors.0: must be a CSS colour"),
    ];
    for (options, message) in cases {
        let e = err_of(leet("A", &options));
        assert_eq!(e.code, ErrorCode::InvalidOptions);
        assert!(e.message.contains(message), "{e} lacks {message}");
    }
    let none = err_of(leet("\u{2603} ", &json!({})));
    assert!(none.message.contains("no characters of the latin table"));
}

#[test]
fn decode_errors() {
    let big = err_of(decode_leet(&"x".repeat(MAX_DECODE_INPUT + 1), &json!({})));
    assert_eq!(big.code, ErrorCode::LimitExceeded);
    let plain = err_of(decode_leet("<svg/>", &json!({})));
    assert!(plain.message.contains("not Deq Leet SVG"));
    let far = err_of(decode_leet(
        "<svg data-deq-leet=\"latin basic 0 30\">",
        &json!({}),
    ));
    assert!(far.message.contains("advances out of range"));
}

fn group(x: &str, y: &str) -> String {
    format!("<g data-layer=\"c1\" transform=\"translate({x} {y})\"></g>")
}

#[test]
fn decode_unmatched_and_caps() -> deq_shapes::Result<()> {
    let head = "\n <svg data-deq-leet=\"latin basic 26 30\">";
    let far = format!(
        "{head}{}{}{}",
        group("0", "0"),
        group("99999999", "0"),
        group("0", "99999999")
    );
    let out = decode_leet(&far, &json!({}))?;
    assert_eq!(out.unmatched, 3);
    let want = format!(
        "\u{FFFD}{}\u{FFFD}{}\u{FFFD}",
        " ".repeat(256),
        "\n".repeat(32)
    );
    assert_eq!(out.text, want);
    let many = format!("{head}{}", group("0", "0").repeat(257));
    let e = err_of(decode_leet(&many, &json!({})));
    assert!(e.message.contains("more than 256 glyphs"));
    let odd = format!("{head}{}", group("1.2.3", "0"));
    assert_eq!(decode_leet(&odd, &json!({}))?.unmatched, 0);
    Ok(())
}

#[test]
fn scene_svg_and_options() -> deq_shapes::Result<()> {
    let glyph = json!([{"shape": "dot", "params": {}, "transform": {"rotate": 90}}]);
    let one = Scene {
        width: 24.0,
        height: 24.0,
        cells: vec![Cell {
            x: 0.0,
            y: 0.0,
            glyph,
        }],
    };
    let svg = scene_svg(&one, &json!({"colors": ["red"]}), "t", "")?;
    assert!(svg.contains("color=\"red\" stroke=\"currentColor\""));
    assert_eq!(
        resolve_scene_options(&json!({}))?.colors,
        Vec::<String>::new()
    );
    let cell = Cell {
        x: 0.0,
        y: 0.0,
        glyph: json!([{"shape": "roj-sun-circle"}]),
    };
    let many = Scene {
        width: 24.0,
        height: 24.0,
        cells: vec![cell; 20_001],
    };
    let e = err_of(scene_svg(&many, &json!({}), "", ""));
    assert!(e.message.contains("more than 20000 elements"), "{e}");
    Ok(())
}

#[test]
fn pattern_results_and_errors() -> deq_shapes::Result<()> {
    let r = pattern(&json!({"kind": "grid", "motifs": ["dot"], "cols": 2, "rows": 1}))?;
    assert_eq!(r.motifs, vec!["dot".to_owned(), "dot".to_owned()]);
    assert_eq!(r.scene.cells.len(), 2);
    assert!(pattern(&json!({}))?.svg.starts_with("<svg"));
    let cases = [
        (
            json!({"kind": "spiral"}),
            "kind: must be one of band, grid, rosette, border",
        ),
        (json!({"count": 4}), "count: must be odd"),
        (json!({"count": 65}), "count: must be from 3 to 63"),
        (json!({"count": "9"}), "count: must be an integer"),
        (
            json!({"motifs": []}),
            "motifs: must be a list of 1 to 64 shape ids",
        ),
        (
            json!({"motifs": ["Bad Id"]}),
            "motifs: must be a list of 1 to 64 shape ids",
        ),
        (
            json!({"kind": "border", "cols": 2}),
            "a border needs at least 3 x 3 cells",
        ),
    ];
    for (options, message) in cases {
        let e = err_of(pattern(&options));
        assert!(e.message.contains(message), "{e} lacks {message}");
    }
    let unknown = err_of(pattern(&json!({"motifs": ["no-such-shape"]})));
    assert_eq!(unknown.code, ErrorCode::UnknownShape);
    Ok(())
}
