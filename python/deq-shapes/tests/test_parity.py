"""Every golden fixture renders byte for byte (ADR 0008)."""

import json
from pathlib import Path
from typing import Any

import pytest

from deq_shapes import compose, render, render_flag

FIXTURES = Path(__file__).resolve().parents[3] / "spec" / "fixtures"
CASES: list[dict[str, Any]] = json.loads((FIXTURES / "manifest.json").read_text("utf-8"))["cases"]


def _render(case: dict[str, Any]) -> str:
    if "flag" in case:
        return render_flag(case["flag"])
    if "compose" in case:
        return compose(case["compose"], case["options"])
    return render(case["shape"], case["options"])


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_fixture(case: dict[str, Any]) -> None:
    assert _render(case) == (FIXTURES / case["file"]).read_text("utf-8")
