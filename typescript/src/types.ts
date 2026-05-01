/**
 * Event types streamed from POST /api/v1/run. The order in a typical
 * successful run looks like:
 *
 *   run.start
 *   step.start                      ← input node
 *   step.end
 *   step.start                      ← orchestrator
 *   llm.start
 *   llm.delta × N                   ← streaming text
 *   llm.end
 *   step.end
 *   …(more sub-agent / tool steps)
 *   run.end
 */

export interface RunStartEvent {
  type: "run.start";
  startedAt: string;
}

export interface StepStartEvent {
  type: "step.start";
  nodeId: string;
  nodeType: string;
  label: string;
  input: string | null;
}

export interface StepEndEvent {
  type: "step.end";
  nodeId: string;
  output: string | null;
  durationMs: number;
  error: string | null;
}

export interface LlmStartEvent {
  type: "llm.start";
  nodeId: string;
  provider: string;
  model: string;
}

export interface LlmDeltaEvent {
  type: "llm.delta";
  nodeId: string;
  text: string;
}

export interface LlmEndEvent {
  type: "llm.end";
  nodeId: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface ToolCallEvent {
  type: "tool.call";
  nodeId: string;
  label: string;
  note?: string;
}

export interface RunEndEvent {
  type: "run.end";
  runId: string;
  status: "succeeded" | "failed";
  output: string | null;
  error: string | null;
  durationMs: number;
}

export type PlumrEvent =
  | RunStartEvent
  | StepStartEvent
  | StepEndEvent
  | LlmStartEvent
  | LlmDeltaEvent
  | LlmEndEvent
  | ToolCallEvent
  | RunEndEvent;

export interface RunOptions {
  /** The user-facing input that gets piped into the plum's Input node. */
  input: string;
  /** Override fields on the deployed plum bound to public API params. */
  params?: Record<string, unknown>;
  /** Abort the request mid-stream. */
  signal?: AbortSignal;
}

export interface RunOnceResult {
  runId: string;
  status: "succeeded" | "failed";
  output: string | null;
  error: string | null;
  durationMs: number;
}

export interface PlumrClientOptions {
  /** `plm_live_…` from the Plumr deploy modal. */
  apiKey: string;
  /** Override the API host, e.g. for self-hosted Plumr. Defaults to https://app.plumr.studio. */
  baseUrl?: string;
  /** Custom fetch (for tests, polyfills, edge runtimes). */
  fetch?: typeof globalThis.fetch;
}
