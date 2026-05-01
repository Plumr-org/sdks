"""Typed event objects streamed from POST /api/v1/run."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional, Union


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


@dataclass
class ToolCallEvent:
    type: Literal["tool.call"]
    nodeId: str
    label: str
    note: Optional[str] = None


@dataclass
class RunEndEvent:
    type: Literal["run.end"]
    runId: str
    status: Literal["succeeded", "failed"]
    output: Optional[str]
    error: Optional[str]
    durationMs: int


PlumrEvent = Union[
    RunStartEvent,
    StepStartEvent,
    StepEndEvent,
    LlmStartEvent,
    LlmDeltaEvent,
    LlmEndEvent,
    ToolCallEvent,
    RunEndEvent,
]


@dataclass
class RunOnceResult:
    runId: str
    status: Literal["succeeded", "failed"]
    output: Optional[str]
    error: Optional[str]
    durationMs: int


_EVENT_CLASSES = {
    "run.start": RunStartEvent,
    "step.start": StepStartEvent,
    "step.end": StepEndEvent,
    "llm.start": LlmStartEvent,
    "llm.delta": LlmDeltaEvent,
    "llm.end": LlmEndEvent,
    "tool.call": ToolCallEvent,
    "run.end": RunEndEvent,
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
    # Build kwargs that match the dataclass fields, dropping anything else.
    field_names = cls.__dataclass_fields__.keys()
    kwargs = {k: v for k, v in payload.items() if k in field_names}
    try:
        return cls(**kwargs)  # type: ignore[arg-type]
    except TypeError:
        return None
