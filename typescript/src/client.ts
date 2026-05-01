import type {
  PlumrClientOptions,
  PlumrEvent,
  RunOnceResult,
  RunOptions,
} from "./types.js";
import { parseSSE } from "./stream.js";

const DEFAULT_BASE_URL = "https://app.plumr.studio";

export class PlumrError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "PlumrError";
  }
}

export class Plumr {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(opts: PlumrClientOptions) {
    if (!opts.apiKey) throw new PlumrError("apiKey is required.");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Stream every event the deployed plum emits. Yields PlumrEvent objects
   * until the run ends. The final `run.end` event is included.
   *
   * @example
   *   for await (const ev of plumr.run({ input: "hello" })) {
   *     if (ev.type === "llm.delta") process.stdout.write(ev.text);
   *   }
   */
  async *run(opts: RunOptions): AsyncGenerator<PlumrEvent, void, void> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: opts.input,
        params: opts.params,
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      throw new PlumrError(
        `Plumr ${res.status}: ${body.slice(0, 200) || res.statusText}`,
        res.status,
        body,
      );
    }

    yield* parseSSE(res.body);
  }

  /**
   * Convenience: run, drain the stream, return the final result. Use
   * `run()` instead if you need progress events.
   */
  async runOnce(opts: RunOptions): Promise<RunOnceResult> {
    let last: RunOnceResult | null = null;
    for await (const event of this.run(opts)) {
      if (event.type === "run.end") {
        last = {
          runId: event.runId,
          status: event.status,
          output: event.output,
          error: event.error,
          durationMs: event.durationMs,
        };
      }
    }
    if (!last) {
      throw new PlumrError("Run finished without a run.end event.");
    }
    return last;
  }
}
