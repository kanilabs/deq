"""CSS colour parsing for formats that need numbers (PDF, JPG matte, concrete raster SVG).

Accepts everything option validation accepts: hex, named colours, ``transparent``,
``currentColor``, and rgb/hsl/hwb/lab/lch/oklab/oklch with plain numeric arguments.
"""

import math
import re

from ._format import js_json, js_mod, js_round
from .errors import DeqError

#: Red, green, blue and alpha, each 0 to 1 (sRGB, not premultiplied).
Rgba = tuple[float, float, float, float]

#: Opaque black, the default for ``currentColor`` outside a browser.
BLACK: Rgba = (0, 0, 0, 1)

_NAMED_TABLE = (
    "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige "
    "f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 "
    "brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral "
    "ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b "
    "darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 "
    "darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid "
    "9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b "
    "darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink "
    "ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 "
    "floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff "
    "gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 "
    "honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c "
    "lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 "
    "lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen "
    "90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa "
    "lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de "
    "lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 "
    "mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db "
    "mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise "
    "48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 "
    "moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab "
    "6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 "
    "paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f "
    "pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 "
    "rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 "
    "seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue "
    "6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 "
    "tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat "
    "f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32"
)
_WORDS = _NAMED_TABLE.split()
#: The 148 CSS named colours (CSS Color 4) as 6-digit lower-case hex without ``#``.
NAMED_COLORS: dict[str, str] = dict(zip(_WORDS[::2], _WORDS[1::2], strict=True))

_HEX = re.compile(r"^[0-9a-f]+$", re.IGNORECASE)
_ARG = re.compile(
    r"^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(%|deg|turn|rad|grad)?$", re.IGNORECASE
)
_FUNC = re.compile(r"^([a-z]+)\((.*)\)$", re.DOTALL)


def _clamp01(x: float) -> float:
    return min(1, max(0, x))


def _fail(text: str) -> DeqError:
    issue = f"color: cannot convert {js_json(text[:80])} to RGB"
    return DeqError("INVALID_OPTIONS", f"invalid colour: {issue}", (issue,))


def _hex(h: str, text: str) -> Rgba:
    # Short forms #rgb and #rgba double each digit.
    full = "".join(ch * 2 for ch in h) if len(h) <= 4 else h
    if not _HEX.match(full) or full.endswith("\n") or len(full) not in (6, 8):
        raise _fail(text)

    def n(i: int) -> float:
        return int(full[i : i + 2], 16) / 255

    return (n(0), n(2), n(4), n(6) if len(full) == 8 else 1)


def _arg(token: str | None, percent_scale: float, text: str) -> float:
    """One numeric argument: a number or a percentage; ``none`` is 0."""
    if token is None:
        raise _fail(text)
    if token == "none":  # noqa: S105 (a CSS keyword, not a secret)
        return 0
    m = _ARG.match(token)
    if m is None or token.endswith("\n"):
        raise _fail(text)
    value = float(m.group(1))
    unit = (m.group(2) or "").lower()
    if unit == "%":
        return (value / 100) * percent_scale
    if unit == "turn":
        return value * 360
    if unit == "rad":
        return (value * 180) / math.pi
    if unit == "grad":
        return value * 0.9
    return value


def _srgb_gamma(c: float) -> float:
    return 12.92 * c if c <= 0.0031308 else 1.055 * math.pow(c, 1 / 2.4) - 0.055


def _from_linear(r: float, g: float, b: float, a: float) -> Rgba:
    return (
        _clamp01(_srgb_gamma(r)),
        _clamp01(_srgb_gamma(g)),
        _clamp01(_srgb_gamma(b)),
        _clamp01(a),
    )


def _hsl_to_rgb(h: float, s: float, light: float) -> tuple[float, float, float]:
    def f(n: float) -> float:
        k = js_mod(n + h / 30, 12)
        a = s * min(light, 1 - light)
        return light - a * max(-1, min(k - 3, 9 - k, 1))

    return (f(0), f(8), f(4))


def _cube(t: float) -> float:
    return t**3


def _lab_to_rgb(lightness: float, a: float, b: float, alpha: float) -> Rgba:
    # CIE Lab (D50) -> XYZ D50 -> Bradford to D65 -> linear sRGB (CSS Color 4 matrices).
    e = 216 / 24389
    k = 24389 / 27
    fy = (lightness + 16) / 116
    fx = fy + a / 500
    fz = fy - b / 200

    def inv(t: float) -> float:
        return _cube(t) if _cube(t) > e else (116 * t - 16) / k

    x = inv(fx) * (0.3457 / 0.3585)
    y = _cube(fy) if lightness > k * e else lightness / k
    z = inv(fz) * ((1 - 0.3457 - 0.3585) / 0.3585)
    xx = 0.955473421488075 * x - 0.02309845494876471 * y + 0.06325924320057072 * z
    yy = -0.0283697093338637 * x + 1.0099953980813041 * y + 0.021041441191917323 * z
    zz = 0.012314014864481998 * x - 0.020507649298898964 * y + 1.330365926242124 * z
    return _from_linear(
        3.2409699419045226 * xx - 1.537383177570094 * yy - 0.4986107602930034 * zz,
        -0.9692436362808796 * xx + 1.8759675015077202 * yy + 0.04155505740717559 * zz,
        0.05563007969699366 * xx - 0.20397695888897652 * yy + 1.0569715142428786 * zz,
        alpha,
    )


def _oklab_to_rgb(lightness: float, a: float, b: float, alpha: float) -> Rgba:
    l3 = _cube(lightness + 0.3963377774 * a + 0.2158037573 * b)
    m3 = _cube(lightness - 0.1055613458 * a - 0.0638541728 * b)
    s3 = _cube(lightness - 0.0894841775 * a - 1.291485548 * b)
    return _from_linear(
        4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
        -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
        -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
        alpha,
    )


def _polar(c: float, h: float) -> tuple[float, float]:
    return (c * math.cos((h * math.pi) / 180), c * math.sin((h * math.pi) / 180))


def _hue(x: float) -> float:
    return js_mod(js_mod(x, 360) + 360, 360)


def _func(name: str, body: str, text: str) -> Rgba:
    # Both the legacy comma syntax and the modern space syntax with "/ alpha".
    pieces = body.split("/")
    if len(pieces) > 2:
        raise _fail(text)
    parts = [p for p in re.split(r"\s+", pieces[0].replace(",", " ").strip()) if p]
    alpha_token = pieces[1].strip() if len(pieces) == 2 else None
    if alpha_token is None and len(parts) == 4:
        alpha_token = parts[3]
        parts = parts[:3]
    if len(parts) != 3:
        raise _fail(text)
    alpha = 1 if alpha_token is None else _clamp01(_arg(alpha_token, 1, text))
    p0, p1, p2 = parts
    if name in ("rgb", "rgba"):
        return (
            _clamp01(_arg(p0, 255, text) / 255),
            _clamp01(_arg(p1, 255, text) / 255),
            _clamp01(_arg(p2, 255, text) / 255),
            alpha,
        )
    if name in ("hsl", "hsla"):
        r, g, b = _hsl_to_rgb(
            _hue(_arg(p0, 360, text)),
            _clamp01(_arg(p1, 100, text) / 100),
            _clamp01(_arg(p2, 100, text) / 100),
        )
        return (r, g, b, alpha)
    if name == "hwb":
        w = _clamp01(_arg(p1, 100, text) / 100)
        k = _clamp01(_arg(p2, 100, text) / 100)
        if w + k > 1:
            total = w + k
            w /= total
            k /= total
        base = _hsl_to_rgb(_hue(_arg(p0, 360, text)), 1, 0.5)
        r, g, b = (c * (1 - w - k) + w for c in base)
        return (r, g, b, alpha)
    if name == "lab":
        return _lab_to_rgb(_arg(p0, 100, text), _arg(p1, 125, text), _arg(p2, 125, text), alpha)
    if name == "lch":
        a, b = _polar(_arg(p1, 150, text), _arg(p2, 360, text))
        return _lab_to_rgb(_arg(p0, 100, text), a, b, alpha)
    if name == "oklab":
        return _oklab_to_rgb(_arg(p0, 1, text), _arg(p1, 0.4, text), _arg(p2, 0.4, text), alpha)
    if name == "oklch":
        a, b = _polar(_arg(p1, 0.4, text), _arg(p2, 360, text))
        return _oklab_to_rgb(_arg(p0, 1, text), a, b, alpha)
    raise _fail(text)


def parse_color(text: str, current: Rgba = BLACK) -> Rgba:
    """Parse a CSS colour; ``currentColor`` resolves to ``current``.

    Raises ``DeqError`` (``INVALID_OPTIONS``) when the colour cannot be converted.
    """
    s = text.strip().lower()
    if s == "currentcolor":
        return current
    if s == "transparent":
        return (0, 0, 0, 0)
    if s.startswith("#"):
        return _hex(s[1:], text)
    named = NAMED_COLORS.get(s)
    if named is not None:
        return _hex(named, text)
    m = _FUNC.match(s)
    if m is None or len(m.group(2)) > 64:
        raise _fail(text)
    return _func(m.group(1), m.group(2), text)


def _byte(c: float) -> str:
    return f"{js_round(_clamp01(c) * 255):02x}"


def to_hex(c: Rgba) -> str:
    """``#rrggbb``, or ``#rrggbbaa`` when not opaque."""
    r, g, b, a = c
    return f"#{_byte(r)}{_byte(g)}{_byte(b)}{_byte(a) if a < 1 else ''}"


def to_cmyk(c: Rgba) -> tuple[float, float, float, float]:
    """Naive device CMYK (no ICC profile): ``k = 1 - max(r, g, b)``."""
    r, g, b, _ = c
    k = 1 - max(r, g, b)
    if k >= 1:
        return (0, 0, 0, 1)
    return ((1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k)
