"""Error paths and edge cases of the renderer, colours and flag (messages match TypeScript)."""

from typing import Any

import pytest

from deq_shapes import (
    DeqError,
    compose,
    compose_shape,
    expand,
    flag_size,
    has_shape,
    list_flag_variants,
    render,
    render_flag,
    render_shape_data,
    resolve_options,
    suggest,
)
from deq_shapes._format import js_json, js_str, js_to_fixed, round_half_even
from deq_shapes.color import BLACK, parse_color, to_cmyk, to_hex
from deq_shapes.drawing import build_drawing
from deq_shapes.flag import get_flag_variant
from deq_shapes.geometry import parse_path
from deq_shapes.pdf import write_pdf
from deq_shapes.svg import prepare


def shape(*primitives: dict[str, Any], **params: dict[str, Any]) -> dict[str, Any]:
    """A minimal shape description for tests."""
    return {
        "id": "t",
        "version": 1,
        "category": "test",
        "names": {"en": "T"},
        "aliases": [],
        "tags": [],
        "layers": ["main"],
        "symmetry": "none",
        "parameters": params,
        "primitives": [{"layer": "main", **p} for p in primitives],
    }


def message(fn: Any, *args: Any) -> str:
    with pytest.raises(DeqError) as info:
        fn(*args)
    return info.value.message


# ---------------------------------------------------------------- formatting


def test_format_helpers() -> None:
    assert round_half_even(2.5) == 2
    assert round_half_even(3.5) == 4
    assert js_str(True) == "true"
    assert js_str(False) == "false"
    assert js_str(None) == "null"
    assert js_str(2.0) == "2"
    assert js_str(0.5) == "0.5"
    assert js_str("x") == "x"
    assert js_json(1.5) == "1.5"
    assert js_to_fixed(-0.0001, 3) == "-0.000"
    assert js_to_fixed(-0.0, 3) == "0.000"
    assert js_to_fixed(1.0005, 3) == "1.000"
    assert js_to_fixed(-1.25, 1) == "-1.3"


# ---------------------------------------------------------------- colours


@pytest.mark.parametrize(
    ("text", "hex_"),
    [
        ("#c00", "#cc0000"),
        ("#C00A", "#cc0000aa"),
        ("#123456", "#123456"),
        ("#12345678", "#12345678"),
        ("RebeccaPurple", "#663399"),
        (" white ", "#ffffff"),
        ("rgb(255, 0, 0)", "#ff0000"),
        ("rgba(0,0,255,0.5)", "#0000ff80"),
        ("rgb(100% 50% 0% / 25%)", "#ff800040"),
        ("rgb(none 0 0)", "#000000"),
        ("hsl(120 100% 25%)", "#008000"),
        ("hsla(-120, 100%, 50%, 1)", "#0000ff"),
        ("hsl(0.5turn 100% 50%)", "#00ffff"),
        ("hsl(3.14159rad 100% 50%)", "#00ffff"),
        ("hsl(200grad 100% 50%)", "#00ffff"),
        ("hsl(180deg 100% 50%)", "#00ffff"),
        ("hwb(0 0% 0%)", "#ff0000"),
        ("hwb(0 60% 60%)", "#808080"),
        ("lab(100 0 0)", "#ffffff"),
        ("lab(0% 0 0)", "#000000"),
        ("lch(54.29 106.84 40.85)", "#ff0000"),
        ("oklab(1 0 0)", "#ffffff"),
        ("oklab(62.8% 0.2249 0.1258)", "#ff0000"),
        ("oklch(0.628 0.2577 29.23)", "#ff0000"),
    ],
)
def test_parse_color(text: str, hex_: str) -> None:
    assert to_hex(parse_color(text)) == hex_


def test_color_keywords() -> None:
    assert parse_color("currentColor", (1, 0, 0, 1)) == (1, 0, 0, 1)
    assert parse_color("CURRENTCOLOR") == BLACK
    assert parse_color("transparent") == (0, 0, 0, 0)
    assert len(to_hex(parse_color("oklch(50% 100% 0 / 0.5)"))) == 9
    assert to_hex((2, -1, 0.5, 1)) == "#ff0080"


@pytest.mark.parametrize(
    "bad",
    [
        "#12",
        "#12345",
        "#ggg",
        "nope",
        "rgb(1 2)",
        "rgb(1 2 3 / 4 / 5)",
        "rgb(a b c)",
        "color(srgb 1 0 0)",
        "rgb(" + "1 " * 40 + ")",
        "rgb(1, 2, 3, 4, 5)",
    ],
)
def test_parse_color_rejects(bad: str) -> None:
    with pytest.raises(DeqError):
        parse_color(bad)


def test_cmyk() -> None:
    assert to_cmyk((0, 0, 0, 1)) == (0, 0, 0, 1)
    assert to_cmyk((1, 1, 1, 1)) == (0, 0, 0, 0)
    assert to_cmyk((1, 0, 0, 1)) == (0, 1, 1, 0)
    c, m, y, k = to_cmyk((0.5, 0.25, 0, 1))
    assert (c, m, y) == (0, 0.5, 1)
    assert k == pytest.approx(0.5)


# ---------------------------------------------------------------- options


def test_options_errors() -> None:
    assert "must be an object" in message(resolve_options, [])
    text = message(
        resolve_options,
        {
            "size": "big",
            "strokeWidth": 0,
            "nope": 1,
            "params": [],
            "layerColors": [],
        },
    )
    assert "size: must be a finite number" in text
    assert "nope: unknown option" in text
    assert "params: must be an object" in text
    assert "layerColors: must be an object" in text
    text = message(
        resolve_options,
        {
            "params": {"Bad Name": [], **{f"p{i}": 1 for i in range(33)}},
            "layerColors": {"Bad Layer": "url(#x)", **{f"l{i}": "red" for i in range(65)}},
        },
    )
    assert "params.Bad Name: must be a parameter name" in text
    assert "must be a number, boolean or short text" in text
    assert "params: at most 32 parameters" in text
    assert "layerColors.Bad Layer: must be a layer id" in text
    assert "layerColors: at most 64 layer colours" in text
    text = message(render, "roj-half-sun", {"layerColors": {"nope": "red"}})
    assert "layerColors.nope: not a layer of roj-half-sun" in text


# ---------------------------------------------------------------- shapes and parameters


def test_registry() -> None:
    assert has_shape("roj-half-sun")
    assert not has_shape("nope")
    assert suggest("roj-half-su")[0] == "roj-half-sun"
    assert "unknown shape" in message(render, "roj-half-su")
    assert "object" in message(render, 5)
    assert expand("roj-half-sun")


def test_parameter_errors() -> None:
    s = shape(
        {"type": "dot", "cx": 12, "cy": 12},
        n={"type": "integer", "min": 1, "max": 3, "default": 2, "description": "N"},
        b={"type": "boolean", "default": True, "description": "B"},
        e={"type": "enum", "values": ["a", "b"], "default": "a", "description": "E"},
    )
    assert 'parameter "n" must be an integer' in message(
        render_shape_data, s, {"params": {"n": 1.5}}
    )
    assert "n=9 is outside 1..3" in message(render_shape_data, s, {"params": {"n": 9}})
    assert 'parameter "b" must be true or false' in message(
        render_shape_data, s, {"params": {"b": 1}}
    )
    assert 'e="c" is not one of a, b' in message(render_shape_data, s, {"params": {"e": "c"}})


def test_primitive_errors() -> None:
    bad_count = shape(
        {
            "type": "radial",
            "count": -1,
            "center": [12, 12],
            "start": 0,
            "sweep": 360,
            "element": {"type": "dot", "cx": 12, "cy": 2},
        }
    )
    assert "count must be a non-negative integer" in message(render_shape_data, bad_count)
    when = shape({"type": "dot", "cx": 12, "cy": 12, "when": {"x": 1}})
    assert '`when` uses unknown parameter "x"' in message(render_shape_data, when)
    no_layer = shape({"type": "dot", "cx": 12, "cy": 12})
    no_layer["primitives"][0]["layer"] = ""
    assert "no layer" in message(render_shape_data, no_layer)
    arc = shape({"type": "arc", "cx": 12, "cy": 12, "r": 4, "start": 90, "end": 0})
    assert "arc needs start < end" in message(render_shape_data, arc)
    rep = shape({"type": "repeat", "count": 2, "element": {"type": "dot", "cx": 12, "cy": 12}})
    assert "repeat needs step or spread" in message(render_shape_data, rep)
    conc = shape(
        {
            "type": "concentric",
            "count": 3,
            "center": [12, 12],
            "scaleStep": 0.6,
            "element": {"type": "circle", "cx": 12, "cy": 12, "r": 8},
        }
    )
    assert "copy 2 would have scale -0.200" in message(render_shape_data, conc)
    deep: dict[str, Any] = {"type": "dot", "cx": 12, "cy": 12}
    for _ in range(8):
        deep = {"type": "repeat", "count": 1, "step": [0, 0], "element": deep}
    assert "nested deeper than" in message(render_shape_data, shape(deep))
    many = shape(
        {
            "type": "repeat",
            "count": 2001,
            "step": [0, 0],
            "element": {"type": "dot", "cx": 12, "cy": 12},
        }
    )
    assert "expands to more than 2000 items" in message(render_shape_data, many)
    cycle = shape({"type": "use", "shape": "t"})
    assert "reference cycle t -> t" in message(render_shape_data, cycle)


def test_more_primitives_render() -> None:
    s = shape(
        {"type": "arc", "cx": 12, "cy": 12, "r": 4, "start": 0, "end": 200},
        {"type": "arc", "cx": 12, "cy": 12, "r": 6, "start": 0, "end": 360},
        {"type": "ellipse", "cx": 12, "cy": 12, "rx": 6, "ry": 3},
        {"type": "path", "d": "M2 2 H10 V10 Q12 12 14 10 C16 8 18 8 20 10 L22 22 Z"},
        {"type": "path", "d": "M2 2 L4 4", "paint": "fill"},
        {
            "type": "repeat",
            "count": 3,
            "spread": [10, 0],
            "align": "start",
            "element": {"type": "dot", "cx": 2, "cy": 20},
        },
        {"type": "polyline", "points": []},
        {
            "type": "repeat",
            "count": 2,
            "step": [1, 1],
            "element": {"type": "arc", "cx": 12, "cy": 12, "r": 4, "start": 0, "end": 90},
        },
        {
            "type": "repeat",
            "count": 2,
            "step": [1, 1],
            "element": {"type": "ellipse", "cx": 12, "cy": 12, "rx": 4, "ry": 2},
        },
        {
            "type": "repeat",
            "count": 2,
            "step": [1, 1],
            "element": {"type": "path", "d": "M1 1 L2 2"},
        },
        {
            "type": "repeat",
            "count": 2,
            "step": [1, 1],
            "element": {"type": "polyline", "points": [[1, 1], [2, 2]]},
        },
        {
            "type": "use",
            "shape": "roj-half-sun",
            "transform": {"scale": 0.5, "rotate": 30, "translate": [1, 1], "origin": [12, 12]},
        },
    )
    s["layers"] = ["main", "rays", "center"]
    svg = render_shape_data(s, {"fill": "#ff0", "rotation": 30})
    assert "<ellipse" in svg
    assert "A4 4 0 1 1" in svg
    d = build_drawing(prepare(s, {"fill": "#ff0", "background": "red"}))
    assert write_pdf(d, color_space="cmyk", layers=False).startswith(b"%PDF-1.7")


def test_parse_path_errors() -> None:
    assert "unsupported path data" in message(parse_path, "L1 1")
    assert "unsupported path data" in message(parse_path, "M1 1 X")
    assert "M needs 2 numbers" in message(parse_path, "M1")
    assert "expected a path command at token 3" in message(parse_path, "M1 1 2 3")
    assert "L needs 2 numbers" in message(parse_path, "M1 1 L1 Z")


def test_compose_errors() -> None:
    assert "must be a list of 1 to 64 parts" in message(compose_shape, [])
    text = message(
        compose_shape,
        [
            5,
            {"shape": 5, "extra": 1, "layer": "Bad", "params": {"x": []}},
            {"shape": "roj-half-sun", "transform": 3},
            {
                "shape": "roj-half-sun",
                "transform": {"translate": [1], "scale": 9, "rotate": 999, "skew": 1},
            },
        ],
    )
    for part in (
        "0: must be an object",
        "1.extra: unknown field",
        "1.shape: must be a shape id",
        "1.layer: must be a layer id",
        "2.transform: must be an object",
        "3.transform.translate: must be [x, y]",
        "3.transform.scale: must be above 0 and at most 4",
        "3.transform.rotate: must be from -360 to 360",
        "3.transform.skew: unknown field",
    ):
        assert part in text
    assert compose([{"shape": "roj-half-sun", "layer": "a"}]).startswith("<svg")


# ---------------------------------------------------------------- flag


def test_flag_errors() -> None:
    assert list_flag_variants()[0] == "full-color"
    assert flag_size(get_flag_variant("full-color"), 900)[0] == 900
    assert "variant: must be one of" in message(get_flag_variant, "nope")
    text = message(render_flag, {"variant": 5, "width": 0, "title": 5, "x": 1})
    assert "variant: must be text of at most 64 chars" in text
    assert "width: must be an integer from 1 to 8192" in text
    assert "title: must be text of at most 256 chars" in text
    assert "x: unknown option" in text
