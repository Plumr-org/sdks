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
   * until the run ends. The final `run.end` (or `run.cancelled` / `error`)
   * event is included.
   *
   * @example
   *   for await (const ev of plumr.run({ input: "hello" })) {
   *     if (ev.type === "llm.delta") process.stdout.write(ev.text);
   *   }
   */
  async *run(opts: RunOptions): AsyncGenerator<PlumrEvent, void, void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (opts.idempotencyKey) {
      headers["Idempotency-Key"] = opts.idempotencyKey;
    }

    const body: Record<string, unknown> = {
      input: opts.input,
    };
    if (opts.params !== undefined) body.params = opts.params;
    if (opts.conversationId !== undefined) {
      body.conversationId = opts.conversationId;
    }

    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/run`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new PlumrError(
        `Plumr ${res.status}: ${text.slice(0, 200) || res.statusText}`,
        res.status,
        text,
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
          conversationId: event.conversationId,
          totalCostUsd: event.totalCostUsd,
          totalPromptTokens: event.totalPromptTokens,
          totalCompletionTokens: event.totalCompletionTokens,
        };
      }
    }
    if (!last) {
      throw new PlumrError("Run finished without a run.end event.");
    }
    return last;
  }
}
