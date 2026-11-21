from __future__ import annotations

import json
from pathlib import Path

import pytest

from deq_spec import SpecError, brand, cli, lockups


def run(repo: Path, *args: str) -> int:
    return cli.main(["--root", str(repo), *args])


def test_committed_files_are_fresh() -> None:
    assert brand.stale(Path(__file__).resolve().parents[3]) == []


def test_geometry_comes_from_the_spec(repo: Path) -> None:
    r = brand.rosette(repo)
    assert (r.ring.cx, r.ring.cy, r.ring.r, r.stroke) == (12, 12, 3, 2.0)
    assert len(r.dots) == brand.DOTS
    assert {round((d.cx - 12) ** 2 + (d.cy - 12) ** 2) for d in r.dots} == {49}


def test_files(repo: Path) -> None:
    files = brand.files(repo)
    svgs = {k: v for k, v in files.items() if k.endswith(".svg")}
    assert all(text.startswith(brand.HEADER) for text in svgs.values())
    logo = files["assets/brand/logo.svg"]
    # Spec dot (19, 12) r 1 and ring r 3 stroke 2, at 38 px per unit round (512, 512).
    assert '<circle cx="778" cy="512" r="38"/>' in logo
    assert 'r="114" fill="none" stroke="#FEBD11" stroke-width="76"' in logo
    assert 'r="1.5"' in files["assets/brand/mark-small.svg"]
    assert 'r="1"' in files["assets/brand/mark.svg"]
    assert "currentColor" in files["assets/brand/mark-mono.svg"]
    assert "prefers-color-scheme: dark" in files["assets/brand/favicon.svg"]
    assert "دەق" in files["assets/brand/social-preview.svg"]
    # Marketing images use outlines, never fonts.
    for key in ("social-preview", "banner", "banner-dark", "figma-cover"):
        assert "<text" not in files[f"assets/brand/{key}.svg"]
        assert "font-family" not in files[f"assets/brand/{key}.svg"]
    assert 'width="1920" height="1080"' in files["assets/brand/figma-cover.svg"]


def test_command_and_lint(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    (repo / "assets/brand/mark.svg").write_text("x", encoding="utf-8")
    assert run(repo, "lint") == 1
    assert "assets/brand/mark.svg: stale or missing" in capsys.readouterr().err
    assert run(repo, "brand") == 0
    assert "assets/brand/logo.svg" in capsys.readouterr().out
    assert run(repo, "lint") == 0


def test_refuses_symlink(repo: Path, tmp_path: Path) -> None:
    target = repo / "assets/brand/mark.svg"
    target.unlink()
    target.symlink_to(tmp_path / "elsewhere.svg")
    with pytest.raises(SpecError, match="symlink"):
        brand.write(repo)


def test_unexpected_shape(repo: Path) -> None:
    path = repo / "spec/shapes/dot-rosette.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["primitives"] = [p for p in data["primitives"] if p["id"] != "dots"]
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(SpecError, match="expected one ring"):
        brand.rosette(repo)


def test_lockups(repo: Path) -> None:
    files = brand.files(repo)
    names = [k for k in files if k.startswith("assets/brand/lockups/")]
    assert len(names) == 20
    flag = files["assets/brand/lockups/horizontal-flag.svg"]
    assert 'fill="#ED2024"' in flag
    assert 'fill="#278E43"' in flag
    assert "currentColor" in files["assets/brand/lockups/stacked-ckb-mono.svg"]
    rev = files["assets/brand/lockups/horizontal-reversed.svg"]
    assert brand.GREEN_DARK in rev
    assert 'fill="#FFFFFF" transform' in rev
    # The Sorani lockup puts the mark on the right.
    ckb = files["assets/brand/lockups/horizontal-ckb-color.svg"]
    assert '<circle cx="417.133" cy="80"' in ckb  # right-hand dot of a mark at x 267 to 427
    assert "<title>دەق</title>" in ckb


def test_flag_dots_alternate_clockwise(repo: Path) -> None:
    r = brand.rosette(repo)
    top = lockups.clockwise(r.dots)
    assert (round(top[0].cx, 6), round(top[0].cy, 6)) == (12, 5)
    assert (round(top[2].cx, 6), round(top[2].cy, 6)) == (19, 12)
    svg = brand.mark(r, dots=("#a", "#b"), ring="#c")
    assert svg.count('fill="#b"') == 4
    assert svg.startswith('<g fill="#a"><circle cx="12" cy="5"')


def test_animated_logo(repo: Path) -> None:
    files = brand.files(repo)
    logo = files["assets/brand/logo-animated.svg"]
    assert all(f'class="d{i}"' in logo for i in range(brand.DOTS))
    assert 'class="ring" transform="rotate(-90 512 512)"' in logo
    assert "prefers-reduced-motion:reduce" in logo
    # The dash covers the ring: 2 pi x 3 units x 38 px is about 716.3.
    assert "stroke-dasharray:718" in logo
    assert "@keyframes deq-dot" in files["assets/brand/mark-animated.svg"]


def test_tokens_and_colors(repo: Path) -> None:
    files = brand.files(repo)
    data = json.loads(files["assets/brand/brand.json"])
    green = next(c for c in data["colors"] if c["name"] == "Deq green")
    assert green["rgb"] == [29, 74, 46]
    assert green["onWhite"] > 4.5
    assert data["proportions"]["clearSpace"] == lockups.CLEAR
    assert "--deq-deq-green: #1D4A2E;" in files["assets/brand/tokens.css"]
    assert "--deq-deq-green-dark: #8FDBA5;" in files["assets/brand/tokens.css"]
    assert "| Flag red | `#ED2024` |" in files["docs/design/brand-colors.md"]


def test_needs_wordmark(repo: Path) -> None:
    (repo / lockups.WORDMARK).unlink()
    with pytest.raises(SpecError, match="deq-fonts wordmark"):
        brand.files(repo)
