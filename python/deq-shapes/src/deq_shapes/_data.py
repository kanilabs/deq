"""Package data: the shapes and flag (built from ``spec/``) and the shared CLI data."""

import json
from functools import cache
from importlib.resources import files
from typing import Any


@cache
def load(name: str) -> Any:
    """Parse ``deq_shapes/data/<name>`` once."""
    return json.loads(files("deq_shapes").joinpath("data", name).read_text(encoding="utf-8"))
