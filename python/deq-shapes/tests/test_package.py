import re

import deq_shapes


def test_distribution_name() -> None:
    assert deq_shapes.DISTRIBUTION_NAME == "deq-shapes"


def test_version_is_semver() -> None:
    semver = r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(alpha|beta|rc)\.(0|[1-9]\d*))?"
    assert re.fullmatch(semver, deq_shapes.__version__)
