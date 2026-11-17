"""The only error type the library raises."""

from typing import Literal

DeqErrorCode = Literal[
    "UNKNOWN_SHAPE", "INVALID_OPTIONS", "INVALID_PARAMETER", "INVALID_SHAPE", "LIMIT_EXCEEDED"
]


class DeqError(Exception):
    """Why an operation failed. ``code`` is stable; the message is for people."""

    def __init__(self, code: DeqErrorCode, message: str, issues: tuple[str, ...] = ()) -> None:
        super().__init__(message)
        self.code: DeqErrorCode = code
        self.message = message
        #: Validation problems, one line each (for ``INVALID_OPTIONS``).
        self.issues = issues
