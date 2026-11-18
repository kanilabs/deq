from __future__ import annotations

import json
from pathlib import Path

import pytest

from deq_spec import SpecError, brand, cli


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
    assert all(text.startswith(brand.HEADER) for text in files.values())
    logo = files["assets/brand/logo.svg"]
    # Spec dot (19, 12) r 1 and ring r 3 stroke 2, at 38 px per unit round (512, 512).
    assert '<circle cx="778" cy="512" r="38"/>' in logo
    assert 'r="114" fill="none" stroke="#FEBD11" stroke-width="76"' in logo
    assert 'r="1.5"' in files["assets/brand/mark-small.svg"]
    assert 'r="1"' in files["assets/brand/mark.svg"]
    assert "currentColor" in files["assets/brand/mark-mono.svg"]
    assert "prefers-color-scheme: dark" in files["assets/brand/favicon.svg"]
    assert "دەق" in files["assets/brand/social-preview.svg"]


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
