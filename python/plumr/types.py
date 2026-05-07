"""Typed event objects streamed from POST /api/v1/run."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Literal, Optional, Sequence, Union


# ── Multimodal input ────────────────────────────────────────────── #

@dataclass
class InputTextPart:
    text: str
    type: Literal["text"] = "text"


@dataclass
class InputImagePart:
    """One of `url` or `base64` must be set. `media_type` required when `base64`."""
    url: Optional[str] = None
    base64: Optional[str] = None
    media_type: Optional[str] = None
    type: Literal["image"] = "image"


InputPart = Union[InputTextPart, InputImagePart]
RunInput = Union[str, Sequence[InputPart]]


def _serialise_input(value: RunInput) -> Any:
    """Convert a RunInput into JSON-ready form."""
    if isinstance(value, str):
        return value
    out: List[dict] = []
    for part in value:
        if isinstance(part, InputTextPart):
            out.append({"type": "text", "text": part.text})
        elif isinstance(part, InputImagePart):
            entry: dict = {"type": "image"}
            if part.url is not None:
                entry["url"] = part.url
            if part.base64 is not None:
                entry["base64"] = part.base64
            if part.media_type is not None:
                entry["mediaType"] = part.media_type
            out.append(entry)
        elif isinstance(part, dict):
            # Already serialised — pass through.
            out.append(part)
        else:
            raise TypeError(f"Unsupported input part: {part!r}")
    return out


# ── Events ──────────────────────────────────────────────────────── #

@dataclass
class RunStartEvent:
    type: Literal["run.start"]
    startedAt: str


@dataclass
class StepStartEvent:
    type: Literal["step.start"]
    nodeId: str
    nodeType: str
    label: str
    input: Optional[str]


@dataclass
class StepEndEvent:
    type: Literal["step.end"]
    nodeId: str
    output: Optional[str]
    durationMs: int
    error: Optional[str]


@dataclass
class LlmStartEvent:
    type: Literal["llm.start"]
    nodeId: str
    provider: str
    model: str


@dataclass
class LlmDeltaEvent:
    type: Literal["llm.delta"]
    nodeId: str
    text: str


@dataclass
class LlmEndEvent:
    type: Literal["llm.end"]
    nodeId: str
    promptTokens: Optional[int]
    completionTokens: Optional[int]
    costUsd: Optional[float] = None


@dataclass
class ToolCallEvent:
    type: Literal["tool.call"]
    nodeId: str
    label: str
    note: Optional[str] = None


@dataclass
class ReasoningDeltaEvent:
    """Visible chain-of-thought stream (built-in `_think` tool, plus future
    provider-native reasoning). Forward-typed before the runtime emits it."""
    type: Literal["reasoning.delta"]
    nodeId: str
    text: str


ErrorCode = Literal[
    "provider_rate_limit",
    "provider_timeout",
    "provider_invalid_request",
    "tool_timeout",
    "tool_invalid_output",
    "quota_exceeded",
    "cancelled",
    "internal",
]


@dataclass
class ErrorEvent:
    """Stable error taxonomy emitted alongside step.end.error / run.end.error."""
    type: Literal["error"]
    code: ErrorCode
    retryable: bool
    message: str
    nodeId: Optional[str] = None


@dataclass
class RunEndEvent:
    type: Literal["run.end"]
    runId: str
    status: Literal["succeeded", "failed"]
    output: Optional[str]
    error: Optional[str]
    durationMs: int
    conversationId: Optional[str] = None
    totalCostUsd: Optional[float] = None
    totalPromptTokens: Optional[int] = None
    totalCompletionTokens: Optional[int] = None


@dataclass
class RunCancelledEvent:
    """Emitted when the client closes the stream (or the request signal aborts)."""
    type: Literal["run.cancelled"]
    runId: str
    durationMs: int


PlumrEvent = Union[
    RunStartEvent,
    StepStartEvent,
    StepEndEvent,
    LlmStartEvent,
    LlmDeltaEvent,
    LlmEndEvent,
    ToolCallEvent,
    ReasoningDeltaEvent,
    ErrorEvent,
    RunEndEvent,
    RunCancelledEvent,
]


@dataclass
class RunOnceResult:
    runId: str
    status: Literal["succeeded", "failed"]
    output: Optional[str]
    error: Optional[str]
    durationMs: int
    conversationId: Optional[str] = None
    totalCostUsd: Optional[float] = None
    totalPromptTokens: Optional[int] = None
    totalCompletionTokens: Optional[int] = None


_EVENT_CLASSES = {
    "run.start": RunStartEvent,
    "step.start": StepStartEvent,
    "step.end": StepEndEvent,
    "llm.start": LlmStartEvent,
    "llm.delta": LlmDeltaEvent,
    "llm.end": LlmEndEvent,
    "tool.call": ToolCallEvent,
    "reasoning.delta": ReasoningDeltaEvent,
    "error": ErrorEvent,
    "run.end": RunEndEvent,
    "run.cancelled": RunCancelledEvent,
}


def parse_event(payload: dict) -> Optional[PlumrEvent]:
    """Best-effort decode of a JSON event payload into a typed dataclass.

    Unknown event types are returned as None so the caller can skip
    silently — keeping us forward-compatible with new event types
    added on the server side.
    """
    cls = _EVENT_CLASSES.get(payload.get("type", ""))
    if cls is None:
        return None
    field_names = cls.__dataclass_fields__.keys()
    kwargs = {k: v for k, v in payload.items() if k in field_names}
    try:
        return cls(**kwargs)  # type: ignore[arg-type]
    except TypeError:
        return None
