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
 *   reasoning.delta × N             ← streaming visible reasoning (optional)
 *   llm.end
 *   step.end
 *   …(more sub-agent / tool steps)
 *   run.end                         ← or run.cancelled / error
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
  /** USD cost estimate from Plumr's catalog price table. Null when the
   *  model isn't priced or token counts are missing. */
  costUsd?: number | null;
}

export interface ToolCallEvent {
  type: "tool.call";
  nodeId: string;
  label: string;
  note?: string;
}

/**
 * Visible-reasoning delta (built-in `_think` tool output, plus future
 * provider-native reasoning streams). Forward-typed before the runtime emits
 * it so consumers can `case "reasoning.delta"` today.
 */
export interface ReasoningDeltaEvent {
  type: "reasoning.delta";
  nodeId: string;
  text: string;
}

/**
 * Stable error taxonomy the runtime surfaces alongside `step.end.error` /
 * `run.end.error`. Older runtimes don't emit this — handle defensively.
 */
export type ErrorCode =
  | "provider_rate_limit"
  | "provider_timeout"
  | "provider_invalid_request"
  | "tool_timeout"
  | "tool_invalid_output"
  | "quota_exceeded"
  | "cancelled"
  | "internal";

export interface ErrorEvent {
  type: "error";
  /** Set when the error is attributable to a specific node. */
  nodeId?: string;
  code: ErrorCode;
  retryable: boolean;
  message: string;
}

export interface RunEndEvent {
  type: "run.end";
  runId: string;
  status: "succeeded" | "failed";
  output: string | null;
  error: string | null;
  durationMs: number;
  /** Conversation id assigned by the server (echoed when one is in use). */
  conversationId?: string;
  /** Sum of `LlmEndEvent.costUsd` across the run. Null when no model was priced. */
  totalCostUsd?: number | null;
  /** Aggregate token counts across all LLM steps. */
  totalPromptTokens?: number | null;
  totalCompletionTokens?: number | null;
}

/**
 * Emitted when the client aborts the run (the AbortSignal in RunOptions
 * fires) or the underlying request stream closes. The server may also
 * emit a final run.end with status "failed" depending on timing.
 */
export interface RunCancelledEvent {
  type: "run.cancelled";
  runId: string;
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
  | ReasoningDeltaEvent
  | ErrorEvent
  | RunEndEvent
  | RunCancelledEvent;

/* ── Input shape ──────────────────────────────────────────────────── */

export interface InputTextPart {
  type: "text";
  text: string;
}

export interface InputImagePart {
  type: "image";
  /** Public URL the model can fetch. Mutually exclusive with `base64`. */
  url?: string;
  /** Inline base64-encoded image bytes. Pair with `mediaType`. */
  base64?: string;
  /** MIME type, required when `base64` is set. e.g. "image/png", "image/jpeg". */
  mediaType?: string;
}

export type InputPart = InputTextPart | InputImagePart;

/** A multimodal input is a string OR an array of typed parts. */
export type RunInput = string | InputPart[];

/* ── Run options ──────────────────────────────────────────────────── */

export interface RunOptions {
  /**
   * The user-facing input piped into the plum's Input node. Either a
   * plain string (back-compat) or an array of {text,image} parts.
   */
  input: RunInput;

  /** Override fields on the deployed plum that bind to public API params. */
  params?: Record<string, unknown>;

  /**
   * Multi-turn: if set, the run loads prior turns from the same
   * `conversationId` and persists this turn back. Server-allocated when
   * omitted; the assigned id is echoed on `run.end`.
   */
  conversationId?: string;

  /**
   * Idempotency-Key. Replaying the same key replays the same run instead
   * of re-billing. Treat as opaque; UUIDs are fine. Cached for 24h.
   */
  idempotencyKey?: string;

  /** Abort the request mid-stream. */
  signal?: AbortSignal;
}

export interface RunOnceResult {
  runId: string;
  status: "succeeded" | "failed";
  output: string | null;
  error: string | null;
  durationMs: number;
  conversationId?: string;
  totalCostUsd?: number | null;
  totalPromptTokens?: number | null;
  totalCompletionTokens?: number | null;
}

export interface PlumrClientOptions {
  /** `plm_live_…` from the Plumr deploy modal. */
  apiKey: string;
  /** Override the API host, e.g. for self-hosted Plumr. Defaults to https://app.plumr.studio. */
  baseUrl?: string;
  /** Custom fetch (for tests, polyfills, edge runtimes). */
  fetch?: typeof globalThis.fetch;
}
