//! The shared CLI cases (`spec/fixtures/cli`, ADR 0011) give the same results as the Node CLI.

use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn read(path: &Path) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|e| format!("{}: {e}", path.display()))
}

fn s<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}

fn files_in(dir: &Path, base: &Path, out: &mut BTreeMap<String, Vec<u8>>) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.is_dir() {
            files_in(&path, base, out)?;
        } else {
            let rel = path.strip_prefix(base).map_err(|e| e.to_string())?;
            let key = rel
                .components()
                .map(|c| c.as_os_str().to_string_lossy().into_owned())
                .collect::<Vec<_>>()
                .join("/");
            out.insert(key, read(&path)?);
        }
    }
    Ok(())
}

fn u32_at(data: &[u8], at: usize, big: bool) -> u32 {
    let mut b = [0u8; 4];
    if let Some(slice) = data.get(at..at + 4) {
        b.copy_from_slice(slice);
    }
    if big {
        u32::from_be_bytes(b)
    } else {
        u32::from_le_bytes(b)
    }
}

/// The same check as `fileCheck` in packages/cli/scripts/cases.ts.
fn file_check(case: &str, path: &str, data: &[u8]) -> Result<Value, String> {
    let ext = path.rsplit('.').next().unwrap_or("");
    Ok(match ext {
        "png" => {
            json!({"path": path, "check": "png", "width": u32_at(data, 16, true), "height": u32_at(data, 20, true)})
        }
        "jpg" | "webp" => {
            let magic = if ext == "jpg" {
                data.starts_with(b"\xff\xd8\xff")
            } else {
                data.get(8..12) == Some(b"WEBP")
            };
            if !magic {
                return Err(format!("{path} is not a {ext} file"));
            }
            json!({"path": path, "check": ext})
        }
        "ico" => {
            let count = usize::from(u16::from_le_bytes([
                data.get(4).copied().unwrap_or(0),
                data.get(5).copied().unwrap_or(0),
            ]));
            let sizes: Vec<u32> = (0..count)
                .map(|i| {
                    data.get(6 + i * 16)
                        .map_or(0, |b| if *b == 0 { 256 } else { u32::from(*b) })
                })
                .collect();
            json!({"path": path, "check": "ico", "sizes": sizes})
        }
        _ => json!({"path": path, "check": "bytes", "fixture": format!("{case}/files/{path}")}),
    })
}

fn run_case(case: &Value, ports: &[&str], tmp: &Path) -> Result<(), String> {
    let name = s(case, "name");
    let fixtures = root().join("spec/fixtures/cli");
    let cwd = tmp.join(name);
    std::fs::create_dir_all(&cwd).map_err(|e| e.to_string())?;
    for setup in case
        .get("setup")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let path = cwd.join(s(setup, "path"));
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let data = if setup.get("copy").is_some() {
            read(&root().join(s(setup, "copy")))?
        } else {
            s(setup, "text").as_bytes().to_vec()
        };
        std::fs::write(&path, data).map_err(|e| e.to_string())?;
    }
    let args: Vec<&str> = case
        .get("args")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    let out = Command::new(env!("CARGO_BIN_EXE_deq"))
        .args(&args)
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    let code = out.status.code().unwrap_or(-1);
    let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
    let mut files = BTreeMap::new();
    files_in(&cwd, &cwd, &mut files)?;
    let fail = |what: &str| format!("{name}: {what} (exit {code}, stderr {stderr:?})");
    if case.get("nodeOnly") == Some(&Value::Bool(true)) {
        let at = args
            .iter()
            .position(|a| *a == "--format")
            .ok_or_else(|| fail("no --format"))?;
        let fmt = args
            .get(at + 1)
            .and_then(|l| l.split(',').find(|f| !ports.contains(f)))
            .ok_or_else(|| fail("no Node format"))?;
        let want = format!(
            "deq: error: format \"{fmt}\" is only available in the Node CLI (npx @0xdolan/deq-cli)\n"
        );
        if code != 4 || stderr != want || !out.stdout.is_empty() {
            return Err(fail("node-only case differs"));
        }
        if !files.is_empty() {
            return Err(fail("node-only case wrote files"));
        }
        return Ok(());
    }
    if i64::from(code) != case.get("exit").and_then(Value::as_i64).unwrap_or(-1) {
        return Err(fail("exit code differs"));
    }
    let want_out = match case.get("stdout").and_then(Value::as_str) {
        Some(p) => read(&fixtures.join(p))?,
        None => Vec::new(),
    };
    if out.stdout != want_out {
        return Err(fail(&format!(
            "stdout differs: {:?}",
            String::from_utf8_lossy(&out.stdout)
        )));
    }
    match case.get("stderr").and_then(Value::as_str) {
        Some(p) if out.stderr != read(&fixtures.join(p))? => return Err(fail("stderr differs")),
        None if code == 0 && !out.stderr.is_empty() => return Err(fail("unexpected stderr")),
        _ => {}
    }
    let checks = files
        .iter()
        .map(|(p, d)| file_check(name, p, d))
        .collect::<Result<Vec<_>, _>>()?;
    let want_files = case.get("files").cloned().unwrap_or(Value::Null);
    if Value::Array(checks.clone()) != want_files {
        return Err(fail(&format!(
            "files differ: got {checks:?}, want {want_files}"
        )));
    }
    for check in &checks {
        if s(check, "check") == "bytes" {
            let p = s(check, "path");
            if files.get(p) != Some(&read(&fixtures.join(s(check, "fixture")))?) {
                return Err(fail(&format!("{p} differs from its fixture")));
            }
        }
    }
    Ok(())
}

#[test]
fn cli_cases_match_the_node_cli() -> Result<(), String> {
    let manifest: Value =
        serde_json::from_slice(&read(&root().join("spec/fixtures/cli/manifest.json"))?)
            .map_err(|e| e.to_string())?;
    let cli: Value =
        serde_json::from_str(include_str!("../data/cli.json")).map_err(|e| e.to_string())?;
    let ports: Vec<&str> = cli
        .pointer("/formats/ports")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    let cases = manifest
        .get("cases")
        .and_then(Value::as_array)
        .ok_or("no cases")?;
    if cases.len() < 50 {
        return Err(format!("only {} cases", cases.len()));
    }
    let tmp = std::env::temp_dir().join(format!("deq-cli-cases-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    let failures: Vec<String> = cases
        .iter()
        .filter_map(|c| run_case(c, &ports, &tmp).err())
        .collect();
    let _ = std::fs::remove_dir_all(&tmp);
    if failures.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "{} of {} cases failed:\n{}",
            failures.len(),
            cases.len(),
            failures.join("\n")
        ))
    }
}
