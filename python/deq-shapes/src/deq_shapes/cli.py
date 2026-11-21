"""The ``deq`` command line tool: the interface of ``spec/cli.json`` (ADR 0011).

Help, messages and exit codes match the Node and Rust CLIs. Formats outside the core subset
exit with code 4 and point to the Node CLI.
"""

import errno
import json
import os
import re
import stat
import sys
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from ._data import load
from ._format import js_round, js_str
from .color import parse_color, to_hex
from .errors import DeqError
from .export import export_shapes
from .flag import render_flag
from .leet import decode_leet, leet
from .patterns import pattern
from .raster import RasterFormat, encode_svg
from .registry import Shape, get_shape, list_categories, list_shapes
from .validate import MAX_SPEC_BYTES, validate_spec

Flags = dict[str, Any]
Writer = Callable[[bytes], None]

_NUMBER = re.compile(r"-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)")
_INT = re.compile(r"-?[0-9]{1,10}")  # 10 digits, so seeds up to 4294967295 fit
_UINT = re.compile(r"[0-9]{1,9}")
_PAIR = re.compile(r"([^=]+)=(.*)", re.DOTALL)
_ENDS_WITH_SEP = re.compile(r"[/\\]\Z")
_SVG_SIZE = re.compile(r'<svg [^>]*? width="([0-9.]+)" height="([0-9.]+)"')
#: Largest raster image side, in px.
MAX_PX = 8192
#: Largest SVG ``deq leet --decode`` reads, in bytes.
MAX_DECODE_BYTES = 4 * 1024 * 1024
#: Exit code for formats only the Node CLI writes.
EXIT_NODE_ONLY = 4


class UsageError(Exception):
    """The command line is wrong (exit code 2)."""

    def __init__(self, message: str, command: str | None) -> None:
        super().__init__(message)
        self.command = command


class IoError(Exception):
    """A file could not be read or written (exit code 3)."""


class NodeOnlyError(Exception):
    """The format is only in the Node CLI (exit code 4)."""

    def __init__(self, fmt: str) -> None:
        super().__init__(f'format "{fmt}" is only available in the Node CLI (npx @0xdolan/deq-cli)')


@dataclass(frozen=True, slots=True)
class Io:
    """Where the CLI reads and writes; tests pass their own."""

    cwd: str
    stdout: Writer
    stderr: Writer


@dataclass(frozen=True, slots=True)
class Parsed:
    """A parsed command line: ``text`` for help and version, else a command to run."""

    text: str | None = None
    command: Mapping[str, Any] | None = None
    args: tuple[str, ...] = ()
    flags: Mapping[str, Any] | None = None


def cli_data() -> dict[str, Any]:
    """The CLI description generated from ``spec/cli.json``."""
    data: dict[str, Any] = load("cli.json")
    return data


def _number(raw: str) -> int | float:
    n = float(raw)
    return int(n) if n.is_integer() else n


def param_value(raw: str) -> bool | int | float | str:
    """A ``--param`` value: true, false, a number or a string."""
    if raw == "true":
        return True
    if raw == "false":
        return False
    return _number(raw) if _NUMBER.fullmatch(raw) else raw


def join_path(directory: str, *names: str) -> str:
    """Join with the platform separator unless ``directory`` already ends with one."""
    out = directory
    for name in names:
        out = f"{out}{name}" if _ENDS_WITH_SEP.search(out) else f"{out}{os.sep}{name}"
    return out


# ---------------------------------------------------------------- parsing


def _convert(flag: Mapping[str, Any], raw: str, command: str) -> Any:
    name, kind = flag["name"], flag["type"]
    choices: list[str] = flag.get("choices") or []

    def fail(what: str) -> UsageError:
        return UsageError(f'option --{name}: "{raw}" {what}', command)

    if kind == "number":
        if not _NUMBER.fullmatch(raw):
            raise fail("is not a number")
        return _number(raw)
    if kind == "int":
        if not _INT.fullmatch(raw):
            raise fail("is not an integer")
        return int(raw)
    if kind == "choice":
        if raw not in choices:
            raise fail(f"is not one of {', '.join(choices)}")
        return raw
    if kind in ("list", "intlist"):
        items = raw.split(",")
        # A list without choices (colours, shape ids) is free text and may repeat items.
        if kind == "list" and "choices" not in flag:
            return items
        seen: set[str] = set()
        for item in items:
            if kind == "list" and item not in choices:
                msg = f'option --{name}: "{item}" is not one of {", ".join(choices)}'
                raise UsageError(msg, command)
            if kind == "intlist" and not _UINT.fullmatch(item):
                raise UsageError(f'option --{name}: "{item}" is not an integer', command)
            if item in seen:
                raise UsageError(f'option --{name} lists "{item}" twice', command)
            seen.add(item)
        return items if kind == "list" else [int(i) for i in items]
    return raw


def _check_args(command: Mapping[str, Any], args: Sequence[str]) -> None:
    name = command["name"]
    specs = command.get("args") or []
    if not specs:
        if args:
            raise UsageError(f'unexpected argument "{args[0]}"', name)
        return
    spec = specs[0]
    label = f"<{spec['name']}{'...' if spec.get('variadic') else ''}>"
    if not args and not spec.get("optional"):
        raise UsageError(f"missing argument {label}", name)
    if not spec.get("variadic") and len(args) > 1:
        raise UsageError(f'unexpected argument "{args[1]}"', name)
    choices = spec.get("choices")
    if choices:
        for a in args:
            if a not in choices:
                msg = f'argument {label}: "{a}" is not one of {", ".join(choices)}'
                raise UsageError(msg, name)


def parse_args(data: Mapping[str, Any], argv: Sequence[str]) -> Parsed:
    """Parse a command line against the CLI description."""
    version = Parsed(text=f"{data['name']} {data['version']}\n")
    if not argv:
        raise UsageError("missing command", None)
    first = argv[0]
    if first in ("-h", "--help"):
        return Parsed(text=data["help"].get("", ""))
    if first in ("-V", "--version"):
        return version
    if first.startswith("-"):
        raise UsageError(f"unknown option {first}", None)
    command = next((c for c in data["commands"] if c["name"] == first), None)
    if command is None:
        raise UsageError(f'unknown command "{first}"', None)
    name = command["name"]
    help_text = Parsed(text=data["help"].get(name, ""))
    flags: Flags = {}
    args: list[str] = []
    rest = False
    i = 1
    while i < len(argv):
        tok = argv[i]
        i += 1
        if rest or tok == "-" or not tok.startswith("-"):
            args.append(tok)
            continue
        if tok == "--":
            rest = True
            continue
        if tok == "-h":
            return help_text
        if tok == "-V":
            return version
        if not tok.startswith("--"):
            raise UsageError(f"unknown option {tok}", name)
        key, eq, value = tok[2:].partition("=")
        inline = value if eq else None
        if key in ("help", "version") and inline is None:
            return help_text if key == "help" else version
        flag = next((f for f in command["flags"] if f["name"] == key), None)
        if flag is None:
            raise UsageError(f"unknown option --{key}", name)
        if flag["type"] == "bool":
            if inline is not None:
                raise UsageError(f"option --{key} takes no value", name)
            if key in flags:
                raise UsageError(f"option --{key} given twice", name)
            flags[key] = True
            continue
        raw = inline
        if raw is None and i < len(argv):
            raw = argv[i]
            i += 1
        if raw is None:
            raise UsageError(f"option --{key} needs a value", name)
        if flag["type"] == "pair":
            m = _PAIR.fullmatch(raw)
            if not m:
                raise UsageError(
                    f'option --{key}: "{raw}" is not {flag.get("value", "name=value")}', name
                )
            pairs: list[tuple[str, str]] = flags.get(key, [])
            if any(p == m.group(1) for p, _ in pairs):
                raise UsageError(f'option --{key} sets "{m.group(1)}" twice', name)
            flags[key] = [*pairs, (m.group(1), m.group(2))]
            continue
        if key in flags:
            raise UsageError(f"option --{key} given twice", name)
        flags[key] = _convert(flag, raw, name)
    _check_args(command, args)
    return Parsed(command=command, args=tuple(args), flags=flags)


# ---------------------------------------------------------------- output


def _render_options(command: Mapping[str, Any], flags: Mapping[str, Any]) -> dict[str, Any]:
    o: dict[str, Any] = {}
    for f in command["flags"]:
        option, value = f.get("option"), flags.get(f["name"])
        if option is None or value is None:
            continue
        if f["type"] == "pair":
            o[option] = {k: param_value(v) if option == "params" else v for k, v in value}
        else:
            o[option] = value
    return o


def _export_options(command: Mapping[str, Any], flags: Mapping[str, Any]) -> dict[str, Any]:
    o: dict[str, Any] = {"render": _render_options(command, flags)}
    for flag, key in (
        ("current-color", "currentColor"),
        ("matte", "matte"),
        ("quality", "quality"),
    ):
        if flags.get(flag) is not None:
            o[key] = flags[flag]
    return o


def _lstat(path: str) -> os.stat_result | None:
    try:
        return os.lstat(path)
    except OSError:
        return None


def _resolve(io: Io, path: str) -> str:
    return os.path.abspath(os.path.join(io.cwd, path))


def _bytes(data: str | bytes) -> bytes:
    return data.encode("utf-8") if isinstance(data, str) else data


@dataclass(frozen=True, slots=True)
class _Target:
    display: str
    path: str
    data: str | bytes


def _targets(
    io: Io, files: Sequence[tuple[str, str | bytes]], out: str | None
) -> list[_Target] | None:
    if out == "-":
        return None
    if out is None:
        return [_Target(n, _resolve(io, n), d) for n, d in files]
    st = _lstat(_resolve(io, out))
    as_dir = (
        len(files) != 1
        or bool(_ENDS_WITH_SEP.search(out))
        or (st is not None and stat.S_ISDIR(st.st_mode))
    )
    if not as_dir:
        return [_Target(out, _resolve(io, out), files[0][1])]
    return [_Target(join_path(out, n), _resolve(io, join_path(out, n)), d) for n, d in files]


def _write_all(targets: Sequence[_Target], force: bool) -> None:
    for t in targets:
        st = _lstat(t.path)
        if st is None:
            continue
        if not force:
            msg = f"{t.display} exists; use --force to overwrite"
            raise IoError(msg)
        if not stat.S_ISREG(st.st_mode):
            msg = f"{t.display} is not a regular file"
            raise IoError(msg)
    for t in targets:
        try:
            os.makedirs(os.path.dirname(t.path), exist_ok=True)
            with open(t.path, "wb") as fh:
                fh.write(_bytes(t.data))
        except OSError as error:
            code = errno.errorcode.get(error.errno or 0, "error")
            msg = f"cannot write {t.display}: {code}"
            raise IoError(msg) from None


def _emit(
    io: Io, command: str, files: Sequence[tuple[str, str | bytes]], flags: Mapping[str, Any]
) -> None:
    targets = _targets(io, files, flags.get("out"))
    if targets is None:
        if len(files) != 1:
            raise UsageError(f"--out - writes one file, but this makes {len(files)}", command)
        io.stdout(_bytes(files[0][1]))
        return
    _write_all(targets, flags.get("force") is True)


# ---------------------------------------------------------------- commands


def _json(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def _list(io: Io, flags: Mapping[str, Any]) -> None:
    category = flags.get("category")
    if category is not None and category not in list_categories():
        issue = f'unknown category "{category}" (known: {", ".join(list_categories())})'
        raise DeqError("INVALID_OPTIONS", issue, (issue,))
    shapes = list_shapes(category)
    if flags.get("json") is True:
        io.stdout(
            _json(
                [
                    {"id": s["id"], "category": s["category"], "name": s["names"]["en"]}
                    for s in shapes
                ]
            )
        )
        return
    w1 = max(len(s["id"]) for s in shapes)
    w2 = max(len(s["category"]) for s in shapes)
    rows = (f"{s['id'].ljust(w1)}  {s['category'].ljust(w2)}  {s['names']['en']}\n" for s in shapes)
    io.stdout("".join(rows).encode("utf-8"))


_INFO_FIELDS = (
    "id",
    "version",
    "category",
    "names",
    "aliases",
    "tags",
    "layers",
    "symmetry",
    "parameters",
)


def shape_info(s: Shape) -> dict[str, Any]:
    """A shape description without its primitives."""
    return {k: s[k] for k in _INFO_FIELDS}


def _info(io: Io, shape_id: str, flags: Mapping[str, Any]) -> None:
    s = get_shape(shape_id)
    if flags.get("json") is True:
        io.stdout(_json(shape_info(s)))
        return

    def words(a: Sequence[str]) -> str:
        return ", ".join(a) if a else "-"

    def kurdish(k: Mapping[str, Any]) -> str:
        return f"{k['text'] if k['text'] is not None else '-'} ({k['status']})"

    lines = [
        f"{s['id']}  {s['names']['en']}",
        f"Category:    {s['category']}",
        f"Sorani:      {kurdish(s['names']['ckb'])}",
        f"Kurmanji:    {kurdish(s['names']['kmr'])}",
        f"Aliases:     {words(s['aliases'])}",
        f"Tags:        {words(s['tags'])}",
        f"Layers:      {words(s['layers'])}",
        f"Symmetry:    {s['symmetry']}",
    ]
    params = list(s["parameters"].items())
    if not params:
        lines.append("Parameters:  -")
    else:
        lines.append("Parameters:")
        w = max(len(n) for n, _ in params)
        for n, p in params:
            if p["type"] == "integer":
                kind = f"integer {js_str(p['min'])} to {js_str(p['max'])}"
            elif p["type"] == "enum":
                kind = f"enum {'|'.join(p['values'])}"
            else:
                kind = "boolean"
            lines.append(
                f"  {n.ljust(w)}  {kind}, default {js_str(p['default'])}: {p['description']}"
            )
    io.stdout(("\n".join(lines) + "\n").encode("utf-8"))


def _port_format(data: Mapping[str, Any], fmt: str) -> str:
    if fmt not in data["formats"]["ports"]:
        raise NodeOnlyError(fmt)
    return fmt


def _render(
    io: Io, data: Mapping[str, Any], command: Mapping[str, Any], ids: Sequence[str], flags: Flags
) -> None:
    fmt = flags.get("format")
    if flags.get("layered") is True:
        if fmt is not None and fmt != "svg":
            raise UsageError("--layered only works with --format svg", command["name"])
        fmt = "svg-layered"
    fmt = _port_format(data, fmt or "svg")
    files = export_shapes(fmt, list(ids), _export_options(command, flags))
    _emit(io, command["name"], [(f.name, f.data) for f in files], flags)


def _export(
    io: Io, data: Mapping[str, Any], command: Mapping[str, Any], ids: Sequence[str], flags: Flags
) -> None:
    name = command["name"]
    every = flags.get("all") is True
    if every and ids:
        raise UsageError("give shape ids or --all, not both", name)
    if not every and not ids:
        raise UsageError("give shape ids or --all", name)
    out = flags.get("out", ".")
    if out == "-":
        raise UsageError("export writes files; --out - is not supported", name)
    formats = [_port_format(data, f) for f in flags.get("format", ["svg"])]
    items = [s["id"] for s in list_shapes()] if every else list(ids)
    sizes = flags.get("sizes", [24])
    base = _export_options(command, flags)
    targets: list[_Target] = []
    for fmt in formats:
        for size in sizes:
            files = export_shapes(fmt, items, {**base, "render": {**base["render"], "size": size}})
            for f in files:
                display = join_path(out, fmt, str(size), f.name)
                targets.append(_Target(display, _resolve(io, display), f.data))
    _write_all(targets, flags.get("force") is True)


def _raster(svg: str, width: int, fmt: RasterFormat, flags: Mapping[str, Any], what: str) -> bytes:
    """``svg`` as a raster image ``width`` px wide, with currentColor made concrete."""
    quality = flags.get("quality")
    if quality is not None and not 0 <= quality <= 100:
        issue = f"quality: must be 0 to 100 (got {quality})"
        raise DeqError("INVALID_OPTIONS", f"invalid {what} options: {issue}", (issue,))
    current = to_hex(parse_color(flags.get("current-color", "#000000")))
    matte = parse_color(flags.get("matte", "#ffffff"))
    return encode_svg(
        svg.replace("currentColor", current), width, fmt, quality=quality, matte=matte
    )


def flag_file(flags: Mapping[str, Any]) -> tuple[str, str | bytes]:
    """The flag file for the ``flag`` command: its name and contents."""
    variant = flags.get("variant", "full-color")
    width = flags.get("width", 900)
    fmt = flags.get("format", "svg")
    options: dict[str, Any] = {"variant": variant, "width": width}
    if flags.get("title") is not None:
        options["title"] = flags["title"]
    svg = render_flag(options)
    name = f"kurdish-flag-{variant}.{fmt}"
    if fmt == "svg":
        return name, f"{svg}\n"
    return name, _raster(svg, width, fmt, flags, "flag")


def scene_file(stem: str, svg: str, flags: Mapping[str, Any]) -> tuple[str, str | bytes]:
    """A scene (Leet text or pattern) as ``<stem>.<format>``; images are as wide as the SVG."""
    fmt = flags.get("format", "svg")
    name = f"{stem}.{fmt}"
    if fmt == "svg":
        return name, f"{svg}\n"
    m = _SVG_SIZE.match(svg)
    w = max(1, int(js_round(float(m.group(1) if m else "24"))))
    h = max(1, int(js_round(float(m.group(2) if m else "24"))))
    if w > MAX_PX or h > MAX_PX:
        msg = f"the image would be {w} x {h} px; the largest is {MAX_PX} x {MAX_PX} (lower --size)"
        raise DeqError("LIMIT_EXCEEDED", msg)
    return name, _raster(svg, w, fmt, flags, "scene")


#: Flags that ``deq leet --decode`` refuses, in the order they are checked.
_NOT_WITH_DECODE = (
    "format",
    "out",
    "force",
    "level",
    "script",
    "seed",
    "letter-spacing",
    "line-spacing",
    "align",
    "colors",
    "current-color",
    "matte",
    "quality",
)


def _leet(io: Io, command: Mapping[str, Any], text: str | None, flags: Mapping[str, Any]) -> None:
    name = command["name"]
    decode = flags.get("decode")
    if decode is not None:
        if text is not None:
            raise UsageError("give text or --decode, not both", name)
        bad = next((n for n in _NOT_WITH_DECODE if n in flags), None)
        if bad is not None:
            raise UsageError(f"--decode cannot be combined with --{bad}", name)
        svg = _read_text(io, decode, MAX_DECODE_BYTES)
        out = decode_leet(svg, _render_options(command, flags))
        if out.unmatched > 0:
            io.stderr(
                f"deq: warning: {out.unmatched} glyphs could not be read (shown as U+FFFD);"
                " pass the render flags used to write the file\n".encode()
            )
        io.stdout(f"{out.text}\n".encode())
        return
    if text is None:
        raise UsageError("give text or --decode", name)
    r = leet(text, _render_options(command, flags))
    if r.unknown:
        points = ", ".join(f"U+{ord(c):04X}" for c in r.unknown)
        io.stderr(f"deq: warning: left out characters with no glyph: {points}\n".encode())
    _emit(io, name, [scene_file("leet", r.svg, flags)], flags)


def _generate(io: Io, command: Mapping[str, Any], flags: Mapping[str, Any]) -> None:
    r = pattern(_render_options(command, flags))
    stem = f"pattern-{flags.get('kind', 'band')}-{flags.get('seed', 1)}"
    _emit(io, command["name"], [scene_file(stem, r.svg, flags)], flags)


def _read_text(io: Io, file: str, max_bytes: int) -> str:
    """A regular file of at most ``max_bytes`` as UTF-8, refusing symbolic links."""
    path = _resolve(io, file)
    st = _lstat(path)
    if st is None:
        msg = f"cannot read {file}: not found"
        raise IoError(msg)
    if stat.S_ISLNK(st.st_mode):
        msg = f"{file} is a symbolic link; pass the real file"
        raise IoError(msg)
    if not stat.S_ISREG(st.st_mode):
        msg = f"{file} is not a regular file"
        raise IoError(msg)
    if st.st_size > max_bytes:
        msg = f"{file} is larger than {max_bytes // 1024} KB"
        raise IoError(msg)
    try:
        with open(path, "rb") as fh:
            return fh.read(max_bytes + 1).decode("utf-8", errors="replace")
    except OSError as error:
        msg = f"cannot read {file}: {errno.errorcode.get(error.errno or 0, 'error')}"
        raise IoError(msg) from None


def _parse_constant(token: str) -> Any:
    msg = f"invalid JSON constant {token}"
    raise ValueError(msg)


def _validate(io: Io, file: str) -> None:
    text = _read_text(io, file, MAX_SPEC_BYTES)
    try:
        value = json.loads(text, parse_constant=_parse_constant)
    except (ValueError, RecursionError):
        raise DeqError("INVALID_SHAPE", f"{file}: not valid JSON") from None
    try:
        shape_id, count = validate_spec(value)
    except DeqError as error:
        raise DeqError(error.code, f"{file}: {error.message}", error.issues) from None
    io.stdout(f"{file}: ok ({shape_id}, {count} variants rendered)\n".encode())


def main(argv: Sequence[str], io: Io, data: Mapping[str, Any] | None = None) -> int:
    """Run the CLI and return the exit code."""
    d = data if data is not None else cli_data()
    try:
        parsed = parse_args(d, argv)
        if parsed.text is not None:
            io.stdout(parsed.text.encode("utf-8"))
            return 0
        command, args, flags = parsed.command or {}, parsed.args, dict(parsed.flags or {})
        name = command["name"]
        if name == "list":
            _list(io, flags)
        elif name == "info":
            _info(io, args[0], flags)
        elif name == "render":
            _render(io, d, command, args, flags)
        elif name == "export":
            _export(io, d, command, args, flags)
        elif name == "flag":
            _emit(io, name, [flag_file(flags)], flags)
        elif name == "leet":
            _leet(io, command, args[0] if args else None, flags)
        elif name == "generate":
            _generate(io, command, flags)
        elif name == "validate":
            _validate(io, args[0])
        else:
            io.stdout(d["completions"].get(args[0], "").encode("utf-8"))
    except UsageError as error:
        target = d["name"] if error.command is None else f"{d['name']} {error.command}"
        io.stderr(f'{d["name"]}: error: {error}\nRun "{target} --help" for usage.\n'.encode())
        return 2
    except Exception as error:
        io.stderr(f"{d['name']}: error: {error}\n".encode())
        if isinstance(error, IoError):
            return 3
        return EXIT_NODE_ONLY if isinstance(error, NodeOnlyError) else 1
    return 0


def run() -> None:
    """The console entry point (``deq``)."""

    def write(stream: Any) -> Writer:
        def out(data: bytes) -> None:
            stream.buffer.write(data)
            stream.buffer.flush()

        return out

    sys.exit(main(sys.argv[1:], Io(os.getcwd(), write(sys.stdout), write(sys.stderr))))
