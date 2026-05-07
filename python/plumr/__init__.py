"""Plumr — official Python SDK.

>>> from plumr import Plumr
>>> client = Plumr(api_key="plm_live_...")
>>> for event in client.run(input="hello"):
...     ...
"""

from .client import AsyncPlumr, Plumr, PlumrError
from .stream_text import StreamTextResult, astream_text, stream_text
from .types import (
    ErrorCode,
    ErrorEvent,
    InputImagePart,
    InputPart,
    InputTextPart,
    LlmDeltaEvent,
    LlmEndEvent,
    LlmStartEvent,
    PlumrEvent,
    ReasoningDeltaEvent,
    RunCancelledEvent,
    RunEndEvent,
    RunInput,
    RunOnceResult,
    RunStartEvent,
    StepEndEvent,
    StepStartEvent,
    ToolCallEvent,
)

__all__ = [
    "Plumr",
    "AsyncPlumr",
    "PlumrError",
    "stream_text",
    "astream_text",
    "StreamTextResult",
    "PlumrEvent",
    "RunStartEvent",
    "StepStartEvent",
    "StepEndEvent",
    "LlmStartEvent",
    "LlmDeltaEvent",
    "LlmEndEvent",
    "ToolCallEvent",
    "ReasoningDeltaEvent",
    "ErrorEvent",
    "ErrorCode",
    "RunEndEvent",
    "RunCancelledEvent",
    "RunOnceResult",
    "RunInput",
    "InputPart",
    "InputTextPart",
    "InputImagePart",
]

__version__ = "0.2.0"
