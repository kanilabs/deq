from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from deq_fonts import cli
from fonts_samples import RING, SUN


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A temporary working directory with a package.json and the geometry file."""
    (tmp_path / "package.json").write_text('{"version": "1.2.3"}', encoding="utf-8")
    geometry = tmp_path / "fonts" / "build" / "geometry.json"
    geometry.parent.mkdir(parents=True)
    geometry.write_text(json.dumps({"shapes": [SUN, RING]}), encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("deq_fonts.cli.ROOT", tmp_path)
    return tmp_path


def test_version(repo: Path) -> None:
    assert cli.version() == "1.002"


def test_codepoints_write_then_check(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert cli.main(["codepoints", "--check"]) == 1
    assert "out of date" in capsys.readouterr().err
    assert cli.main(["codepoints"]) == 0
    assert (repo / "fonts" / "codepoints.json").exists()
    assert "U+E001" in (repo / "docs" / "fonts" / "codepoints.md").read_text("utf-8")
    assert cli.main(["codepoints", "--check"]) == 0
    assert cli.main(["codepoints"]) == 0
    assert "wrote" not in capsys.readouterr().out.split("codepoints.md")[-1]


def test_missing_geometry(repo: Path) -> None:
    with pytest.raises(SystemExit, match="font-data"):
        cli.main(["codepoints", "--geometry", "nope.json"])


def test_build(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert cli.main(["codepoints"]) == 0
    assert cli.main(["build", "--out", "dist"]) == 0
    names = sorted(p.name for p in (repo / "dist").iterdir())
    assert names == [
        "DeqIcons-Regular.otf",
        "DeqIcons-Regular.ttf",
        "DeqIcons-Regular.woff2",
        "DeqIconsColor-Regular.ttf",
        "DeqIconsColor-Regular.woff2",
        "DeqIcons[DOTS,wght].ttf",
        "DeqIcons[DOTS,wght].woff2",
        "codepoints.json",
        "deq-icons.css",
    ]
    assert f"wrote {Path('dist', 'DeqIcons-Regular.ttf')}" in capsys.readouterr().out


def test_install_check_needs_fonts(tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="no fonts"):
        cli.main(["install-check", str(tmp_path)])


def test_install_check_needs_fontconfig(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "x.ttf").write_bytes(b"")
    monkeypatch.setattr(shutil, "which", lambda _: None)
    with pytest.raises(SystemExit, match="fc-cache not found"):
        cli.main(["install-check", str(tmp_path)])


def _fake_fontconfig(monkeypatch: pytest.MonkeyPatch, listing: str) -> None:
    monkeypatch.setattr(shutil, "which", lambda name: f"/usr/bin/{name}")

    def run(cmd: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(cmd, 0, stdout=listing, stderr="")

    monkeypatch.setattr(subprocess, "run", run)


def test_install_check_reports_missing_family(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    (tmp_path / "a.ttf").write_bytes(b"")
    _fake_fontconfig(monkeypatch, "Deq Icons|Regular|/x/a.ttf\n")
    assert cli.main(["install-check", str(tmp_path)]) == 1
    assert "Deq Icons Color" in capsys.readouterr().err


def test_install_check_passes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    (tmp_path / "a.ttf").write_bytes(b"")
    (tmp_path / "b.otf").write_bytes(b"")
    (tmp_path / "c.css").write_text("")
    _fake_fontconfig(monkeypatch, "Deq Icons|Regular|/x/b.otf\nDeq Icons Color|Regular|/x/a.ttf\n")
    assert cli.main(["install-check", str(tmp_path)]) == 0
    assert "2 fonts found" in capsys.readouterr().out


@pytest.mark.skipif(shutil.which("fc-list") is None, reason="needs fontconfig")
def test_install_check_with_fontconfig(repo: Path) -> None:
    assert cli.main(["codepoints"]) == 0
    assert cli.main(["build", "--out", "dist"]) == 0
    assert cli.main(["install-check", "dist"]) == 0
