//! Every golden fixture renders byte for byte (ADR 0008).

use serde_json::Value;
use std::path::PathBuf;

fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../spec/fixtures")
}

fn read(path: &PathBuf) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))
}

#[test]
fn fixtures_match() -> Result<(), String> {
    let manifest: Value = serde_json::from_str(&read(&fixtures().join("manifest.json"))?)
        .map_err(|e| e.to_string())?;
    let cases = manifest["cases"].as_array().cloned().unwrap_or_default();
    assert!(cases.len() > 200, "manifest has {} cases", cases.len());
    let mut failed = Vec::new();
    for case in &cases {
        let got = if let Some(flag) = case.get("flag") {
            deq_shapes::render_flag(flag)
        } else if let Some(parts) = case.get("compose") {
            deq_shapes::compose(parts, &case["options"])
        } else {
            deq_shapes::render(case["shape"].as_str().unwrap_or(""), &case["options"])
        };
        let want = read(&fixtures().join(case["file"].as_str().unwrap_or("")))?;
        match got {
            Ok(svg) if svg == want => {}
            Ok(svg) => failed.push(format!(
                "{}: differs\n  got  {svg}\n  want {want}",
                case["name"]
            )),
            Err(e) => failed.push(format!("{}: {e}", case["name"])),
        }
    }
    assert!(
        failed.is_empty(),
        "{} of {} fixtures differ:\n{}",
        failed.len(),
        cases.len(),
        failed.join("\n")
    );
    Ok(())
}
