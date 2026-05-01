"""Plumr API client. Sync + async, both backed by httpx."""

from __future__ import annotations

from typing import Any, AsyncIterator, Iterator, Mapping, Optional

import httpx

from ._stream import iter_sse_async, iter_sse_sync
from .types import PlumrEvent, RunEndEvent, RunOnceResult

DEFAULT_BASE_URL = "https://app.plumr.studio"
USER_AGENT = "plumr-python/0.1.0"


class PlumrError(Exception):
    """Raised when the API returns a non-2xx response or the run fails to finish."""

    def __init__(self, message: str, status: Optional[int] = None, body: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.body = body


# ── Sync ─────────────────────────────────────────────────────────── #

class Plumr:
    """Synchronous Plumr client.

    Example:
        >>> client = Plumr(api_key="plm_live_...")
        >>> for event in client.run(input="hello"):
        ...     if event.type == "llm.delta":
        ...         print(event.text, end="", flush=True)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 300.0,
        client: Optional[httpx.Client] = None,
    ):
        if not api_key:
            raise PlumrError("api_key is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.Client(timeout=timeout, headers=self._default_headers())

    def _default_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": USER_AGENT,
        }

    def run(
        self,
        input: str,
        params: Optional[Mapping[str, Any]] = None,
    ) -> Iterator[PlumrEvent]:
        """Stream every event the deployed plum emits, until run.end."""
        body: dict[str, Any] = {"input": input}
        if params:
            body["params"] = dict(params)

        with self._client.stream(
            "POST",
            f"{self.base_url}/api/v1/run",
            json=body,
            headers={**self._default_headers(), "Content-Type": "application/json"},
        ) as resp:
            if resp.status_code >= 400:
                raise PlumrError(
                    f"Plumr {resp.status_code}: {resp.text[:200] or resp.reason_phrase}",
                    status=resp.status_code,
                    body=resp.text,
                )
            yield from iter_sse_sync(resp.iter_bytes())

    def run_once(
        self,
        input: str,
        params: Optional[Mapping[str, Any]] = None,
    ) -> RunOnceResult:
        """Run, drain the stream, return the final result."""
        last: Optional[RunEndEvent] = None
        for event in self.run(input=input, params=params):
            if isinstance(event, RunEndEvent):
                last = event
        if last is None:
            raise PlumrError("Run finished without a run.end event.")
        return RunOnceResult(
            runId=last.runId,
            status=last.status,
            output=last.output,
            error=last.error,
            durationMs=last.durationMs,
        )

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "Plumr":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


# ── Async ────────────────────────────────────────────────────────── #

class AsyncPlumr:
    """Async Plumr client (httpx.AsyncClient under the hood).

    Example:
        >>> async with AsyncPlumr(api_key="plm_live_...") as client:
        ...     async for event in client.run(input="hello"):
        ...         ...
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 300.0,
        client: Optional[httpx.AsyncClient] = None,
    ):
        if not api_key:
            raise PlumrError("api_key is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {api_key}",
                "User-Agent": USER_AGENT,
            },
        )

    async def run(
        self,
        input: str,
        params: Optional[Mapping[str, Any]] = None,
    ) -> AsyncIterator[PlumrEvent]:
        body: dict[str, Any] = {"input": input}
        if params:
            body["params"] = dict(params)
        async with self._client.stream(
            "POST",
            f"{self.base_url}/api/v1/run",
            json=body,
            headers={"Content-Type": "application/json"},
        ) as resp:
            if resp.status_code >= 400:
                text = await resp.aread()
                snippet = text.decode("utf-8", errors="replace")[:200]
                raise PlumrError(
                    f"Plumr {resp.status_code}: {snippet or resp.reason_phrase}",
                    status=resp.status_code,
                    body=snippet,
                )
            async for event in iter_sse_async(resp.aiter_bytes()):
                yield event

    async def run_once(
        self,
        input: str,
        params: Optional[Mapping[str, Any]] = None,
    ) -> RunOnceResult:
        last: Optional[RunEndEvent] = None
        async for event in self.run(input=input, params=params):
            if isinstance(event, RunEndEvent):
                last = event
        if last is None:
            raise PlumrError("Run finished without a run.end event.")
        return RunOnceResult(
            runId=last.runId,
            status=last.status,
            output=last.output,
            error=last.error,
            durationMs=last.durationMs,
        )

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> "AsyncPlumr":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.aclose()
