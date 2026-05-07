# @plumr/tool-server

Tiny helper for hosting [Plumr](https://plumr.studio) external (HTTP)
tool nodes. Verifies the HMAC signature, dispatches to a typed handler
map, ships an Express adapter and a framework-free core. ~250 lines, no
runtime deps.

```bash
npm install @plumr/tool-server
```

## Why

Plumr orchestrates the agent, you write tools. The studio's "external"
tool node POSTs each tool call to a webhook URL with a signed body; this
package handles the verify + dispatch boilerplate so you can focus on the
tool logic.

## Express

```ts
import express from "express";
import { plumrTools } from "@plumr/tool-server/express";

const app = express();

app.use(
  "/tools",
  plumrTools({
    signingSecret: process.env.PLUMR_TOOL_SECRET!,
    handlers: {
      // POST /tools/lookup_user
      lookup_user: async ({ args }) => {
        const u = await db.users.find({ email: args.email });
        return u ? { id: u.id, name: u.name } : null;
      },
    },
  }),
);

app.listen(3000);
```

In Plumr's studio, configure each tool node:
- **URL:** `https://your-host.example.com/tools/lookup_user`
- **Signing secret:** matches `PLUMR_TOOL_SECRET`

Don't add `express.json()` upstream — HMAC verification needs the exact
incoming bytes.

## Framework-free

For Hono, Elysia, Fastify, raw Node, or anywhere Express isn't the right
fit, use the core dispatcher:

```ts
import { verifyAndDispatch } from "@plumr/tool-server";

const result = await verifyAndDispatch(
  {
    signingSecret: process.env.PLUMR_TOOL_SECRET!,
    handlers: { ... },
  },
  {
    rawBody, // exact incoming bytes as a string
    headers, // request.headers
    toolName, // last URL path segment
  },
);
// → { ok: true|false, status, body }
return new Response(JSON.stringify(result.body), {
  status: result.status,
  headers: { "Content-Type": "application/json" },
});
```

## Handler context

Every handler receives:

| Field        | Type                           | Source                                  |
| ------------ | ------------------------------ | --------------------------------------- |
| `args`       | `Record<string, unknown>`      | The LLM's tool-call arguments           |
| `params`     | `Record<string, string>`       | `X-Plumr-Param-*` headers (node params) |
| `callId`     | `string`                       | `X-Plumr-Call-Id` (correlation id)      |
| `toolLabel`  | `string`                       | `X-Plumr-Tool` (the node's label)       |
| `headers`    | `Record<string, string>`       | All headers, lowercased keys            |

Return any JSON-serialisable value; it becomes the tool result the LLM
receives. Throw `ToolServerError(statusCode, message)` to surface a
specific HTTP status.

## Security

- HMAC-SHA256 over `t=<unix-ts>.<raw-body>` keyed with `signingSecret`,
  matching the runtime in `lib/runtime/external.ts`.
- 5-minute timestamp tolerance by default; configurable via
  `toleranceSeconds`.
- Constant-time signature comparison.
- Optional second factor: `authToken` enforces an exact
  `Authorization: Bearer <token>` header on top of the HMAC.

If verification fails the response is `401` with a JSON `{ error }`.
Hook `onVerifyError(reason, headers)` to log failures.

## Develop

```bash
npm install
npm run build       # tsup → dist/{index,express}.{js,cjs,d.ts}
npm run typecheck
```

## License

MIT
