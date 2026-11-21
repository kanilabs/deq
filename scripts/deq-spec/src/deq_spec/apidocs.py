"""The Python API reference ``docs/api/python.md`` (ADR 0021).

Reads the public names in ``deq_shapes.__all__`` and their docstrings from the source with
:mod:`ast`, so nothing is imported and no documentation tool is needed. ``deq-spec lint``
fails when the file is stale; ``deq-spec api-docs`` rewrites it.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path

from deq_spec import SpecError

PACKAGE = Path("python/deq-shapes/src/deq_shapes")
API_DOC = Path("docs/api/python.md")
#: Sidebar position after the TypeScript packages in ``scripts/api-docs.ts``.
ORDER = 10

_ROLE = re.compile(r":(?:func|class|meth|data|mod|attr):`~?([^`]+)`")
_RAISES = re.compile(r"^:raises (\w+):")


@dataclass(frozen=True, slots=True)
class _Entry:
    name: str
    kind: str
    block: str


def _text(doc: str | None) -> str:
    """Docstring text as Markdown: reST literals and roles become code, doctests a code block."""
    if not doc:
        return ""
    out: list[str] = []
    code: list[str] = []

    def flush() -> None:
        if code:
            out.extend(["```python", *code, "```"])
            code.clear()

    for line in doc.strip().splitlines():
        if line.startswith((">>> ", "... ")):
            code.append(line[4:])
            continue
        flush()
        line = _RAISES.sub(r"**Raises** `\1`:", line.strip())
        out.append(_ROLE.sub(r"`\1`", line).replace("``", "`"))
    flush()
    return "\n".join(out).strip()


def _comment(lines: list[str], lineno: int) -> str:
    """The ``#:`` comment lines right above line ``lineno`` (1-based)."""
    found: list[str] = []
    i = lineno - 2
    while i >= 0 and lines[i].strip().startswith("#:"):
        found.insert(0, lines[i].strip()[2:].strip())
        i -= 1
    return _text(" ".join(found))


def _param(arg: ast.arg, default: ast.expr | None) -> str:
    text = f"{arg.arg}: {ast.unparse(arg.annotation)}" if arg.annotation else arg.arg
    if default is None:
        return text
    return f"{text}{' = ' if arg.annotation else '='}{ast.unparse(default)}"


def _signature(node: ast.FunctionDef, name: str) -> str:
    """``def name(...) -> T`` with PEP 8 spacing around annotated defaults."""
    a = node.args
    positional = [*a.posonlyargs, *a.args]
    defaults: list[ast.expr | None] = [None] * (len(positional) - len(a.defaults))
    params = [_param(p, d) for p, d in zip(positional, [*defaults, *a.defaults], strict=True)]
    if a.posonlyargs:
        params.insert(len(a.posonlyargs), "/")
    if a.vararg:
        params.append("*" + _param(a.vararg, None))
    elif a.kwonlyargs:
        params.append("*")
    params += [_param(p, d) for p, d in zip(a.kwonlyargs, a.kw_defaults, strict=True)]
    if a.kwarg:
        params.append("**" + _param(a.kwarg, None))
    returns = f" -> {ast.unparse(node.returns)}" if node.returns is not None else ""
    return f"def {name}({', '.join(params)}){returns}"


def _block(name: str, code: str, doc: str, extra: list[str] | None = None) -> str:
    parts = [f"### `{name}`", "", "```python", code, "```"]
    if doc:
        parts += ["", doc]
    if extra:
        parts += ["", *extra]
    return "\n".join(parts)


def _first_line(doc: str) -> str:
    return doc.split("\n\n")[0].replace("\n", " ") if doc else ""


def _class(node: ast.ClassDef, name: str, lines: list[str]) -> str:
    bases = ", ".join(ast.unparse(b) for b in node.bases)
    code = f"class {name}({bases})" if bases else f"class {name}"
    members: list[str] = []
    for item in node.body:
        if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
            field = item.target.id
            if field.startswith("_"):
                continue
            default = f" = {ast.unparse(item.value)}" if item.value is not None else ""
            note = _comment(lines, item.lineno)
            line = f"- `{field}: {ast.unparse(item.annotation)}{default}`"
            members.append(f"{line}: {note.replace(chr(10), ' ')}" if note else line)
        elif isinstance(item, ast.FunctionDef) and not item.name.startswith("_"):
            sig = _signature(item, item.name).removeprefix("def ")
            sig = re.sub(r"^(\w+)\(self(?:, )?", r"\1(", sig)
            doc = _first_line(_text(ast.get_docstring(item)))
            members.append(f"- `{sig}`" + (f": {doc}" if doc else ""))
    return _block(name, code, _text(ast.get_docstring(node)), members)


def _definition(tree: ast.Module, name: str, lines: list[str]) -> _Entry | None:
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return _Entry(
                name,
                "Functions",
                _block(name, _signature(node, name), _text(ast.get_docstring(node))),
            )
        if isinstance(node, ast.ClassDef) and node.name == name:
            return _Entry(name, "Classes", _class(node, name, lines))
        target: ast.expr | None = None
        annotation = ""
        if isinstance(node, ast.AnnAssign):
            target, annotation = node.target, ast.unparse(node.annotation)
        elif isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
        if not (isinstance(target, ast.Name) and target.id == name):
            continue
        value = getattr(node, "value", None)
        shown = ast.unparse(value) if value is not None else ""
        doc = _comment(lines, node.lineno)
        if annotation in ("", "Final") and shown.startswith(("Literal[", "Union[")):
            return _Entry(name, "Types", _block(name, f"{name} = {shown}", doc))
        head = f"{name}: {annotation}" if annotation else name
        code = f"{head} = {shown}" if shown and len(shown) <= 80 else head
        return _Entry(name, "Constants", _block(name, code, doc))
    return None


def _modules(init: ast.Module) -> dict[str, str]:
    """Each public name of ``__init__`` and the sibling module it is imported from."""
    where: dict[str, str] = {}
    for node in init.body:
        if isinstance(node, ast.ImportFrom) and node.level == 1 and node.module:
            for alias in node.names:
                where[alias.asname or alias.name] = node.module
    return where


def _all(init: ast.Module) -> list[str]:
    for node in init.body:
        if (
            isinstance(node, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == "__all__" for t in node.targets)
            and isinstance(node.value, ast.List)
        ):
            return [ast.literal_eval(e) for e in node.value.elts]
    raise SpecError(f"{PACKAGE}/__init__.py: no __all__ list")


def generate(root: Path) -> str:
    """The Markdown text of ``docs/api/python.md``."""
    pkg = root / PACKAGE
    init_src = (pkg / "__init__.py").read_text(encoding="utf-8")
    init = ast.parse(init_src)
    where = _modules(init)
    sections: dict[str, list[str]] = {k: [] for k in ("Functions", "Classes", "Constants", "Types")}
    for name in sorted(_all(init), key=lambda n: (n.lower().lstrip("_"), n)):
        module = where.get(name)
        src = (pkg / f"{module}.py").read_text(encoding="utf-8") if module else init_src
        entry = _definition(ast.parse(src), name, src.splitlines())
        if entry is None:
            raise SpecError(f"deq_shapes.{name}: definition not found")
        sections[entry.kind].append(entry.block)

    intro = _text(ast.get_docstring(init)).removeprefix("deq-shapes: ")
    description = intro.split("\n\n")[0].replace("\n", " ")
    out = [
        "---",
        'title: "deq-shapes (Python)"',
        f"description: {description[:1].upper()}{description[1:]}",
        "sidebar:",
        f"  order: {ORDER}",
        "---",
        "",
        "<!-- Generated by scripts/deq-spec (deq-spec api-docs) from the docstrings; "
        "do not edit. -->",
        "",
        intro[:1].upper() + intro[1:],
        "",
        "Source: [`python/deq-shapes`](../../python/deq-shapes/). Install with "
        "`pip install deq-shapes`; every name below is importable from `deq_shapes`.",
    ]
    for title, blocks in sections.items():
        if blocks:
            out += ["", f"## {title}", "", "\n\n".join(blocks)]
    return "\n".join(out) + "\n"


def stale(root: Path) -> bool:
    """True when ``docs/api/python.md`` differs from :func:`generate`."""
    path = root / API_DOC
    return not path.is_file() or path.read_text(encoding="utf-8") != generate(root)


def write(root: Path) -> Path:
    """Write ``docs/api/python.md`` and return its path."""
    path = root / API_DOC
    path.write_text(generate(root), encoding="utf-8")
    return path
