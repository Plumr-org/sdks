/**
 * `streamText` — high-level helper that mirrors the ergonomics of
 * AI-SDK's `streamText` while delegating to Plumr's event stream.
 *
 * Use this when you want callbacks (`onText`, `onToolCall`, ...) instead
 * of pattern-matching the raw event union.
 *
 * @example
 *   await streamText(plumr, {
 *     input: "Summarise the latest run",
 *     onText: (chunk) => process.stdout.write(chunk),
 *     onToolCall: ({ label }) => console.error(`→ ${label}`),
 *   });
 */

import type { Plumr } from "./client.js";
import type {
  ErrorEvent,
  PlumrEvent,
  ReasoningDeltaEvent,
  RunEndEvent,
  RunOptions,
  ToolCallEvent,
} from "./types.js";

export interface StreamTextOptions extends RunOptions {
  /** Called for every `llm.delta` (the orchestrator's token stream). */
  onText?: (text: string, ev: { nodeId: string }) => void;

  /** Called for every `reasoning.delta` (visible chain-of-thought). */
  onReasoning?: (text: string, ev: { nodeId: string }) => void;

  /** Called for every `tool.call`. */
  onToolCall?: (ev: ToolCallEvent) => void;

  /** Called for every typed `error` event from the runtime. */
  onError?: (ev: ErrorEvent) => void;

  /**
   * Called for every event, after the typed callback above (if any).
   * Useful as an escape hatch for events the helper doesn't surface
   * dedicated callbacks for (`step.start`, `step.end`, etc.).
   */
  onEvent?: (ev: PlumrEvent) => void;
}

export interface StreamTextResult {
  /** Concatenated `llm.delta` text from all orchestrator turns. */
  text: string;
  /** Concatenated `reasoning.delta` text. Empty when none was emitted. */
  reasoning: string;
  /** Final run id (from `run.end`). */
  runId: string;
  status: "succeeded" | "failed";
  error: string | null;
  durationMs: number;
  conversationId?: string;
  toolCalls: ToolCallEvent[];
  errors: ErrorEvent[];
}

export async function streamText(
  plumr: Plumr,
  opts: StreamTextOptions,
): Promise<StreamTextResult> {
  const {
    onText,
    onReasoning,
    onToolCall,
    onError,
    onEvent,
    ...runOpts
  } = opts;

  let text = "";
  let reasoning = "";
  const toolCalls: ToolCallEvent[] = [];
  const errors: ErrorEvent[] = [];
  let end: RunEndEvent | null = null;

  for await (const ev of plumr.run(runOpts)) {
    switch (ev.type) {
      case "llm.delta":
        text += ev.text;
        onText?.(ev.text, { nodeId: ev.nodeId });
        break;
      case "reasoning.delta": {
        const r = ev as ReasoningDeltaEvent;
        reasoning += r.text;
        onReasoning?.(r.text, { nodeId: r.nodeId });
        break;
      }
      case "tool.call":
        toolCalls.push(ev);
        onToolCall?.(ev);
        break;
      case "error":
        errors.push(ev);
        onError?.(ev);
        break;
      case "run.end":
        end = ev;
        break;
      // step.start / step.end / llm.start / llm.end / run.start /
      // run.cancelled fall through to the catch-all below.
      default:
        break;
    }
    onEvent?.(ev);
  }

  if (!end) {
    // Either the stream closed early (cancellation) or the runtime crashed.
    // Surface a synthetic failed result rather than throwing — callers can
    // still inspect `errors` / `toolCalls` / `text` collected up to that
    // point.
    return {
      text,
      reasoning,
      runId: "",
      status: "failed",
      error: errors[errors.length - 1]?.message ?? "Stream ended without run.end.",
      durationMs: 0,
      toolCalls,
      errors,
    };
  }

  return {
    text,
    reasoning,
    runId: end.runId,
    status: end.status,
    error: end.error,
    durationMs: end.durationMs,
    conversationId: end.conversationId,
    toolCalls,
    errors,
  };
}
