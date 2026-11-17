//! Compiled regular expressions for constant patterns.

use regex::Regex;

/// Matches nothing.
const NOTHING: &str = r"[^\s\S]";

/// Compile a constant pattern. Every pattern in the crate is valid and exercised by tests; an
/// invalid one would match nothing instead of panicking.
pub(crate) fn compile(pattern: &str) -> Regex {
    Regex::new(pattern).unwrap_or_else(|_| compile(NOTHING))
}
