//! Where output files go: `--out` handling, overwrite checks and writing.

use crate::CliError;
use crate::parse::Flags;
use serde_json::Value;
use std::path::{MAIN_SEPARATOR, Path, PathBuf};

/// A file to write: the path shown in messages, the real path and the bytes.
pub struct File {
    display: String,
    path: PathBuf,
    data: Vec<u8>,
}

impl File {
    /// A file at `display`, relative to the working directory unless absolute.
    pub fn new(display: String, data: Vec<u8>) -> Self {
        let path = std::path::absolute(&display).unwrap_or_else(|_| PathBuf::from(&display));
        Self {
            display,
            path,
            data,
        }
    }
}

fn ends_with_sep(s: &str) -> bool {
    s.ends_with('/') || s.ends_with('\\')
}

/// Join with the platform separator unless `dir` already ends with one.
pub fn join_path(dir: &str, names: &[&str]) -> String {
    let mut out = dir.to_owned();
    for name in names {
        if !ends_with_sep(&out) {
            out.push(MAIN_SEPARATOR);
        }
        out.push_str(name);
    }
    out
}

/// The errno name of an I/O error, as Python and Node report it.
pub fn errno(e: &std::io::Error) -> &'static str {
    use std::io::ErrorKind as K;
    match e.kind() {
        K::NotFound => "ENOENT",
        K::PermissionDenied => "EACCES",
        K::NotADirectory => "ENOTDIR",
        K::IsADirectory => "EISDIR",
        K::AlreadyExists => "EEXIST",
        K::ReadOnlyFilesystem => "EROFS",
        K::StorageFull => "ENOSPC",
        _ => "error",
    }
}

/// Check every target first (nothing is written if one fails), then write them all.
///
/// # Errors
/// [`CliError::Io`] when a target exists without `force`, is not a regular file, or cannot be
/// written.
pub fn write_all(targets: &[File], force: bool) -> Result<(), CliError> {
    for t in targets {
        let Ok(meta) = std::fs::symlink_metadata(&t.path) else {
            continue;
        };
        if !force {
            return Err(CliError::Io(format!(
                "{} exists; use --force to overwrite",
                t.display
            )));
        }
        if !meta.file_type().is_file() {
            return Err(CliError::Io(format!("{} is not a regular file", t.display)));
        }
    }
    for t in targets {
        t.path
            .parent()
            .map_or(Ok(()), std::fs::create_dir_all)
            .and_then(|()| std::fs::write(&t.path, &t.data))
            .map_err(|e| CliError::Io(format!("cannot write {}: {}", t.display, errno(&e))))?;
    }
    Ok(())
}

/// Write command output: to stdout for `--out -`, else to files (see [`write_all`]).
///
/// `--out` names the file when there is one, else a directory (also when it ends with a
/// separator or is an existing directory).
///
/// # Errors
/// [`CliError::Usage`] when `--out -` gets more than one file, and the errors of [`write_all`].
pub fn emit(command: &str, files: Vec<(String, Vec<u8>)>, flags: &Flags) -> Result<(), CliError> {
    let force = flags.get("force") == Some(&Value::Bool(true));
    let targets: Vec<File> = match flags.get("out").and_then(Value::as_str) {
        Some("-") => {
            let count = files.len();
            let mut files = files.into_iter();
            return match (files.next(), count) {
                (Some((_, data)), 1) => {
                    crate::stdout(&data);
                    Ok(())
                }
                _ => Err(CliError::Usage(
                    format!("--out - writes one file, but this makes {count}"),
                    Some(command.to_owned()),
                )),
            };
        }
        None => files.into_iter().map(|(n, d)| File::new(n, d)).collect(),
        Some(out) => {
            let is_dir = std::fs::symlink_metadata(Path::new(out)).is_ok_and(|m| m.is_dir());
            if files.len() == 1 && !ends_with_sep(out) && !is_dir {
                files
                    .into_iter()
                    .map(|(_, d)| File::new(out.to_owned(), d))
                    .collect()
            } else {
                files
                    .into_iter()
                    .map(|(n, d)| File::new(join_path(out, &[&n]), d))
                    .collect()
            }
        }
    };
    write_all(&targets, force)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_once_per_separator() {
        let sep = MAIN_SEPARATOR;
        assert_eq!(join_path("out", &["a", "b"]), format!("out{sep}a{sep}b"));
        assert_eq!(join_path("out/", &["a"]), "out/a");
        assert_eq!(join_path("out\\", &["a"]), "out\\a");
    }

    #[test]
    fn names_io_errors() {
        assert_eq!(
            errno(&std::io::Error::from(std::io::ErrorKind::NotFound)),
            "ENOENT"
        );
        assert_eq!(errno(&std::io::Error::other("x")), "error");
    }
}
