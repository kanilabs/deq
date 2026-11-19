"""The seeded random source shared by every port (ADR 0015).

mulberry32 on unsigned 32-bit integers, with no floating point, so TypeScript, Python and
Rust draw the same numbers.
"""

from collections.abc import Sequence
from typing import Final, TypeVar

#: Largest seed; seeds are unsigned 32-bit integers.
MAX_SEED: Final = 0xFFFF_FFFF

_T = TypeVar("_T")


def _imul(a: int, b: int) -> int:
    return (a * b) & MAX_SEED


class Random:
    """A deterministic stream of unsigned 32-bit integers."""

    def __init__(self, seed: int) -> None:
        self._state = seed & MAX_SEED

    def next(self) -> int:
        """The next unsigned 32-bit integer."""
        self._state = (self._state + 0x6D2B79F5) & MAX_SEED
        t = self._state
        t = _imul(t ^ (t >> 15), t | 1)
        t ^= (t + _imul(t ^ (t >> 7), t | 61)) & MAX_SEED
        return (t ^ (t >> 14)) & MAX_SEED

    def below(self, n: int) -> int:
        """An integer in ``0 .. n - 1`` (``n`` >= 1)."""
        return self.next() % n

    def pick(self, items: Sequence[_T]) -> _T:
        """One element of a non-empty sequence."""
        return items[self.below(len(items))]
