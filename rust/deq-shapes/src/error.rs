//! The only error type the library returns.

use std::fmt;

/// Stable error codes, the same in every port.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCode {
    /// No shape has this id.
    UnknownShape,
    /// Render, export or flag options are invalid.
    InvalidOptions,
    /// A shape parameter value is invalid.
    InvalidParameter,
    /// A shape description is invalid.
    InvalidShape,
    /// A shape expands to too much geometry.
    LimitExceeded,
}

impl ErrorCode {
    /// The code as the TypeScript reference spells it.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::UnknownShape => "UNKNOWN_SHAPE",
            Self::InvalidOptions => "INVALID_OPTIONS",
            Self::InvalidParameter => "INVALID_PARAMETER",
            Self::InvalidShape => "INVALID_SHAPE",
            Self::LimitExceeded => "LIMIT_EXCEEDED",
        }
    }
}

/// Why an operation failed. `code` is stable; the message is for people.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeqError {
    /// The stable error code.
    pub code: ErrorCode,
    /// A message for people.
    pub message: String,
    /// Validation problems, one line each (for `InvalidOptions`).
    pub issues: Vec<String>,
}

impl DeqError {
    /// An error without separate issues.
    #[must_use]
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            issues: Vec::new(),
        }
    }

    /// An `InvalidOptions` error: `"<prefix>: <issues joined by '; '>"`.
    #[must_use]
    pub fn options(prefix: &str, issues: Vec<String>) -> Self {
        Self {
            code: ErrorCode::InvalidOptions,
            message: format!("{prefix}: {}", issues.join("; ")),
            issues,
        }
    }
}

impl fmt::Display for DeqError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for DeqError {}

/// The result type of the library.
pub type Result<T> = std::result::Result<T, DeqError>;
