"""Edge cases of the CLI, the validator and the exporters beyond the shared CLI cases."""

import json
import os
import sys
from pathlib import Path
from typing import Any

import pytest

from deq_shapes import DeqError, __version__
from deq_shapes.cli import Io, join_path, main, param_value, run
from deq_shapes.export import export_shapes, resolve_item, resolve_items, split_svg, to_figma_svg
from deq_shapes.validate import MAX_SPEC_BYTES, check_spec, validate_spec, variants

SPEC: dict[str, Any] = {
    "id": "x",
    "version": 1,
    "category": "test",
    "names": {
        "en": "X",
        "ckb": {"text": None, "status": "none"},
        "kmr": {"text": "X", "status": "ok"},
    },
    "aliases": ["y"],
    "tags": [],
    "layers": ["main"],
    "symmetry": "none",
    "parameters": {},
    "primitives": [{"type": "dot", "cx": 12, "cy": 12, "layer": "main"}],
    "meaning": "documentation only",
}


class Session:
    """Run the CLI in a temporary directory."""

    def __init__(self, cwd: Path) -> None:
        self.cwd = cwd
        self.out = b""
        self.err = b""

    def run(self, *argv: str) -> int:
        out: list[bytes] = []
        err: list[bytes] = []
        code = main(list(argv), Io(str(self.cwd), out.append, err.append))
        self.out, self.err = b"".join(out), b"".join(err)
        return code


@pytest.fixture
def cli(tmp_path: Path) -> Session:
    return Session(tmp_path)


def spec_error(change: dict[str, Any], drop: str | None = None) -> str:
    spec = {**SPEC, **change}
    if drop:
        del spec[drop]
    with pytest.raises(DeqError) as info:
        validate_spec(spec)
    assert info.value.code == "INVALID_SHAPE"
    return info.value.message


# ---------------------------------------------------------------- helpers


def test_param_value_and_join_path() -> None:
    assert param_value("true") is True
    assert param_value("false") is False
    assert param_value("3") == 3
    assert param_value("-.5") == -0.5
    assert param_value("1e3") == "1e3"
    assert join_path("a/", "b") == "a/b"
    assert join_path("a", "b", "c") == os.path.join("a", "b", "c")


# ---------------------------------------------------------------- validate


def test_validate_ok_and_variants() -> None:
    assert validate_spec(SPEC) == ("x", 1)
    spec = {
        **SPEC,
        "parameters": {
            "n": {"type": "integer", "min": 0, "max": 100, "default": 5, "description": "N"},
            "e": {"type": "enum", "values": ["a", "b"], "default": "a", "description": "E"},
        },
    }
    assert variants(check_spec(spec)) == [{}, {"n": 0}, {"n": 100}, {"e": "b"}]
    assert (
        check_spec({k: v for k, v in SPEC.items() if k not in ("aliases", "tags", "symmetry")})[
            "symmetry"
        ]
        == "none"
    )


@pytest.mark.parametrize(
    ("change", "drop", "expected"),
    [
        ({}, "id", 'spec: missing field "id"'),
        ({"extra": 1}, None, 'spec: unknown field "extra"'),
        ({"id": "Bad"}, None, "id: must be kebab case, at most 64 characters"),
        ({"version": 0}, None, "version: must be a positive integer"),
        ({"category": 1}, None, "category: must be a string"),
        ({"names": []}, None, "names: must be an object"),
        ({"names": {"en": 1}}, None, "names.en: must be a string"),
        ({"names": {"en": "X", "ckb": 1}}, None, "names.ckb: must be an object"),
        (
            {"names": {"en": "X", "ckb": {"text": 1}}},
            None,
            "names.ckb.text: must be a string or null",
        ),
        ({"names": {"en": "X", "ckb": {"text": None}}}, None, "names.ckb.status: must be a string"),
        ({"aliases": [1]}, None, "aliases: must be a list of strings"),
        ({"layers": []}, None, "layers: must be a non-empty list of kebab-case ids"),
        ({"parameters": []}, None, "parameters: must be an object"),
        ({"parameters": {"p": 1}}, None, "parameters.p: must be an object"),
        ({"parameters": {"p": {}}}, None, "parameters.p.description: must be a string"),
        (
            {"parameters": {"p": {"description": "", "type": "x"}}},
            None,
            "parameters.p.type: must be integer, boolean or enum",
        ),
        (
            {"parameters": {"p": {"description": "", "type": "integer", "min": 0, "max": 1}}},
            None,
            "parameters.p: min, max and default must be integers",
        ),
        (
            {
                "parameters": {
                    "p": {"description": "", "type": "integer", "min": 0, "max": 1, "default": 2}
                }
            },
            None,
            "parameters.p: default must be between min and max",
        ),
        (
            {"parameters": {"p": {"description": "", "type": "boolean", "default": 1}}},
            None,
            "parameters.p.default: must be true or false",
        ),
        (
            {"parameters": {"p": {"description": "", "type": "enum", "values": []}}},
            None,
            "parameters.p.values: must be a non-empty list of strings",
        ),
        (
            {
                "parameters": {
                    "p": {"description": "", "type": "enum", "values": ["a"], "default": "b"}
                }
            },
            None,
            "parameters.p.default: must be one of the values",
        ),
        ({"primitives": []}, None, "primitives: must be a non-empty list"),
        ({"primitives": [1]}, None, "primitives[0]: must be an object"),
        ({"primitives": [{"type": "blob"}]}, None, "primitives[0].type: must be one of line,"),
        (
            {"primitives": [{"type": "polyline", "points": [[1]]}]},
            None,
            "primitives[0].points: must be a list of [x, y] pairs",
        ),
        ({"primitives": [{"type": "path", "d": 1}]}, None, "primitives[0].d: must be a string"),
        (
            {"primitives": [{"type": "circle", "cx": 1, "cy": 1, "r": 1, "paint": "x"}]},
            None,
            'primitives[0].paint: must be "stroke" or "fill"',
        ),
        (
            {
                "primitives": [
                    {
                        "type": "star",
                        "cx": 1,
                        "cy": 1,
                        "points": {"x": 1},
                        "outerRadius": 1,
                        "innerRadius": 1,
                        "rotation": 0,
                    }
                ]
            },
            None,
            'primitives[0].points: must be a number or {"param": name}',
        ),
        (
            {
                "primitives": [
                    {
                        "type": "radial",
                        "count": 2,
                        "center": [1],
                        "start": 0,
                        "sweep": 1,
                        "element": {"type": "dot", "cx": 1, "cy": 1},
                    }
                ]
            },
            None,
            "primitives[0].center: must be an [x, y] pair",
        ),
        (
            {
                "primitives": [
                    {
                        "type": "repeat",
                        "count": 2,
                        "align": "end",
                        "element": {"type": "dot", "cx": 1, "cy": 1},
                    }
                ]
            },
            None,
            'primitives[0].align: must be "start" or "center"',
        ),
        (
            {"primitives": [{"type": "use", "shape": "x", "params": []}]},
            None,
            "primitives[0].params: must be an object",
        ),
        (
            {"primitives": [{"type": "use", "shape": "x", "params": {"a": []}}]},
            None,
            "primitives[0].params.a: must be a number, true, false or a string",
        ),
        (
            {"primitives": [{"type": "use", "shape": "x", "transform": {"skew": 1}}]},
            None,
            'primitives[0].transform: unknown field "skew"',
        ),
        (
            {"primitives": [{"type": "dot", "cx": 1, "cy": 1, "when": {"a": {}}}]},
            None,
            "primitives[0].when.a: must be a value or a list of values",
        ),
        (
            {"primitives": [{"type": "line", "x1": 0, "y1": 0, "x2": 1}]},
            None,
            'primitives[0]: missing field "y2"',
        ),
    ],
)
def test_validate_errors(change: dict[str, Any], drop: str | None, expected: str) -> None:
    assert expected in spec_error(change, drop)


def test_validate_nesting() -> None:
    deep: dict[str, Any] = {"type": "dot", "cx": 1, "cy": 1}
    for _ in range(10):
        deep = {"type": "repeat", "count": 1, "step": [0, 0], "element": deep}
    assert "nested too deeply" in spec_error({"primitives": [deep]})
    with pytest.raises(DeqError, match="spec: must be a JSON object"):
        validate_spec([])


def test_validate_command_files(cli: Session, tmp_path: Path) -> None:
    (tmp_path / "dir").mkdir()
    assert cli.run("validate", "dir") == 3
    assert cli.err == b"deq: error: dir is not a regular file\n"
    (tmp_path / "big.json").write_bytes(b" " * (MAX_SPEC_BYTES + 1))
    assert cli.run("validate", "big.json") == 3
    assert cli.err == b"deq: error: big.json is larger than 256 KB\n"
    (tmp_path / "nan.json").write_text('{"id": NaN}')
    assert cli.run("validate", "nan.json") == 1
    assert cli.err == b"deq: error: nan.json: not valid JSON\n"
    (tmp_path / "s.json").write_text(json.dumps(SPEC))
    if hasattr(os, "symlink"):
        try:
            os.symlink(tmp_path / "s.json", tmp_path / "link.json")
        except OSError:  # pragma: no cover - Windows without symlink rights
            return
        assert cli.run("validate", "link.json") == 3
        assert cli.err == b"deq: error: link.json is a symbolic link; pass the real file\n"


# ---------------------------------------------------------------- CLI output


def test_render_targets(cli: Session, tmp_path: Path) -> None:
    (tmp_path / "out").mkdir()
    assert cli.run("render", "kurdish-sun", "--out", "out") == 0
    assert (tmp_path / "out" / "kurdish-sun.svg").is_file()
    assert cli.run("render", "kurdish-sun", "roj-half-sun", "--out", "many/") == 0
    assert (tmp_path / "many" / "roj-half-sun.svg").is_file()
    (tmp_path / "taken").mkdir()
    assert cli.run("render", "kurdish-sun", "--out", "taken", "--force") == 0
    (tmp_path / "taken" / "kurdish-sun.svg").unlink()
    (tmp_path / "taken" / "kurdish-sun.svg").mkdir()
    assert cli.run("render", "kurdish-sun", "--out", "taken", "--force") == 3
    assert b"is not a regular file" in cli.err
    (tmp_path / "file").write_text("x")
    assert cli.run("render", "kurdish-sun", "--out", "file/sub/a.svg") == 3
    assert cli.err.startswith(b"deq: error: cannot write file/sub/a.svg: ")


def test_render_formats(cli: Session) -> None:
    assert cli.run("render", "kurdish-sun", "--format", "png", "--out", "-") == 0
    assert cli.out.startswith(b"\x89PNG")
    assert cli.run("render", "kurdish-sun", "--format", "svg-layered", "--out", "-") == 0
    assert b"inkscape:groupmode" in cli.out
    assert cli.run("list", "--category", "nope") == 1
    assert cli.run("info", "kurdish-sun") == 0
    assert b"Parameters:  -" in cli.out or b"Parameters:" in cli.out


def test_flag_default_out(cli: Session, tmp_path: Path) -> None:
    assert cli.run("flag", "--format", "png", "--width", "30", "--title", "Flag") == 0
    assert (tmp_path / "kurdish-flag-full-color.png").is_file()


def test_run_entry_point(
    monkeypatch: pytest.MonkeyPatch, capfdbinary: pytest.CaptureFixture[bytes]
) -> None:
    monkeypatch.setattr(sys, "argv", ["deq", "--version"])
    with pytest.raises(SystemExit) as info:
        run()
    assert info.value.code == 0
    assert capfdbinary.readouterr().out == f"deq {__version__}\n".encode()


# ---------------------------------------------------------------- exporters


def test_export_items() -> None:
    assert (
        resolve_item({"shape": "roj-half-sun", "params": {"rays": 9}, "name": "sun"}).name == "sun"
    )
    comp = resolve_item({"parts": [{"shape": "roj-half-sun"}], "options": {"size": 48}})
    assert comp.name == "composition"
    with pytest.raises(DeqError, match="must be kebab case"):
        resolve_item({"shape": "roj-half-sun", "name": "Bad Name"})
    with pytest.raises(DeqError, match="give 1 to 512 items"):
        resolve_items([])
    with pytest.raises(DeqError, match="duplicate name roj-half-sun"):
        resolve_items(["roj-half-sun", "roj-half-sun"])
    with pytest.raises(ValueError, match="not a Deq SVG"):
        split_svg("<g/>")
    figma = to_figma_svg(resolve_item({"shape": "kurdish-sun", "options": {"color": "red"}}))
    assert "currentColor" not in figma


def test_export_options() -> None:
    with pytest.raises(DeqError, match="format: must be one of"):
        export_shapes("gif", ["roj-half-sun"])
    with pytest.raises(DeqError) as info:
        export_shapes(
            "png",
            ["roj-half-sun"],
            {
                "nope": 1,
                "matte": 5,
                "scales": [1, 1],
                "icoSizes": [0],
                "quality": 101,
                "colorSpace": "lab",
                "layers": 1,
                "prefix": "-",
            },
        )
    text = info.value.message
    for part in (
        "nope: unknown option",
        "matte: must be a string",
        "scales: scales must be unique",
        "icoSizes: must be 1 to 8 integers from 1 to 256",
        "quality: must be an integer from 0 to 100 (got 101)",
        'colorSpace: must be "rgb" or "cmyk"',
        "layers: must be true or false",
        "prefix: must match",
    ):
        assert part in text
    with pytest.raises(DeqError, match="more than 8192"):
        export_shapes("png", ["roj-half-sun"], {"render": {"size": 4096}, "scales": [3]})
    with pytest.raises(DeqError, match="only available in the Node CLI"):
        export_shapes("eps", ["roj-half-sun"])


def test_export_rasters() -> None:
    files = export_shapes(
        "jpg",
        ["roj-half-sun"],
        {"scales": [1, 2], "quality": 50, "matte": "black", "currentColor": "red"},
    )
    assert [f.name for f in files] == ["roj-half-sun.jpg", "roj-half-sun@2x.jpg"]
    (webp,) = export_shapes("webp", ["roj-half-sun"])
    assert isinstance(webp.data, bytes)
    assert webp.data[8:12] == b"WEBP"
    (ico,) = export_shapes("ico", ["roj-half-sun"], {"icoSizes": [16, 256]})
    assert isinstance(ico.data, bytes)
    assert ico.data[6 + 16] == 0
