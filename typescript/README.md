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

### Streaming

```ts
import Plumr from "@plumr/sdk";

const plumr = new Plumr({ apiKey: process.env.PLUMR_API_KEY! });

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

| Event         | Fields                                                 |
| ------------- | ------------------------------------------------------ |
| `run.start`   | `startedAt`                                            |
| `step.start`  | `nodeId`, `nodeType`, `label`, `input`                 |
| `step.end`    | `nodeId`, `output`, `durationMs`, `error`              |
| `llm.start`   | `nodeId`, `provider`, `model`                          |
| `llm.delta`   | `nodeId`, `text`                                       |
| `llm.end`     | `nodeId`, `promptTokens`, `completionTokens`           |
| `tool.call`   | `nodeId`, `label`, `note?`                             |
| `run.end`     | `runId`, `status`, `output`, `error`, `durationMs`     |

Use the `PlumrEvent` union type for exhaustive `switch` checks.

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
