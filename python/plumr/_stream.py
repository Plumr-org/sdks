"""SSE → PlumrEvent decoder, used by both sync and async clients."""

from __future__ import annotations

import json
from typing import AsyncIterator, Iterator, Optional

from .types import PlumrEvent, parse_event


def _frames_from_chunk_buffer(buffer: str) -> tuple[list[str], str]:
    """Split a buffer at `\\n\\n` boundaries; return frames + remaining buffer."""
    frames: list[str] = []
    while True:
        sep = buffer.find("\n\n")
        if sep == -1:
            break
        frames.append(buffer[:sep])
        buffer = buffer[sep + 2 :]
    return frames, buffer


def _events_from_frame(frame: str) -> Iterator[PlumrEvent]:
    for line in frame.split("\n"):
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload:
            continue
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        ev = parse_event(data)
        if ev is not None:
            yield ev


def iter_sse_sync(stream: Iterator[bytes]) -> Iterator[PlumrEvent]:
    buffer = ""
    for chunk in stream:
        buffer += chunk.decode("utf-8", errors="replace")
        frames, buffer = _frames_from_chunk_buffer(buffer)
        for frame in frames:
            yield from _events_from_frame(frame)


async def iter_sse_async(stream: AsyncIterator[bytes]) -> AsyncIterator[PlumrEvent]:
    buffer = ""
    async for chunk in stream:
        buffer += chunk.decode("utf-8", errors="replace")
        frames, buffer = _frames_from_chunk_buffer(buffer)
        for frame in frames:
            for event in _events_from_frame(frame):
                yield event


# Re-export for type checkers.
__all__ = ["iter_sse_sync", "iter_sse_async"]


# pyright: reportUnusedFunction=false
_: Optional[PlumrEvent] = None  # keep PlumrEvent as a referenced symbol
