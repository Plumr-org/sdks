"""High-level callback-style helpers that mirror AI-SDK's `streamText`."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, List, Mapping, Optional

from .client import AsyncPlumr, Plumr
from .types import (
    ErrorEvent,
    LlmDeltaEvent,
    PlumrEvent,
    ReasoningDeltaEvent,
    RunEndEvent,
    RunInput,
    ToolCallEvent,
)


@dataclass
class StreamTextResult:
    text: str
    reasoning: str
    runId: str
    status: str
    error: Optional[str]
    durationMs: int
    conversationId: Optional[str] = None
    totalCostUsd: Optional[float] = None
    totalPromptTokens: Optional[int] = None
    totalCompletionTokens: Optional[int] = None
    toolCalls: List[ToolCallEvent] = field(default_factory=list)
    errors: List[ErrorEvent] = field(default_factory=list)


def stream_text(
    client: Plumr,
    input: RunInput,
    *,
    params: Optional[Mapping[str, Any]] = None,
    conversation_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    on_text: Optional[Callable[[str, str], None]] = None,
    on_reasoning: Optional[Callable[[str, str], None]] = None,
    on_tool_call: Optional[Callable[[ToolCallEvent], None]] = None,
    on_error: Optional[Callable[[ErrorEvent], None]] = None,
    on_event: Optional[Callable[[PlumrEvent], None]] = None,
) -> StreamTextResult:
    """Stream a run with callbacks; return aggregate text and metadata.

    Each `on_*` callback receives the relevant payload. `on_text` and
    `on_reasoning` receive `(text_chunk, node_id)`. `on_event` is called
    for every event (after the typed callback fires) as an escape hatch.
    """
    text = ""
    reasoning = ""
    tool_calls: List[ToolCallEvent] = []
    errors: List[ErrorEvent] = []
    end: Optional[RunEndEvent] = None

    for event in client.run(
        input=input,
        params=params,
        conversation_id=conversation_id,
        idempotency_key=idempotency_key,
    ):
        if isinstance(event, LlmDeltaEvent):
            text += event.text
            if on_text:
                on_text(event.text, event.nodeId)
        elif isinstance(event, ReasoningDeltaEvent):
            reasoning += event.text
            if on_reasoning:
                on_reasoning(event.text, event.nodeId)
        elif isinstance(event, ToolCallEvent):
            tool_calls.append(event)
            if on_tool_call:
                on_tool_call(event)
        elif isinstance(event, ErrorEvent):
            errors.append(event)
            if on_error:
                on_error(event)
        elif isinstance(event, RunEndEvent):
            end = event
        if on_event:
            on_event(event)

    if end is None:
        return StreamTextResult(
            text=text,
            reasoning=reasoning,
            runId="",
            status="failed",
            error=errors[-1].message if errors else "Stream ended without run.end.",
            durationMs=0,
            toolCalls=tool_calls,
            errors=errors,
        )

    return StreamTextResult(
        text=text,
        reasoning=reasoning,
        runId=end.runId,
        status=end.status,
        error=end.error,
        durationMs=end.durationMs,
        conversationId=end.conversationId,
        totalCostUsd=end.totalCostUsd,
        totalPromptTokens=end.totalPromptTokens,
        totalCompletionTokens=end.totalCompletionTokens,
        toolCalls=tool_calls,
        errors=errors,
    )


async def astream_text(
    client: AsyncPlumr,
    input: RunInput,
    *,
    params: Optional[Mapping[str, Any]] = None,
    conversation_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    on_text: Optional[Callable[[str, str], None]] = None,
    on_reasoning: Optional[Callable[[str, str], None]] = None,
    on_tool_call: Optional[Callable[[ToolCallEvent], None]] = None,
    on_error: Optional[Callable[[ErrorEvent], None]] = None,
    on_event: Optional[Callable[[PlumrEvent], None]] = None,
) -> StreamTextResult:
    """Async variant of `stream_text`."""
    text = ""
    reasoning = ""
    tool_calls: List[ToolCallEvent] = []
    errors: List[ErrorEvent] = []
    end: Optional[RunEndEvent] = None

    async for event in client.run(
        input=input,
        params=params,
        conversation_id=conversation_id,
        idempotency_key=idempotency_key,
    ):
        if isinstance(event, LlmDeltaEvent):
            text += event.text
            if on_text:
                on_text(event.text, event.nodeId)
        elif isinstance(event, ReasoningDeltaEvent):
            reasoning += event.text
            if on_reasoning:
                on_reasoning(event.text, event.nodeId)
        elif isinstance(event, ToolCallEvent):
            tool_calls.append(event)
            if on_tool_call:
                on_tool_call(event)
        elif isinstance(event, ErrorEvent):
            errors.append(event)
            if on_error:
                on_error(event)
        elif isinstance(event, RunEndEvent):
            end = event
        if on_event:
            on_event(event)

    if end is None:
        return StreamTextResult(
            text=text,
            reasoning=reasoning,
            runId="",
            status="failed",
            error=errors[-1].message if errors else "Stream ended without run.end.",
            durationMs=0,
            toolCalls=tool_calls,
            errors=errors,
        )

    return StreamTextResult(
        text=text,
        reasoning=reasoning,
        runId=end.runId,
        status=end.status,
        error=end.error,
        durationMs=end.durationMs,
        conversationId=end.conversationId,
        totalCostUsd=end.totalCostUsd,
        totalPromptTokens=end.totalPromptTokens,
        totalCompletionTokens=end.totalCompletionTokens,
        toolCalls=tool_calls,
        errors=errors,
    )
