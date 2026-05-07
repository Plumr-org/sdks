# Plumr SDKs

Official client libraries for the [Plumr](https://plumr.studio) API.
One package per language, same shape everywhere — pick the one that
matches the language you already write.

## Languages

| Language       | Status     | Package                              | Install                                      |
| -------------- | ---------- | ------------------------------------ | -------------------------------------------- |
| **TypeScript** | ✅ Stable  | [`@plumr/sdk`](./typescript)         | `npm install @plumr/sdk`                     |
| **Python**     | ✅ Stable  | [`plumr`](./python)                  | `pip install plumr`                          |
| **Go**         | 🔜 Planned | `github.com/Plumr-org/sdks/go`        | _coming soon_                                |
| **Ruby**       | 🔜 Planned | `plumr`                               | _coming soon_                                |
| **PHP**        | 🔜 Planned | `plumr/sdk`                           | _coming soon_                                |
| **C# / .NET**  | 🔜 Planned | `Plumr.Sdk`                           | _coming soon_                                |
| **Curl**       | 📄 Docs    | —                                    | [examples →](#raw-http)                      |

### Hosting tools

| Package                        | What                                              | Install                              |
| ------------------------------ | ------------------------------------------------- | ------------------------------------ |
| [`@plumr/tool-server`](./typescript-tool-server) | Express + framework-free helper for hosting Plumr external (HTTP) tool nodes — verifies the HMAC signature, dispatches to a handler map. | `npm install @plumr/tool-server`     |

Want a language we haven't shipped? Open an
[issue](https://github.com/Plumr-org/sdks/issues/new/choose) or
[discussion](https://github.com/Plumr-org/sdks/discussions).

## What you get

Every SDK exposes the same two entry points:

- `client.run({ input, params })` — async iterator / generator over the
  full event stream from a deployed Plum (`step.start`, `llm.delta`,
  `step.end`, `run.end`, etc.).
- `client.runOnce({ input, params })` — convenience wrapper that drains
  the stream and returns the final output as a single object.

`params` lets you override fields on the deployed Plum that have been
bound to public API keys (e.g. swap the model, change the system
prompt) without redeploying.

## Quick start

### TypeScript

```bash
npm install @plumr/sdk
```

```ts
import Plumr from "@plumr/sdk";

const plumr = new Plumr({ apiKey: process.env.PLUMR_API_KEY! });

for await (const event of plumr.run({ input: "hello" })) {
  if (event.type === "llm.delta") process.stdout.write(event.text);
}
```

[Full TypeScript docs →](./typescript)

### Python

```bash
pip install plumr
```

```python
from plumr import Plumr

client = Plumr(api_key="plm_live_…")

for event in client.run(input="hello"):
    if event.type == "llm.delta":
        print(event.text, end="", flush=True)
```

[Full Python docs →](./python)

### Raw HTTP

```bash
curl -N https://app.plumr.studio/api/v1/run \
  -H "Authorization: Bearer plm_live_…" \
  -H "Content-Type: application/json" \
  -d '{"input": "hello"}'
```

The endpoint streams Server-Sent Events. See [`curl/`](./curl) for
copy-paste recipes per shell + Postman.

## Getting your API key

1. Sign in to [app.plumr.studio](https://app.plumr.studio).
2. Open the plum you want to expose, click **Deploy**.
3. The deploy modal shows your API endpoint and an auto-generated
   `plm_live_…` key. Copy it and store it as an environment variable.

Your existing API keys can also be managed under **API keys** in the
plum's editor.

## Issues + contributions

- 🐛 [Report a bug](https://github.com/Plumr-org/sdks/issues/new?template=bug_report.yml)
- ✨ [Request a feature](https://github.com/Plumr-org/sdks/issues/new?template=feature_request.yml)
- 💬 [Ask a question](https://github.com/Plumr-org/sdks/discussions)

PRs welcome. Each language directory is self-contained — read the
language-level `README.md` for build + test instructions.

## License

MIT — see [LICENSE](./LICENSE).
