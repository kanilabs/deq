"""Raster output: SVG rendered with resvg and encoded to PNG (resvg), JPG and WebP (Pillow)."""

import io
import struct
from collections.abc import Sequence
from typing import Literal

import resvg_py
from PIL import Image

from ._format import is_integer, js_str
from .color import Rgba
from .errors import DeqError

RasterFormat = Literal["png", "jpg", "webp"]

#: Largest width or height of a raster export, in pixels.
MAX_RASTER = 8192


def check_width(width: int) -> None:
    """Raise ``DeqError`` unless ``width`` is a whole number of pixels from 1 to 8192."""
    if not is_integer(width) or width < 1 or width > MAX_RASTER:
        issue = (
            f"size: raster width must be an integer from 1 to {MAX_RASTER} px (got {js_str(width)})"
        )
        raise DeqError("INVALID_OPTIONS", f"invalid export options: {issue}", (issue,))


def render_png(svg: str, width: int) -> bytes:
    """Render an SVG at ``width`` pixels (the height follows the aspect ratio) as PNG."""
    check_width(width)
    return bytes(resvg_py.svg_to_bytes(svg_string=svg, width=width, skip_system_fonts=True))


def encode_svg(
    svg: str,
    width: int,
    fmt: RasterFormat,
    *,
    quality: int | None = None,
    matte: Rgba = (1, 1, 1, 1),
) -> bytes:
    """Render an SVG and encode it. JPG has no transparency, so it is composited on ``matte``."""
    png = render_png(svg, width)
    if fmt == "png":
        return png
    img = Image.open(io.BytesIO(png)).convert("RGBA")
    out = io.BytesIO()
    q = 90 if quality is None else quality
    if fmt == "jpg":
        mr, mg, mb = (round(c * 255) for c in matte[:3])
        background = Image.new("RGBA", img.size, (mr, mg, mb, 255))
        Image.alpha_composite(background, img).convert("RGB").save(out, "JPEG", quality=q)
    else:
        img.save(out, "WEBP", quality=q)
    return out.getvalue()


#: Sizes in ``.ico`` files.
ICO_SIZES = (16, 32, 48)


def pack_ico(images: Sequence[tuple[int, bytes]]) -> bytes:
    """Pack PNG images (size, bytes) into one ICO file."""
    header = 6 + 16 * len(images)
    out = bytearray(struct.pack("<HHH", 0, 1, len(images)))
    offset = header
    for size, png in images:
        side = 0 if size >= 256 else size
        out += struct.pack("<BBBBHHII", side, side, 0, 0, 1, 32, len(png), offset)
        offset += len(png)
    for _, png in images:
        out += png
    return bytes(out)


def to_ico(svg: str, sizes: Sequence[int] = ICO_SIZES) -> bytes:
    """Render an SVG at several square sizes into one ICO file."""
    return pack_ico([(size, render_png(svg, size)) for size in sizes])
