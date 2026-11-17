"""Deterministic number and text formatting, identical to the TypeScript reference (ADR 0008)."""

import json
import math
import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Any


def round_half_even(v: float) -> float:
    """Round half to even (banker's rounding) on a finite double."""
    f = math.floor(v)
    d = v - f
    if d > 0.5:
        return f + 1
    if d < 0.5:
        return f
    return f if f % 2 == 0 else f + 1


def num(x: float) -> str:
    """Format a number with at most 3 decimals, without trailing zeros and with -0 as 0."""
    k = int(round_half_even(x * 1000))
    if k == 0:
        return "0"
    sign = "-" if k < 0 else ""
    a = abs(k)
    whole, frac = divmod(a, 1000)
    if frac == 0:
        return f"{sign}{whole}"
    digits = f"{frac:03d}".rstrip("0")
    return f"{sign}{whole}.{digits}"


_ESCAPES = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}
_NOT_XML = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")
_SPECIAL = re.compile("[&<>\"']")


def escape_xml(s: str) -> str:
    """Escape text for XML character data and double-quoted attributes; drop invalid characters."""
    return _SPECIAL.sub(lambda m: _ESCAPES[m.group(0)], _NOT_XML.sub("", s))


def js_round(x: float) -> int:
    """JavaScript ``Math.round``: halves round up."""
    return math.floor(x + 0.5)


def js_mod(a: float, b: float) -> float:
    """JavaScript ``%``: the remainder takes the sign of the dividend."""
    return math.fmod(a, b)


def is_number(x: object) -> bool:
    """A finite JSON number (booleans are not numbers)."""
    return isinstance(x, int | float) and not isinstance(x, bool) and math.isfinite(x)


def is_integer(x: object) -> bool:
    """JavaScript ``Number.isInteger``."""
    return is_number(x) and float(x).is_integer()  # type: ignore[arg-type]


def js_str(v: object) -> str:
    """JavaScript ``String(v)`` for the JSON values the messages use."""
    if v is True:
        return "true"
    if v is False:
        return "false"
    if v is None:
        return "null"
    if isinstance(v, float):
        if v.is_integer() and abs(v) < 1e21:
            return str(int(v))
        return repr(v)
    return str(v)


def js_json(v: Any) -> str:
    """JavaScript ``JSON.stringify`` for a scalar."""
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    return js_str(v)


def js_equal(a: object, b: object) -> bool:
    """JavaScript ``===`` for JSON scalars (``1 !== true``)."""
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if is_number(a) and is_number(b):
        return a == b
    return type(a) is type(b) and a == b


def js_to_fixed(x: float, digits: int) -> str:
    """JavaScript ``Number.prototype.toFixed``: exact decimal value, ties away from zero."""
    q = Decimal(x).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP)
    s = f"{q:f}"
    return s[1:] if x == 0 and s.startswith("-") else s
