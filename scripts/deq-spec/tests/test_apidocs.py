from __future__ import annotations

import ast
from pathlib import Path

import pytest

from deq_spec import SpecError, apidocs, cli
from tests.conftest import ROOT


def test_python_api_doc_is_fresh() -> None:
    assert not apidocs.stale(ROOT), "docs/api/python.md is stale: run `uv run deq-spec api-docs`"


def test_cli_writes_and_lint_checks(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    doc = repo / apidocs.API_DOC
    doc.write_text("old", encoding="utf-8")
    assert cli.main(["--root", str(repo), "lint"]) == 1
    assert "deq-spec api-docs" in capsys.readouterr().err
    assert cli.main(["--root", str(repo), "api-docs"]) == 0
    assert capsys.readouterr().out.strip() == "docs/api/python.md"
    assert not apidocs.stale(repo)
    doc.unlink()
    assert apidocs.stale(repo)


def test_page_content() -> None:
    page = apidocs.generate(ROOT)
    assert page.startswith('---\ntitle: "deq-shapes (Python)"\n')
    assert "do not edit" in page
    assert "### `render`" in page
    assert "**Raises** `DeqError`:" in page
    assert "| None = None" in page
    assert "``" not in page.replace("```", "")
    assert ":func:" not in page


def test_text_roles_and_doctests() -> None:
    doc = "Use :func:`render` with ``size``.\n\n>>> render('dot')\n'<svg'\n:raises X: why"
    assert apidocs._text(doc) == (
        "Use `render` with `size`.\n\n```python\nrender('dot')\n```\n'<svg'\n**Raises** `X`: why"
    )
    assert apidocs._text(None) == ""


def _sig(src: str) -> str:
    node = ast.parse(src).body[0]
    assert isinstance(node, ast.FunctionDef)
    return apidocs._signature(node, node.name)


def test_signatures() -> None:
    assert _sig("def f(a, /, b: int = 1, *args: str, c, d=2, **kw): ...") == (
        "def f(a, /, b: int = 1, *args: str, c, d=2, **kw)"
    )
    assert _sig("def f(*, a: int) -> None: ...") == "def f(*, a: int) -> None"


def _write(root: Path, init: str, extra: str = "") -> None:
    pkg = root / apidocs.PACKAGE
    pkg.mkdir(parents=True)
    (pkg / "__init__.py").write_text(init, encoding="utf-8")
    (pkg / "mod.py").write_text(extra, encoding="utf-8")


def test_definitions(tmp_path: Path) -> None:
    _write(
        tmp_path,
        '"""deq-shapes: test pkg."""\nfrom .mod import A, Kind, LONG, f\n'
        '__all__ = ["A", "Kind", "LONG", "f", "X"]\n#: An X.\nX = 1\n',
        "Kind = Literal['a']\nLONG = '" + "x" * 90 + "'\n"
        "class A:\n    '''An A.'''\n    #: Field.\n    a: int = 1\n    _b: int\n"
        "    def m(self, n: int) -> int:\n        '''Do m.'''\n    def _p(self): ...\n"
        "def f(): ...\n",
    )
    page = apidocs.generate(tmp_path)
    assert "description: Test pkg." in page
    assert "- `a: int = 1`: Field." in page
    assert "- `m(n: int) -> int`: Do m." in page
    assert "_b" not in page
    assert "_p" not in page
    assert "Kind = Literal['a']" in page
    assert "LONG\n```" in page
    assert "X = 1\n```\n\nAn X." in page


def test_errors(tmp_path: Path) -> None:
    _write(tmp_path, "from .mod import f\n__all__ = ['f']\n")
    with pytest.raises(SpecError, match="definition not found"):
        apidocs.generate(tmp_path)
    (tmp_path / apidocs.PACKAGE / "__init__.py").write_text("x = 1\n", encoding="utf-8")
    with pytest.raises(SpecError, match="no __all__"):
        apidocs.generate(tmp_path)
