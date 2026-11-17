"""A small, deterministic PDF 1.7 writer (ADR 0009), byte for byte the TypeScript output.

Layers become Optional Content Groups, so PDF viewers, Inkscape and Illustrator show them.
"""

from collections.abc import Sequence
from typing import Literal

from ._format import num
from .color import Rgba, to_cmyk
from .drawing import Drawing, DrawOp, Matrix, PathCmd

ColorSpace = Literal["rgb", "cmyk"]


def _matrix(m: Matrix) -> str:
    return " ".join(num(x) for x in m)


def _path_ops(path: Sequence[PathCmd]) -> str:
    out: list[str] = []
    for cmd in path:
        if cmd[0] == "h":
            out.append("h")
        else:
            out.append(f"{' '.join(num(v) for v in cmd[1:])} {cmd[0]}")
    return "\n".join(out)


def _color_op(c: Rgba, space: ColorSpace, stroke: bool) -> str:
    if space == "cmyk":
        return f"{' '.join(num(x) for x in to_cmyk(c))} {'K' if stroke else 'k'}"
    return f"{num(c[0])} {num(c[1])} {num(c[2])} {'RG' if stroke else 'rg'}"


def _pdf_text(s: str) -> str:
    """A PDF text string as UTF-16BE hex, safe for any title."""
    return f"<FEFF{s.encode('utf-16-be', 'surrogatepass').hex().upper()}>"


def _content(d: Drawing, space: ColorSpace, layered: bool) -> tuple[str, list[str]]:
    alphas = ["1 1"]
    current = "1 1"
    lines: list[str] = []

    def gs(stroke_a: float, fill_a: float) -> None:
        nonlocal current
        key = f"{num(stroke_a)} {num(fill_a)}"
        if key == current:
            return
        if key not in alphas:
            alphas.append(key)
        lines.append(f"/GS{alphas.index(key)} gs")
        current = key

    def paint(op: DrawOp) -> None:
        gs(op.stroke[3] if op.stroke else 1, op.fill[3] if op.fill else 1)
        if op.fill:
            lines.append(_color_op(op.fill, space, stroke=False))
        if op.stroke:
            lines.append(_color_op(op.stroke, space, stroke=True))
        lines.append(_path_ops(op.path))
        lines.append("B" if op.fill and op.stroke else "f" if op.fill else "S")

    lines += ["q", f"{_matrix(d.base)} cm"]
    lines.append(f"{num(d.line_width)} w {d.linecap} J {d.linejoin} j 4 M")
    if d.background:
        if layered:
            lines.append("/OC /OCbg BDC")
        paint(d.background)
        if layered:
            lines.append("EMC")
    lines.append("q")
    lines += [f"{_matrix(t)} cm" for t in d.transforms]
    for i, layer in enumerate(d.layers):
        if layered:
            lines.append(f"/OC /OC{i} BDC")
        for op in layer.ops:
            paint(op)
        if layered:
            lines.append("EMC")
    lines += ["Q", "Q"]
    return "\n".join(lines) + "\n", alphas


def _serialise(objects: Sequence[str], root_ref: int, info_ref: int) -> bytes:
    out = "%PDF-1.7\n%âãÏÓ\n"
    offsets: list[int] = []
    for i, body in enumerate(objects):
        offsets.append(len(out))
        out += f"{i + 1} 0 obj\n{body}\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    out += "".join(f"{off:010d} 00000 n \n" for off in offsets)
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root {root_ref} 0 R /Info {info_ref} 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    )
    # Every character is below U+0100, so Latin-1 bytes keep the offsets exact.
    return out.encode("latin-1")


def write_pdf(
    d: Drawing, *, color_space: ColorSpace = "rgb", layers: bool = True, creator: str = "Deq"
) -> bytes:
    """Write a one-page PDF for a drawing."""
    stream, alphas = _content(d, color_space, layers)
    # Object numbers: 1 catalog, 2 pages, 3 page, 4 content, 5 info, then OCGs.
    names = (
        ([*(["background"] if d.background else []), *(x.id for x in d.layers)]) if layers else []
    )
    refs = " ".join(f"{6 + i} 0 R" for i in range(len(names)))
    oc_props = (
        f" /OCProperties << /OCGs [{refs}] /D << /Name {_pdf_text('Layers')} /Order [{refs}]"
        f" /ON [{refs}] /OFF [] >> >> /PageMode /UseOC"
        if layers
        else ""
    )
    props = ""
    if layers:
        shift = 1 if d.background else 0
        keys = [
            "OCbg" if d.background is not None and i == 0 else f"OC{i - shift}"
            for i in range(len(names))
        ]
        props = f" /Properties << {' '.join(f'/{k} {6 + i} 0 R' for i, k in enumerate(keys))} >>"
    ext_g = " ".join(
        f"/GS{i} << /Type /ExtGState /CA {a.split(' ')[0]} /ca {a.split(' ')[1]} >>"
        for i, a in enumerate(alphas)
    )
    box = f"[0 0 {num(d.width)} {num(d.height)}]"
    objects = [
        f"<< /Type /Catalog /Pages 2 0 R{oc_props} >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox {box} /Resources << /ExtGState << {ext_g} >>"
        f"{props} >> /Contents 4 0 R >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}endstream",
        f"<< /Title {_pdf_text(d.title)} /Creator {_pdf_text(creator)}"
        " /Producer (@0xdolan/deq-exporters) >>",
        *(f"<< /Type /OCG /Name {_pdf_text(name)} >>" for name in names),
    ]
    return _serialise(objects, 1, 5)
