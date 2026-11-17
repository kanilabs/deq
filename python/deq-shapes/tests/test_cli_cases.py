"""The shared CLI cases (spec/fixtures/cli, ADR 0011) give the same results as the Node CLI."""

import json
import struct
from pathlib import Path
from typing import Any

import pytest

from deq_shapes.cli import EXIT_NODE_ONLY, Io, cli_data, main

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "spec" / "fixtures" / "cli"
CASES: list[dict[str, Any]] = json.loads((OUT / "manifest.json").read_text("utf-8"))["cases"]


def run_case(case: dict[str, Any], cwd: Path) -> tuple[int, bytes, bytes, dict[str, bytes]]:
    """Run one case in ``cwd``: exit code, stdout, stderr and every file afterwards."""
    for s in case["setup"]:
        path = cwd / s["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(
            (ROOT / s["copy"]).read_bytes() if "copy" in s else s.get("text", "").encode()
        )
    out: list[bytes] = []
    err: list[bytes] = []
    code = main(case["args"], Io(str(cwd), out.append, err.append))
    files = {p.relative_to(cwd).as_posix(): p.read_bytes() for p in cwd.rglob("*") if p.is_file()}
    return code, b"".join(out), b"".join(err), files


def file_check(case: str, path: str, data: bytes) -> dict[str, Any]:
    """The same check as ``fileCheck`` in packages/cli/scripts/cases.ts."""
    ext = path.rsplit(".", 1)[-1]
    if ext == "png":
        width, height = struct.unpack(">II", data[16:24])
        return {"path": path, "check": "png", "width": width, "height": height}
    if ext in ("jpg", "webp"):
        magic = data[:3] == b"\xff\xd8\xff" if ext == "jpg" else data[8:12] == b"WEBP"
        assert magic, f"{path} is not a {ext} file"
        return {"path": path, "check": ext}
    if ext == "ico":
        (count,) = struct.unpack("<H", data[4:6])
        sizes = [data[6 + i * 16] or 256 for i in range(count)]
        return {"path": path, "check": "ico", "sizes": sizes}
    return {"path": path, "check": "bytes", "fixture": f"{case}/files/{path}"}


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_cli_case(case: dict[str, Any], tmp_path: Path) -> None:
    code, stdout, stderr, files = run_case(case, tmp_path)
    if case["nodeOnly"]:
        listed = case["args"][case["args"].index("--format") + 1].split(",")
        fmt = next(f for f in listed if f not in cli_data()["formats"]["ports"])
        assert code == EXIT_NODE_ONLY
        assert stderr.decode() == (
            f'deq: error: format "{fmt}" is only available in the Node CLI (npx @0xdolan/deq-cli)\n'
        )
        assert stdout == b""
        assert files == {}
        return
    assert code == case["exit"], stderr.decode()
    expected_out = b"" if case["stdout"] is None else (OUT / case["stdout"]).read_bytes()
    assert stdout == expected_out
    if case["stderr"] is not None:
        assert stderr == (OUT / case["stderr"]).read_bytes()
    elif case["exit"] == 0:
        assert stderr == b""
    checks = [file_check(case["name"], p, files[p]) for p in sorted(files)]
    assert checks == case["files"]
    for check in checks:
        if check["check"] == "bytes":
            assert files[check["path"]] == (OUT / check["fixture"]).read_bytes(), check["path"]
