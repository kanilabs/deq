"""Sine and cosine that match JavaScript's ``Math.sin`` and ``Math.cos`` bit for bit.

V8 computes them with fdlibm; the C library may differ by one unit in the last place, which
can flip a rounded coordinate and break byte-for-byte parity (ADR 0011). This is fdlibm's
``sin``/``cos`` with the medium-size argument reduction, which covers every angle a shape
uses (|x| <= 2**19 * pi / 2); larger arguments fall back to :mod:`math`.
"""

import math
import struct
from typing import Final

_S1: Final = -1.66666666666666324348e-01
_S2: Final = 8.33333333332248946124e-03
_S3: Final = -1.98412698298579493134e-04
_S4: Final = 2.75573137070700676789e-06
_S5: Final = -2.50507602534068634195e-08
_S6: Final = 1.58969099521155010221e-10
_C1: Final = 4.16666666666666019037e-02
_C2: Final = -1.38888888888741095749e-03
_C3: Final = 2.48015872894767294178e-05
_C4: Final = -2.75573143513906633035e-07
_C5: Final = 2.08757232129817482790e-09
_C6: Final = -1.13596475577881948265e-11
_INVPIO2: Final = 6.36619772367581382433e-01
_PIO2_1: Final = 1.57079632673412561417e00
_PIO2_1T: Final = 6.07710050650619224932e-11
_PIO2_2: Final = 6.07710050630396597660e-11
_PIO2_2T: Final = 2.02226624879595063154e-21
_PIO2_3: Final = 2.02226624871116645580e-21
_PIO2_3T: Final = 8.47842766036889956997e-32
# High words of n * pi / 2 for n = 1 .. 32.
_NPIO2_HW: Final = (
    0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C, 0x4025FDBB,
    0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C, 0x40346B9C, 0x4035FDBB,
    0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A, 0x403DD85A, 0x403F6A7A, 0x40407E4C,
    0x4041475C, 0x4042106C, 0x4042D97C, 0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB,
    0x4046C6CB, 0x40478FDB, 0x404858EB, 0x404921FB,
)  # fmt: skip


def _high(x: float) -> int:
    """The high 32 bits of ``x``, as a signed integer like fdlibm's ``__HI``."""
    return int(struct.unpack(">q", struct.pack(">d", x))[0] >> 32)


def _from_high(h: int) -> float:
    return float(struct.unpack(">d", struct.pack(">Q", (h & 0xFFFFFFFF) << 32))[0])


def _k_sin(x: float, y: float, iy: int) -> float:
    if _high(x) & 0x7FFFFFFF < 0x3E400000 and int(x) == 0:
        return x
    z = x * x
    v = z * x
    r = _S2 + z * (_S3 + z * (_S4 + z * (_S5 + z * _S6)))
    if iy == 0:
        return x + v * (_S1 + z * r)
    return x - ((z * (0.5 * y - v * r) - y) - v * _S1)


def _k_cos(x: float, y: float) -> float:
    ix = _high(x) & 0x7FFFFFFF
    if ix < 0x3E400000 and int(x) == 0:
        return 1.0
    z = x * x
    r = z * (_C1 + z * (_C2 + z * (_C3 + z * (_C4 + z * (_C5 + z * _C6)))))
    if ix < 0x3FD33333:
        return 1.0 - (0.5 * z - (z * r - x * y))
    qx = 0.28125 if ix > 0x3FE90000 else _from_high(ix - 0x00200000)
    hz = 0.5 * z - qx
    a = 1.0 - qx
    return a - (hz - (z * r - x * y))


def _reduce(x: float) -> tuple[int, float, float] | None:
    """``x`` as ``n * pi / 2 + (y0 + y1)``, or None when ``x`` is too large."""
    hx = _high(x)
    ix = hx & 0x7FFFFFFF
    if ix < 0x4002D97C:  # |x| < 3 pi / 4
        sign = 1.0 if hx > 0 else -1.0
        z = x - sign * _PIO2_1
        if ix != 0x3FF921FB:
            y0 = z - sign * _PIO2_1T
            return int(sign), y0, (z - y0) - sign * _PIO2_1T
        z -= sign * _PIO2_2
        y0 = z - sign * _PIO2_2T
        return int(sign), y0, (z - y0) - sign * _PIO2_2T
    if ix > 0x413921FB:
        return None
    t = abs(x)
    n = int(t * _INVPIO2 + 0.5)
    fn = float(n)
    r = t - fn * _PIO2_1
    w = fn * _PIO2_1T
    y0 = r - w
    if n >= 32 or ix == _NPIO2_HW[n - 1]:
        j = ix >> 20
        if j - ((_high(y0) >> 20) & 0x7FF) > 16:
            t = r
            w = fn * _PIO2_2
            r = t - w
            w = fn * _PIO2_2T - ((t - r) - w)
            y0 = r - w
            if j - ((_high(y0) >> 20) & 0x7FF) > 49:
                t = r
                w = fn * _PIO2_3
                r = t - w
                w = fn * _PIO2_3T - ((t - r) - w)
                y0 = r - w
    y1 = (r - y0) - w
    return (-n, -y0, -y1) if hx < 0 else (n, y0, y1)


def sin(x: float) -> float:
    """``Math.sin(x)`` as V8 computes it."""
    if _high(x) & 0x7FFFFFFF <= 0x3FE921FB:
        return _k_sin(x, 0.0, 0)
    red = _reduce(x)
    if red is None:
        return math.sin(x)
    n, a, b = red
    q = n & 3
    if q == 0:
        return _k_sin(a, b, 1)
    if q == 1:
        return _k_cos(a, b)
    if q == 2:
        return -_k_sin(a, b, 1)
    return -_k_cos(a, b)


def cos(x: float) -> float:
    """``Math.cos(x)`` as V8 computes it."""
    if _high(x) & 0x7FFFFFFF <= 0x3FE921FB:
        return _k_cos(x, 0.0)
    red = _reduce(x)
    if red is None:
        return math.cos(x)
    n, a, b = red
    q = n & 3
    if q == 0:
        return _k_cos(a, b)
    if q == 1:
        return -_k_sin(a, b, 1)
    if q == 2:
        return -_k_cos(a, b)
    return _k_sin(a, b, 1)
