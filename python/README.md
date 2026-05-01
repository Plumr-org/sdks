# plumr

Official Python SDK for the [Plumr](https://plumr.studio) API.

```bash
pip install plumr
# or
uv add plumr
poetry add plumr
```

Requires Python 3.9+. One runtime dep: `httpx`.

## Usage

### Streaming

```python
from plumr import Plumr

client = Plumr(api_key="plm_live_...")

for event in client.run(input="Write a haiku about Mars."):
    if event.type == "llm.delta":
        print(event.text, end="", flush=True)
    elif event.type == "step.end":
        print(f"\n✓ {event.nodeId} ({event.durationMs}ms)")
```

### One-shot

```python
result = client.run_once(input="Write a haiku about Mars.")
print(result.output)
```

### Override plum settings per call

If your plum has API-bound fields (e.g. the orchestrator's `model` is
bound to `params.model`), swap them at call time:

```python
result = client.run_once(
    input="Hello",
    params={"model": "claude-opus-4-7"},
)
```

### Async

```python
import asyncio
from plumr import AsyncPlumr

async def main():
    async with AsyncPlumr(api_key="plm_live_...") as client:
        async for event in client.run(input="hello"):
            if event.type == "llm.delta":
                print(event.text, end="", flush=True)

asyncio.run(main())
```

## Configuration

```python
Plumr(
    api_key="plm_live_...",
    base_url="https://app.plumr.studio",   # optional — for self-hosted
    timeout=300.0,                          # seconds; long for streaming
)
```

## Event reference

`run()` yields strongly-typed dataclasses — use `event.type` for
exhaustive matches:

| `event.type`   | Class             | Fields                                                  |
| -------------- | ----------------- | ------------------------------------------------------- |
| `run.start`    | `RunStartEvent`   | `startedAt`                                             |
| `step.start`   | `StepStartEvent`  | `nodeId`, `nodeType`, `label`, `input`                  |
| `step.end`     | `StepEndEvent`    | `nodeId`, `output`, `durationMs`, `error`               |
| `llm.start`    | `LlmStartEvent`   | `nodeId`, `provider`, `model`                           |
| `llm.delta`    | `LlmDeltaEvent`   | `nodeId`, `text`                                        |
| `llm.end`      | `LlmEndEvent`     | `nodeId`, `promptTokens`, `completionTokens`            |
| `tool.call`    | `ToolCallEvent`   | `nodeId`, `label`, `note?`                              |
| `run.end`      | `RunEndEvent`     | `runId`, `status`, `output`, `error`, `durationMs`      |

## Errors

```python
from plumr import PlumrError

try:
    client.run_once(input="…")
except PlumrError as e:
    print(e.status, e.body)
```

## Examples

- [`examples/basic.py`](./examples/basic.py) — minimal streaming script
- [`examples/fastapi/`](./examples/fastapi) — FastAPI proxy that
  re-streams Plumr events to a browser (coming soon)

## Develop

```bash
pip install -e ".[dev]"
pytest
ruff check
mypy plumr
```

## License

MIT
