# @plumr/sdk

Official TypeScript / Node.js SDK for the [Plumr](https://plumr.studio) API.

```bash
npm install @plumr/sdk
# or
pnpm add @plumr/sdk
yarn add @plumr/sdk
bun add @plumr/sdk
```

Requires Node 18 or newer (uses the global `fetch` API). Works in
Cloudflare Workers, Deno, Bun, and modern browsers — anywhere `fetch`
and `ReadableStream` exist.

## Usage

### `streamText` — AI-SDK-style ergonomics

Easiest way in. Callbacks for the events you actually care about, plus a
final aggregate result.

```ts
import Plumr, { streamText } from "@plumr/sdk";

const plumr = new Plumr({ apiKey: process.env.PLUMR_API_KEY! });

const result = await streamText(plumr, {
  input: "Write a haiku about Mars.",
  onText: (chunk) => process.stdout.write(chunk),
  onToolCall: ({ label }) => console.error(`→ ${label}`),
  onError: (err) => console.error(err.code, err.message),
});

console.log("\n— done in", result.durationMs, "ms");
```

### Raw event stream

Drop down to the underlying iterator when you need every event.

```ts
for await (const event of plumr.run({ input: "Write a haiku about Mars." })) {
  switch (event.type) {
    case "llm.delta":
      process.stdout.write(event.text);
      break;
    case "step.end":
      console.error(`✓ ${event.nodeId} (${event.durationMs}ms)`);
      break;
    case "run.end":
      if (event.status === "failed") {
        console.error("Run failed:", event.error);
      }
      break;
  }
}
```

### One-shot

```ts
const { output, durationMs } = await plumr.runOnce({
  input: "Write a haiku about Mars.",
});
console.log(output);
```

### Multimodal input (vision)

```ts
const result = await streamText(plumr, {
  input: [
    { type: "text", text: "What's in this picture?" },
    { type: "image", url: "https://example.com/cat.jpg" },
    // or inline:
    // { type: "image", base64: "...", mediaType: "image/png" },
  ],
});
```

The orchestrator's model has to support vision (e.g. `gpt-4o`,
`claude-sonnet-4-6`, `gemini-2.5-pro`).

### Multi-turn conversations

Pass a `conversationId` and the runtime persists the user/assistant turns
to MongoDB. New runs against the same id resume the history.

```ts
const a = await plumr.runOnce({
  input: "My name is Linas.",
  conversationId: "conv-abc",
});

const b = await plumr.runOnce({
  input: "What's my name?",
  conversationId: "conv-abc",
});
// b.output references "Linas"
```

### Override plum settings per call

If your plum has API-bound fields (e.g. the orchestrator's `model` is
bound to `params.model`), you can swap them at call time:

```ts
const result = await plumr.runOnce({
  input: "Hello",
  params: { model: "claude-opus-4-7" },
});
```

### Aborting

```ts
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 5_000);

for await (const event of plumr.run({
  input: "…",
  signal: ctrl.signal,
})) {
  // …
}
```

## Configuration

```ts
new Plumr({
  apiKey: "plm_live_…",
  baseUrl: "https://app.plumr.studio", // optional — for self-hosted
  fetch: customFetch,                   // optional — for tests / edge runtimes
});
```

## Event reference

`run()` yields strongly-typed events:

| Event              | Fields                                                  |
| ------------------ | ------------------------------------------------------- |
| `run.start`        | `startedAt`                                             |
| `step.start`       | `nodeId`, `nodeType`, `label`, `input`                  |
| `step.end`         | `nodeId`, `output`, `durationMs`, `error`               |
| `llm.start`        | `nodeId`, `provider`, `model`                           |
| `llm.delta`        | `nodeId`, `text`                                        |
| `llm.end`          | `nodeId`, `promptTokens`, `completionTokens`            |
| `tool.call`        | `nodeId`, `label`, `note?`                              |
| `reasoning.delta`  | `nodeId`, `text` — visible chain-of-thought             |
| `error`            | `code`, `retryable`, `message`, `nodeId?`               |
| `run.end`          | `runId`, `status`, `output`, `error`, `durationMs`, `conversationId?` |
| `run.cancelled`    | `runId`, `durationMs` — emitted when `signal` aborts    |

Use the `PlumrEvent` union type for exhaustive `switch` checks.

### Error codes

`error` events carry a stable taxonomy:

| Code                          | Meaning                                                |
| ----------------------------- | ------------------------------------------------------ |
| `provider_rate_limit`         | LLM provider returned 429 — `retryable: true`          |
| `provider_timeout`            | LLM call timed out — `retryable: true`                 |
| `provider_invalid_request`    | LLM provider rejected the request                       |
| `tool_timeout`                | A tool exceeded its `timeoutMs` — `retryable: true`     |
| `tool_invalid_output`         | Tool returned an unparseable response                   |
| `quota_exceeded`              | Plan quota hit                                          |
| `cancelled`                   | Run aborted by client                                   |
| `internal`                    | Anything else                                           |

## Errors

```ts
import { PlumrError } from "@plumr/sdk";

try {
  await plumr.runOnce({ input: "…" });
} catch (err) {
  if (err instanceof PlumrError) {
    console.error(err.status, err.message, err.body);
  }
}
```

## Examples

- [`examples/basic.ts`](./examples/basic.ts) — minimal streaming script
- [`examples/nextjs/`](./examples/nextjs) — Next.js Server Action piping
  the stream through to the client (coming soon)

## Develop

```bash
npm install
npm run build       # tsup → dist/index.{js,cjs,d.ts}
npm run typecheck
```

## License

MIT
