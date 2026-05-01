"""Plumr — official Python SDK.

>>> from plumr import Plumr
>>> client = Plumr(api_key="plm_live_...")
>>> for event in client.run(input="hello"):
...     ...
"""

from .client import Plumr, AsyncPlumr, PlumrError
from .types import (
    PlumrEvent,
    RunStartEvent,
    StepStartEvent,
    StepEndEvent,
    LlmStartEvent,
    LlmDeltaEvent,
    LlmEndEvent,
    ToolCallEvent,
    RunEndEvent,
    RunOnceResult,
)

__all__ = [
    "Plumr",
    "AsyncPlumr",
    "PlumrError",
    "PlumrEvent",
    "RunStartEvent",
    "StepStartEvent",
    "StepEndEvent",
    "LlmStartEvent",
    "LlmDeltaEvent",
    "LlmEndEvent",
    "ToolCallEvent",
    "RunEndEvent",
    "RunOnceResult",
]

__version__ = "0.1.0"
