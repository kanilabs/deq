//! Deterministic number and text formatting, identical to the TypeScript reference (ADR 0008).

use serde_json::Value;

/// Round half to even (banker's rounding) on a finite double.
#[must_use]
pub fn round_half_even(v: f64) -> f64 {
    let f = v.floor();
    let d = v - f;
    if d > 0.5 {
        f + 1.0
    } else if d < 0.5 || f % 2.0 == 0.0 {
        f
    } else {
        f + 1.0
    }
}

/// Format a number with at most 3 decimals, without trailing zeros and with -0 as 0.
#[must_use]
#[allow(clippy::cast_possible_truncation)]
pub fn num(x: f64) -> String {
    // Coordinates stay far below 2^53 / 1000, so the conversion is exact.
    let k = round_half_even(x * 1000.0) as i64;
    if k == 0 {
        return "0".to_owned();
    }
    let sign = if k < 0 { "-" } else { "" };
    let a = k.unsigned_abs();
    let (whole, frac) = (a / 1000, a % 1000);
    if frac == 0 {
        return format!("{sign}{whole}");
    }
    let digits = format!("{frac:03}");
    format!("{sign}{whole}.{}", digits.trim_end_matches('0'))
}

/// Escape text for XML character data and double-quoted attributes; drop invalid characters.
#[must_use]
pub fn escape_xml(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            '\u{0}'..='\u{8}'
            | '\u{b}'
            | '\u{c}'
            | '\u{e}'..='\u{1f}'
            | '\u{fffe}'
            | '\u{ffff}' => {}
            _ => out.push(c),
        }
    }
    out
}

/// JavaScript `Math.round`: halves round up.
#[must_use]
pub fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

/// JavaScript `%`: the remainder takes the sign of the dividend.
#[must_use]
pub fn js_mod(a: f64, b: f64) -> f64 {
    a % b
}

/// A finite JSON number (booleans are not numbers).
#[must_use]
pub fn is_number(v: &Value) -> bool {
    v.as_f64().is_some_and(f64::is_finite)
}

/// JavaScript `Number.isInteger`.
#[must_use]
pub fn is_integer(v: &Value) -> bool {
    v.as_f64()
        .is_some_and(|x| x.is_finite() && x.fract() == 0.0)
}

/// JavaScript `String(n)` for a number.
#[must_use]
pub fn js_number(x: f64) -> String {
    if x.is_nan() {
        return "NaN".to_owned();
    }
    if x.is_infinite() {
        return if x > 0.0 { "Infinity" } else { "-Infinity" }.to_owned();
    }
    if x == 0.0 {
        return "0".to_owned();
    }
    let sign = if x < 0.0 { "-" } else { "" };
    // Rust prints the shortest digits that round-trip, as JavaScript does.
    let e = format!("{:e}", x.abs());
    let (mantissa, exp) = e.split_once('e').unwrap_or((e.as_str(), "0"));
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    let k = i64::try_from(digits.len()).unwrap_or(i64::MAX);
    let n = exp.parse::<i64>().unwrap_or(0) + 1;
    let body = if k <= n && n <= 21 {
        format!(
            "{digits}{}",
            "0".repeat(usize::try_from(n - k).unwrap_or(0))
        )
    } else if 0 < n && n <= 21 {
        let (a, b) = digits.split_at(usize::try_from(n).unwrap_or(0));
        format!("{a}.{b}")
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat(usize::try_from(-n).unwrap_or(0)))
    } else {
        let (first, rest) = digits.split_at(1);
        let dot = if rest.is_empty() { "" } else { "." };
        let s = if n - 1 < 0 { "-" } else { "+" };
        format!("{first}{dot}{rest}e{s}{}", (n - 1).abs())
    };
    format!("{sign}{body}")
}

/// JavaScript `String(v)` for the JSON values the messages use.
#[must_use]
pub fn js_str(v: &Value) -> String {
    match v {
        Value::Null => "null".to_owned(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.as_f64().map_or_else(|| n.to_string(), js_number),
        Value::String(s) => s.clone(),
        Value::Array(a) => a
            .iter()
            .map(|x| {
                if x.is_null() {
                    String::new()
                } else {
                    js_str(x)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".to_owned(),
    }
}

/// JavaScript `JSON.stringify` for a string.
#[must_use]
pub fn json_string(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_default()
}

/// JavaScript `JSON.stringify` for a scalar.
#[must_use]
pub fn js_json(v: &Value) -> String {
    match v {
        Value::String(s) => json_string(s),
        _ => js_str(v),
    }
}

/// JavaScript `===` for JSON scalars (`1 !== true`).
#[must_use]
pub fn js_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
        (Value::Bool(x), Value::Bool(y)) => x == y,
        (Value::String(x), Value::String(y)) => x == y,
        (Value::Null, Value::Null) => true,
        _ => false,
    }
}

/// JavaScript `Number.prototype.toFixed`: exact decimal value, ties away from zero.
#[must_use]
pub fn js_to_fixed(x: f64, digits: usize) -> String {
    // 1100 decimals hold the exact value of any double.
    let exact = format!("{:.1100}", x.abs());
    let (int, frac) = exact.split_once('.').unwrap_or((exact.as_str(), ""));
    let mut kept: Vec<u8> = format!("{int}{}", &frac[..digits.min(frac.len())]).into_bytes();
    if frac.as_bytes().get(digits).is_some_and(|d| *d >= b'5') {
        let mut i = kept.len();
        loop {
            if i == 0 {
                kept.insert(0, b'1');
                break;
            }
            i -= 1;
            if kept[i] == b'9' {
                kept[i] = b'0';
            } else {
                kept[i] += 1;
                break;
            }
        }
    }
    let s = String::from_utf8(kept).unwrap_or_default();
    let (a, b) = s.split_at(s.len() - digits);
    let body = if digits == 0 {
        a.to_owned()
    } else {
        format!("{a}.{b}")
    };
    if x < 0.0 { format!("-{body}") } else { body }
}

/// The first `n` characters of `s`.
#[must_use]
pub fn take_chars(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

/// A number as JSON: an integer when it is one (as JavaScript prints it), else a float.
#[must_use]
#[allow(clippy::cast_possible_truncation)]
pub fn number_value(x: f64) -> Value {
    if x.fract() == 0.0 && x.abs() < 9_007_199_254_740_992.0 {
        Value::from(x as i64)
    } else {
        Value::from(x)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn formats_numbers() {
        assert_eq!(num(0.0005), "0");
        assert_eq!(num(0.0015), "0.002");
        assert_eq!(num(-0.0001), "0");
        assert_eq!(num(-1.5), "-1.5");
        assert_eq!(num(12.0), "12");
        assert_eq!(round_half_even(2.5), 2.0);
        assert_eq!(round_half_even(3.5), 4.0);
    }

    #[test]
    fn js_numbers() {
        for (x, s) in [
            (1e21, "1e+21"),
            (1e-7, "1e-7"),
            (0.000_001, "0.000001"),
            (123.456, "123.456"),
            (-0.5, "-0.5"),
            (1.5e300, "1.5e+300"),
            (100.0, "100"),
            (f64::NAN, "NaN"),
            (f64::NEG_INFINITY, "-Infinity"),
        ] {
            assert_eq!(js_number(x), s);
        }
        assert_eq!(js_str(&json!([1, null, "a"])), "1,,a");
        assert_eq!(js_str(&json!({})), "[object Object]");
        assert_eq!(js_json(&json!("a\"b")), "\"a\\\"b\"");
    }

    #[test]
    fn to_fixed() {
        assert_eq!(js_to_fixed(-0.0001, 3), "-0.000");
        assert_eq!(js_to_fixed(-0.0, 3), "0.000");
        assert_eq!(js_to_fixed(0.0625, 3), "0.063");
        assert_eq!(js_to_fixed(9.9996, 3), "10.000");
        assert_eq!(js_to_fixed(1.005, 2), "1.00");
        assert_eq!(js_to_fixed(2.5, 0), "3");
    }

    #[test]
    fn escapes_and_compares() {
        assert_eq!(
            escape_xml("a<&>\"'\u{1}\u{ffff}b"),
            "a&lt;&amp;&gt;&quot;&#39;b"
        );
        assert!(js_equal(&json!(1), &json!(1.0)));
        assert!(!js_equal(&json!(1), &json!(true)));
        assert!(js_equal(&json!(null), &json!(null)));
        assert_eq!(number_value(2.0), json!(2));
        assert_eq!(number_value(2.5), json!(2.5));
        assert!(is_integer(&json!(3.0)) && !is_integer(&json!(true)));
    }
}
