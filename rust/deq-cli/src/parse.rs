//! Command-line parsing against the generated CLI description (`data/cli.json`).

use crate::CliError;
use deq_shapes::format::number_value;
use serde_json::{Map, Value};

/// Parsed flag values by flag name. Pairs are arrays of `[name, value]` arrays.
pub type Flags = Map<String, Value>;

/// A parsed command line: text to print (help, version) or a command to run.
pub enum Parsed<'a> {
    /// Print this and exit 0.
    Text(String),
    /// Run a command.
    Run {
        /// The command description.
        command: &'a Value,
        /// Positional arguments.
        args: Vec<String>,
        /// Flag values.
        flags: Flags,
    },
}

/// A string field of a JSON object, or `""`.
pub fn s<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}

/// An array field of a JSON object, or `[]`.
pub fn arr<'a>(v: &'a Value, key: &str) -> &'a [Value] {
    v.get(key)
        .and_then(Value::as_array)
        .map_or(&[], Vec::as_slice)
}

fn strs<'a>(v: &'a Value, key: &str) -> Vec<&'a str> {
    arr(v, key).iter().filter_map(Value::as_str).collect()
}

fn digits(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit())
}

/// `-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)`.
pub fn is_number(raw: &str) -> bool {
    let body = raw.strip_prefix('-').unwrap_or(raw);
    match body.split_once('.') {
        None => digits(body),
        Some((a, b)) => (a.is_empty() || digits(a)) && digits(b),
    }
}

fn is_uint(raw: &str) -> bool {
    digits(raw) && raw.len() <= 9
}

fn is_int(raw: &str) -> bool {
    is_uint(raw.strip_prefix('-').unwrap_or(raw))
}

fn number(raw: &str) -> Value {
    number_value(raw.parse::<f64>().unwrap_or(0.0))
}

fn integer(raw: &str) -> Value {
    Value::from(raw.parse::<i64>().unwrap_or(0))
}

/// A `--param` value: true, false, a number or a string.
pub fn param_value(raw: &str) -> Value {
    match raw {
        "true" => Value::Bool(true),
        "false" => Value::Bool(false),
        _ if is_number(raw) => number(raw),
        _ => Value::from(raw),
    }
}

fn usage(msg: impl Into<String>, command: &str) -> CliError {
    CliError::Usage(msg.into(), Some(command.to_owned()))
}

fn convert(flag: &Value, raw: &str, command: &str) -> Result<Value, CliError> {
    let name = s(flag, "name");
    let kind = s(flag, "type");
    let choices = strs(flag, "choices");
    let fail = |what: &str| usage(format!("option --{name}: \"{raw}\" {what}"), command);
    match kind {
        "number" if !is_number(raw) => Err(fail("is not a number")),
        "number" => Ok(number(raw)),
        "int" if !is_int(raw) => Err(fail("is not an integer")),
        "int" => Ok(integer(raw)),
        "choice" if !choices.contains(&raw) => {
            Err(fail(&format!("is not one of {}", choices.join(", "))))
        }
        "list" | "intlist" => {
            let items: Vec<&str> = raw.split(',').collect();
            let mut seen: Vec<&str> = Vec::new();
            for item in &items {
                if kind == "list" && !choices.contains(item) {
                    return Err(usage(
                        format!(
                            "option --{name}: \"{item}\" is not one of {}",
                            choices.join(", ")
                        ),
                        command,
                    ));
                }
                if kind == "intlist" && !is_uint(item) {
                    return Err(usage(
                        format!("option --{name}: \"{item}\" is not an integer"),
                        command,
                    ));
                }
                if seen.contains(item) {
                    return Err(usage(
                        format!("option --{name} lists \"{item}\" twice"),
                        command,
                    ));
                }
                seen.push(item);
            }
            Ok(Value::Array(
                items
                    .into_iter()
                    .map(|i| {
                        if kind == "list" {
                            Value::from(i)
                        } else {
                            integer(i)
                        }
                    })
                    .collect(),
            ))
        }
        _ => Ok(Value::from(raw)),
    }
}

fn check_args(command: &Value, args: &[String]) -> Result<(), CliError> {
    let name = s(command, "name");
    let Some(spec) = arr(command, "args").first() else {
        return match args.first() {
            Some(a) => Err(usage(format!("unexpected argument \"{a}\""), name)),
            None => Ok(()),
        };
    };
    let flag = |k: &str| spec.get(k).and_then(Value::as_bool).unwrap_or(false);
    let label = format!(
        "<{}{}>",
        s(spec, "name"),
        if flag("variadic") { "..." } else { "" }
    );
    if args.is_empty() && !flag("optional") {
        return Err(usage(format!("missing argument {label}"), name));
    }
    if !flag("variadic") && args.len() > 1 {
        return Err(usage(format!("unexpected argument \"{}\"", args[1]), name));
    }
    let choices = strs(spec, "choices");
    if !choices.is_empty() {
        if let Some(a) = args.iter().find(|a| !choices.contains(&a.as_str())) {
            return Err(usage(
                format!(
                    "argument {label}: \"{a}\" is not one of {}",
                    choices.join(", ")
                ),
                name,
            ));
        }
    }
    Ok(())
}

/// Parse a command line against the CLI description.
///
/// # Errors
/// [`CliError::Usage`] when the command line is wrong.
#[allow(clippy::too_many_lines)]
pub fn parse_args<'a>(data: &'a Value, argv: &[String]) -> Result<Parsed<'a>, CliError> {
    let version = || Parsed::Text(format!("{} {}\n", s(data, "name"), s(data, "version")));
    let help = |name: &str| Parsed::Text(data.get("help").map_or("", |h| s(h, name)).to_owned());
    let Some(first) = argv.first() else {
        return Err(CliError::Usage("missing command".to_owned(), None));
    };
    match first.as_str() {
        "-h" | "--help" => return Ok(help("")),
        "-V" | "--version" => return Ok(version()),
        f if f.starts_with('-') => {
            return Err(CliError::Usage(format!("unknown option {f}"), None));
        }
        _ => {}
    }
    let Some(command) = arr(data, "commands").iter().find(|c| s(c, "name") == first) else {
        return Err(CliError::Usage(
            format!("unknown command \"{first}\""),
            None,
        ));
    };
    let name = s(command, "name");
    let mut flags = Flags::new();
    let mut positional: Vec<String> = Vec::new();
    let mut rest = false;
    let mut i = 1;
    while i < argv.len() {
        let tok = argv[i].as_str();
        i += 1;
        if rest || tok == "-" || !tok.starts_with('-') {
            positional.push(tok.to_owned());
            continue;
        }
        if tok == "--" {
            rest = true;
            continue;
        }
        if tok == "-h" {
            return Ok(help(name));
        }
        if tok == "-V" {
            return Ok(version());
        }
        let Some(body) = tok.strip_prefix("--") else {
            return Err(usage(format!("unknown option {tok}"), name));
        };
        let (key, inline) = match body.split_once('=') {
            Some((k, v)) => (k, Some(v)),
            None => (body, None),
        };
        if inline.is_none() && (key == "help" || key == "version") {
            return Ok(if key == "help" { help(name) } else { version() });
        }
        let Some(flag) = arr(command, "flags").iter().find(|f| s(f, "name") == key) else {
            return Err(usage(format!("unknown option --{key}"), name));
        };
        let kind = s(flag, "type");
        if kind == "bool" {
            if inline.is_some() {
                return Err(usage(format!("option --{key} takes no value"), name));
            }
            if flags.contains_key(key) {
                return Err(usage(format!("option --{key} given twice"), name));
            }
            flags.insert(key.to_owned(), Value::Bool(true));
            continue;
        }
        let raw = match inline {
            Some(v) => v,
            None if i < argv.len() => {
                i += 1;
                argv[i - 1].as_str()
            }
            None => return Err(usage(format!("option --{key} needs a value"), name)),
        };
        if kind == "pair" {
            let Some((k, v)) = raw.split_once('=').filter(|(k, _)| !k.is_empty()) else {
                let what = flag
                    .get("value")
                    .and_then(Value::as_str)
                    .unwrap_or("name=value");
                return Err(usage(
                    format!("option --{key}: \"{raw}\" is not {what}"),
                    name,
                ));
            };
            let entry = flags
                .entry(key.to_owned())
                .or_insert_with(|| Value::Array(Vec::new()));
            if let Value::Array(pairs) = entry {
                if pairs
                    .iter()
                    .any(|p| p.get(0).and_then(Value::as_str) == Some(k))
                {
                    return Err(usage(format!("option --{key} sets \"{k}\" twice"), name));
                }
                pairs.push(Value::Array(vec![Value::from(k), Value::from(v)]));
            }
            continue;
        }
        if flags.contains_key(key) {
            return Err(usage(format!("option --{key} given twice"), name));
        }
        flags.insert(key.to_owned(), convert(flag, raw, name)?);
    }
    check_args(command, &positional)?;
    Ok(Parsed::Run {
        command,
        args: positional,
        flags,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_follow_the_shared_pattern() {
        for ok in ["0", "-1", "1.5", ".5", "-.5", "12"] {
            assert!(is_number(ok), "{ok}");
        }
        for bad in ["", "-", "1.", "1e5", "1.2.3", "+1", "a"] {
            assert!(!is_number(bad), "{bad}");
        }
        assert_eq!(number("-.5"), Value::from(-0.5));
        assert_eq!(number("-0"), Value::from(0));
        assert_eq!(param_value("2.0"), Value::from(2));
        assert_eq!(param_value("x"), Value::from("x"));
    }

    #[test]
    fn integers_have_at_most_nine_digits() {
        assert!(is_int("-123456789"));
        assert!(!is_int("1234567890"));
        assert!(!is_uint("-1"));
    }
}
