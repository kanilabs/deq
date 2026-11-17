//! The `deq` command-line tool: the interface of `spec/cli.json` (ADR 0011).
//!
//! Help, messages and exit codes match the Node and Python CLIs. Formats outside the core subset
//! exit with code 4 and point to the Node CLI.

// Building text line by line with `format!` reads best here.
#![allow(clippy::format_collect)]

mod output;
mod parse;

use deq_shapes::color::{BLACK, parse_color, to_hex};
use deq_shapes::export::export_shapes;
use deq_shapes::format::js_str;
use deq_shapes::raster::{RasterFormat, encode_svg};
use deq_shapes::validate::{MAX_SPEC_BYTES, validate_spec};
use deq_shapes::{DeqError, ErrorCode, get_shape, list_categories, list_shapes, render_flag};
use output::{File, emit, errno, join_path, write_all};
use parse::{Flags, Parsed, arr, param_value, parse_args, s};
use serde_json::{Map, Value, json};
use std::io::{Read as _, Write as _};
use std::process::ExitCode;

/// Exit code for formats only the Node CLI writes.
const EXIT_NODE_ONLY: u8 = 4;

/// Everything that stops a command, by exit code.
#[derive(Debug)]
pub enum CliError {
    /// The command line is wrong (2); the command it belongs to, if any.
    Usage(String, Option<String>),
    /// A file could not be read or written (3).
    Io(String),
    /// The format is only in the Node CLI (4).
    NodeOnly(String),
    /// A shape, option or spec file is invalid (1).
    Deq(DeqError),
}

impl From<DeqError> for CliError {
    fn from(e: DeqError) -> Self {
        Self::Deq(e)
    }
}

impl std::fmt::Display for CliError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Usage(m, _) | Self::Io(m) => f.write_str(m),
            Self::NodeOnly(fmt) => write!(
                f,
                "format \"{fmt}\" is only available in the Node CLI (npx @0xdolan/deq-cli)"
            ),
            Self::Deq(e) => write!(f, "{e}"),
        }
    }
}

type Res<T> = Result<T, CliError>;

fn stdout(data: &[u8]) {
    let mut out = std::io::stdout().lock();
    // A closed pipe (`deq list | head`) is not an error worth reporting.
    let _ = out.write_all(data).and_then(|()| out.flush());
}

fn stderr(text: &str) {
    let _ = std::io::stderr().lock().write_all(text.as_bytes());
}

fn flag_str<'a>(flags: &'a Flags, key: &str) -> Option<&'a str> {
    flags.get(key).and_then(Value::as_str)
}

fn flag_on(flags: &Flags, key: &str) -> bool {
    flags.get(key) == Some(&Value::Bool(true))
}

fn invalid_options(message: String, issue: String) -> CliError {
    CliError::Deq(DeqError {
        code: ErrorCode::InvalidOptions,
        message,
        issues: vec![issue],
    })
}

// ---------------------------------------------------------------- options

fn render_options(command: &Value, flags: &Flags) -> Map<String, Value> {
    let mut o = Map::new();
    for f in arr(command, "flags") {
        let (Some(option), Some(value)) = (
            f.get("option").and_then(Value::as_str),
            flags.get(s(f, "name")),
        ) else {
            continue;
        };
        if s(f, "type") == "pair" {
            let pairs = value.as_array().map_or(&[][..], Vec::as_slice);
            let obj: Map<String, Value> = pairs
                .iter()
                .map(|p| {
                    let (k, v) = (
                        p.get(0).and_then(Value::as_str).unwrap_or(""),
                        p.get(1).and_then(Value::as_str).unwrap_or(""),
                    );
                    (
                        k.to_owned(),
                        if option == "params" {
                            param_value(v)
                        } else {
                            Value::from(v)
                        },
                    )
                })
                .collect();
            o.insert(option.to_owned(), Value::Object(obj));
        } else {
            o.insert(option.to_owned(), value.clone());
        }
    }
    o
}

fn export_options(command: &Value, flags: &Flags) -> Map<String, Value> {
    let mut o = Map::new();
    o.insert(
        "render".to_owned(),
        Value::Object(render_options(command, flags)),
    );
    for (flag, key) in [
        ("current-color", "currentColor"),
        ("matte", "matte"),
        ("quality", "quality"),
    ] {
        if let Some(v) = flags.get(flag) {
            o.insert(key.to_owned(), v.clone());
        }
    }
    o
}

fn port_format<'a>(data: &Value, fmt: &'a str) -> Res<&'a str> {
    let ports = data.get("formats").map_or(&[][..], |f| arr(f, "ports"));
    if ports.iter().any(|p| p.as_str() == Some(fmt)) {
        Ok(fmt)
    } else {
        Err(CliError::NodeOnly(fmt.to_owned()))
    }
}

// ---------------------------------------------------------------- commands

fn json_bytes(value: &Value) -> Vec<u8> {
    let mut text = serde_json::to_string_pretty(value).unwrap_or_default();
    text.push('\n');
    text.into_bytes()
}

fn list(flags: &Flags) -> Res<()> {
    let category = flag_str(flags, "category");
    if let Some(c) = category {
        let known = list_categories();
        if !known.contains(&c) {
            let issue = format!("unknown category \"{c}\" (known: {})", known.join(", "));
            return Err(invalid_options(issue.clone(), issue));
        }
    }
    let shapes = list_shapes(category);
    let en = |sh: &Value| sh.get("names").map_or("", |n| s(n, "en")).to_owned();
    if flag_on(flags, "json") {
        let rows: Vec<Value> = shapes
            .iter()
            .map(|sh| json!({"id": s(sh, "id"), "category": s(sh, "category"), "name": en(sh)}))
            .collect();
        stdout(&json_bytes(&Value::Array(rows)));
        return Ok(());
    }
    let w1 = shapes
        .iter()
        .map(|sh| s(sh, "id").chars().count())
        .max()
        .unwrap_or(0);
    let w2 = shapes
        .iter()
        .map(|sh| s(sh, "category").chars().count())
        .max()
        .unwrap_or(0);
    let text: String = shapes
        .iter()
        .map(|sh| {
            format!(
                "{:<w1$}  {:<w2$}  {}\n",
                s(sh, "id"),
                s(sh, "category"),
                en(sh)
            )
        })
        .collect();
    stdout(text.as_bytes());
    Ok(())
}

const INFO_FIELDS: [&str; 9] = [
    "id",
    "version",
    "category",
    "names",
    "aliases",
    "tags",
    "layers",
    "symmetry",
    "parameters",
];

fn info(shape_id: &str, flags: &Flags) -> Res<()> {
    let sh = get_shape(shape_id)?;
    if flag_on(flags, "json") {
        let obj: Map<String, Value> = INFO_FIELDS
            .iter()
            .map(|k| ((*k).to_owned(), sh.get(*k).cloned().unwrap_or(Value::Null)))
            .collect();
        stdout(&json_bytes(&Value::Object(obj)));
        return Ok(());
    }
    let words = |k: &str| {
        let a: Vec<&str> = arr(sh, k).iter().filter_map(Value::as_str).collect();
        if a.is_empty() {
            "-".to_owned()
        } else {
            a.join(", ")
        }
    };
    let names = sh.get("names").unwrap_or(&Value::Null);
    let kurdish = |k: &str| {
        let n = names.get(k).unwrap_or(&Value::Null);
        format!(
            "{} ({})",
            n.get("text").and_then(Value::as_str).unwrap_or("-"),
            s(n, "status")
        )
    };
    let mut lines = vec![
        format!("{}  {}", s(sh, "id"), s(names, "en")),
        format!("Category:    {}", s(sh, "category")),
        format!("Sorani:      {}", kurdish("ckb")),
        format!("Kurmanji:    {}", kurdish("kmr")),
        format!("Aliases:     {}", words("aliases")),
        format!("Tags:        {}", words("tags")),
        format!("Layers:      {}", words("layers")),
        format!(
            "Symmetry:    {}",
            js_str(sh.get("symmetry").unwrap_or(&Value::Null))
        ),
    ];
    let params: Vec<(&String, &Value)> = sh
        .get("parameters")
        .and_then(Value::as_object)
        .map(|m| m.iter().collect())
        .unwrap_or_default();
    if params.is_empty() {
        lines.push("Parameters:  -".to_owned());
    } else {
        lines.push("Parameters:".to_owned());
        let w = params
            .iter()
            .map(|(n, _)| n.chars().count())
            .max()
            .unwrap_or(0);
        let num = |p: &Value, k: &str| js_str(p.get(k).unwrap_or(&Value::Null));
        for (n, p) in params {
            let kind = match s(p, "type") {
                "integer" => format!("integer {} to {}", num(p, "min"), num(p, "max")),
                "enum" => format!(
                    "enum {}",
                    arr(p, "values")
                        .iter()
                        .filter_map(Value::as_str)
                        .collect::<Vec<_>>()
                        .join("|")
                ),
                _ => "boolean".to_owned(),
            };
            lines.push(format!(
                "  {n:<w$}  {kind}, default {}: {}",
                num(p, "default"),
                s(p, "description")
            ));
        }
    }
    stdout(format!("{}\n", lines.join("\n")).as_bytes());
    Ok(())
}

fn render_cmd(data: &Value, command: &Value, ids: &[String], flags: &Flags) -> Res<()> {
    let name = s(command, "name");
    let mut fmt = flag_str(flags, "format");
    if flag_on(flags, "layered") {
        if fmt.is_some_and(|f| f != "svg") {
            return Err(CliError::Usage(
                "--layered only works with --format svg".to_owned(),
                Some(name.to_owned()),
            ));
        }
        fmt = Some("svg-layered");
    }
    let fmt = port_format(data, fmt.unwrap_or("svg"))?;
    let items: Vec<Value> = ids.iter().map(|i| Value::from(i.as_str())).collect();
    let files = export_shapes(fmt, &items, &Value::Object(export_options(command, flags)))?;
    emit(
        name,
        files.into_iter().map(|f| (f.name, f.data)).collect(),
        flags,
    )
}

fn export_cmd(data: &Value, command: &Value, ids: &[String], flags: &Flags) -> Res<()> {
    let name = s(command, "name");
    let usage = |m: &str| CliError::Usage(m.to_owned(), Some(name.to_owned()));
    let every = flag_on(flags, "all");
    if every && !ids.is_empty() {
        return Err(usage("give shape ids or --all, not both"));
    }
    if !every && ids.is_empty() {
        return Err(usage("give shape ids or --all"));
    }
    let out = flag_str(flags, "out").unwrap_or(".");
    if out == "-" {
        return Err(usage("export writes files; --out - is not supported"));
    }
    let listed: Vec<&str> = flags.get("format").and_then(Value::as_array).map_or_else(
        || vec!["svg"],
        |a| a.iter().filter_map(Value::as_str).collect(),
    );
    let formats = listed
        .into_iter()
        .map(|f| port_format(data, f))
        .collect::<Res<Vec<_>>>()?;
    let items: Vec<Value> = if every {
        list_shapes(None)
            .iter()
            .map(|sh| Value::from(s(sh, "id")))
            .collect()
    } else {
        ids.iter().map(|i| Value::from(i.as_str())).collect()
    };
    let sizes: Vec<Value> = flags
        .get("sizes")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| vec![Value::from(24)]);
    let base = export_options(command, flags);
    let mut targets = Vec::new();
    for fmt in formats {
        for size in &sizes {
            let mut o = base.clone();
            if let Some(Value::Object(r)) = o.get_mut("render") {
                r.insert("size".to_owned(), size.clone());
            }
            for f in export_shapes(fmt, &items, &Value::Object(o))? {
                targets.push(File::new(
                    join_path(out, &[fmt, &js_str(size), &f.name]),
                    f.data,
                ));
            }
        }
    }
    write_all(&targets, flag_on(flags, "force"))
}

/// The flag file for the `flag` command: its name and contents.
fn flag_file(flags: &Flags) -> Res<(String, Vec<u8>)> {
    let variant = flag_str(flags, "variant").unwrap_or("full-color");
    let width = flags.get("width").and_then(Value::as_i64).unwrap_or(900);
    let fmt = flag_str(flags, "format").unwrap_or("svg");
    let mut options = Map::new();
    options.insert("variant".to_owned(), Value::from(variant));
    options.insert("width".to_owned(), Value::from(width));
    if let Some(title) = flags.get("title") {
        options.insert("title".to_owned(), title.clone());
    }
    let svg = render_flag(&Value::Object(options))?;
    let name = format!("kurdish-flag-{variant}.{fmt}");
    if fmt == "svg" {
        return Ok((name, format!("{svg}\n").into_bytes()));
    }
    let quality = flags.get("quality").and_then(Value::as_i64);
    let quality = match quality {
        Some(q) => match u8::try_from(q) {
            Ok(q) if q <= 100 => Some(q),
            _ => {
                let issue = format!("quality: must be 0 to 100 (got {q})");
                return Err(invalid_options(
                    format!("invalid flag options: {issue}"),
                    issue,
                ));
            }
        },
        None => None,
    };
    let current = to_hex(parse_color(
        flag_str(flags, "current-color").unwrap_or("#000000"),
        BLACK,
    )?);
    let matte = parse_color(flag_str(flags, "matte").unwrap_or("#ffffff"), BLACK)?;
    let kind = match fmt {
        "png" => RasterFormat::Png,
        "jpg" => RasterFormat::Jpg,
        "webp" => RasterFormat::Webp,
        other => return Err(CliError::NodeOnly(other.to_owned())),
    };
    #[allow(clippy::cast_precision_loss)]
    let data = encode_svg(
        &svg.replace("currentColor", &current),
        width as f64,
        kind,
        quality,
        matte,
    )?;
    Ok((name, data))
}

fn validate(file: &str) -> Res<()> {
    let Ok(meta) = std::fs::symlink_metadata(file) else {
        return Err(CliError::Io(format!("cannot read {file}: not found")));
    };
    if meta.file_type().is_symlink() {
        return Err(CliError::Io(format!(
            "{file} is a symbolic link; pass the real file"
        )));
    }
    if !meta.is_file() {
        return Err(CliError::Io(format!("{file} is not a regular file")));
    }
    if meta.len() > MAX_SPEC_BYTES as u64 {
        return Err(CliError::Io(format!(
            "{file} is larger than {} KB",
            MAX_SPEC_BYTES / 1024
        )));
    }
    let mut bytes = Vec::new();
    std::fs::File::open(file)
        .and_then(|fh| fh.take(MAX_SPEC_BYTES as u64 + 1).read_to_end(&mut bytes))
        .map_err(|e| CliError::Io(format!("cannot read {file}: {}", errno(&e))))?;
    let value: Value = serde_json::from_str(&String::from_utf8_lossy(&bytes))
        .map_err(|_| DeqError::new(ErrorCode::InvalidShape, format!("{file}: not valid JSON")))?;
    let (shape_id, count) = validate_spec(&value).map_err(|e| DeqError {
        code: e.code,
        message: format!("{file}: {}", e.message),
        issues: e.issues,
    })?;
    stdout(format!("{file}: ok ({shape_id}, {count} variants rendered)\n").as_bytes());
    Ok(())
}

fn dispatch(data: &Value, line: &[String]) -> Res<()> {
    let (command, args, flags) = match parse_args(data, line)? {
        Parsed::Text(text) => {
            stdout(text.as_bytes());
            return Ok(());
        }
        Parsed::Run {
            command,
            args,
            flags,
        } => (command, args, flags),
    };
    let first = args.first().map_or("", String::as_str);
    match s(command, "name") {
        "list" => list(&flags),
        "info" => info(first, &flags),
        "render" => render_cmd(data, command, &args, &flags),
        "export" => export_cmd(data, command, &args, &flags),
        "flag" => emit("flag", vec![flag_file(&flags)?], &flags),
        "validate" => validate(first),
        _ => {
            stdout(
                data.get("completions")
                    .map_or("", |c| s(c, first))
                    .as_bytes(),
            );
            Ok(())
        }
    }
}

/// Run the CLI and return the exit code.
fn run(argv: &[String]) -> u8 {
    let data: Value = match serde_json::from_str(include_str!("../data/cli.json")) {
        Ok(d) => d,
        Err(e) => {
            stderr(&format!("deq: error: broken CLI data: {e}\n"));
            return 1;
        }
    };
    let name = s(&data, "name");
    match dispatch(&data, argv) {
        Ok(()) => 0,
        Err(CliError::Usage(msg, command)) => {
            let target = command.map_or_else(|| name.to_owned(), |c| format!("{name} {c}"));
            stderr(&format!(
                "{name}: error: {msg}\nRun \"{target} --help\" for usage.\n"
            ));
            2
        }
        Err(e) => {
            stderr(&format!("{name}: error: {e}\n"));
            match e {
                CliError::Io(_) => 3,
                CliError::NodeOnly(_) => EXIT_NODE_ONLY,
                _ => 1,
            }
        }
    }
}

fn main() -> ExitCode {
    let argv: Vec<String> = std::env::args_os()
        .skip(1)
        .map(|a| a.to_string_lossy().into_owned())
        .collect();
    ExitCode::from(run(&argv))
}
