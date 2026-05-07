/**
 * @plumr/tool-server — host Plumr external (HTTP) tool nodes with five lines of code.
 *
 * Plumr's runtime POSTs each tool call to a webhook URL with:
 *   - body:    {"args": <llm tool args>, "callId": "<32-hex>"}
 *   - headers: X-Plumr-Signature: t=<unix-ts>,v1=<hex-hmac-sha256 of "t=<ts>.<body>">
 *              X-Plumr-Call-Id, X-Plumr-Tool, optional Authorization,
 *              and X-Plumr-Param-<k> bag for params bound at the node.
 * The receiver (you) returns JSON; that JSON becomes the tool result the LLM sees.
 *
 * This package wraps the verify + dispatch boilerplate. Bring your own framework
 * via `verifyAndDispatch`, or drop in the `express` adapter:
 *
 *   import { plumrTools } from "@plumr/tool-server/express";
 *   app.use("/tools", plumrTools({
 *     signingSecret: process.env.PLUMR_TOOL_SECRET!,
 *     handlers: {
 *       lookup_user: async ({ args, params }) => {
 *         const u = await db.users.find(args.email);
 *         return { name: u.name };
 *       },
 *     },
 *   }));
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/* ── Public types ─────────────────────────────────────────────────── */

export interface ToolHandlerContext<P = Record<string, string>> {
  /** LLM-provided tool arguments, parsed from JSON. Shape matches the tool's `inputSchema`. */
  args: Record<string, unknown>;
  /** `params.*` bag bound on the calling node. Forwarded by Plumr as `X-Plumr-Param-*` headers. */
  params: P;
  /** Plumr-issued correlation id (`X-Plumr-Call-Id`). Use it for tracing. */
  callId: string;
  /** Tool node label (`X-Plumr-Tool`). */
  toolLabel: string;
  /** Raw incoming headers (lowercased keys), in case you need anything else. */
  headers: Record<string, string>;
}

export type ToolHandler<P = Record<string, string>> = (
  ctx: ToolHandlerContext<P>,
) => Promise<unknown> | unknown;

export type ToolHandlers<P = Record<string, string>> = Record<string, ToolHandler<P>>;

export interface ToolServerOptions<P = Record<string, string>> {
  /** Map of tool name → handler. Tool name = `<route segment>` after `/tools/`. */
  handlers: ToolHandlers<P>;
  /** Required HMAC signing secret. Configure the same value on every tool node in Plumr. */
  signingSecret: string;
  /** Reject signatures older than this many seconds. Defaults to 5 minutes. */
  toleranceSeconds?: number;
  /** Optional bearer token check (matches `Authorization: Bearer <token>`). */
  authToken?: string;
  /**
   * Callback for verification failures, useful for logging. Throwing inside
   * the callback does NOT alter the response — the verifier always returns
   * 401 on failure.
   */
  onVerifyError?: (reason: string, headers: Record<string, string>) => void;
}

export class ToolServerError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ToolServerError";
  }
}

/* ── Signature verification ───────────────────────────────────────── */

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

interface ParsedSignature {
  timestamp: number;
  v1: string;
}

function parseSignatureHeader(header: string | undefined): ParsedSignature | null {
  if (!header) return null;
  let timestamp = 0;
  let v1 = "";
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = Number(value);
    else if (key === "v1") v1 = value;
  }
  if (!timestamp || !v1) return null;
  return { timestamp, v1 };
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a Plumr signature header against the raw body. Returns `null` on
 * success, or an explanation string on failure.
 */
export function verifySignature(args: {
  rawBody: string;
  signatureHeader: string | undefined;
  signingSecret: string;
  toleranceSeconds?: number;
}): string | null {
  const parsed = parseSignatureHeader(args.signatureHeader);
  if (!parsed) return "missing or malformed X-Plumr-Signature";

  const tolerance = args.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return `signature timestamp outside tolerance (${tolerance}s)`;
  }

  const expected = createHmac("sha256", args.signingSecret)
    .update(`t=${parsed.timestamp}.${args.rawBody}`, "utf8")
    .digest("hex");

  if (!constantTimeEquals(parsed.v1, expected)) {
    return "signature mismatch";
  }
  return null;
}

/* ── Header normalisation ─────────────────────────────────────────── */

function lowercaseHeaders(input: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(",") : v;
  }
  return out;
}

/** Extract the `X-Plumr-Param-*` bag into a flat object. */
export function extractPlumrParams(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.startsWith("x-plumr-param-")) {
      out[k.slice("x-plumr-param-".length)] = v;
    }
  }
  return out;
}

/* ── Framework-free dispatch ──────────────────────────────────────── */

export interface VerifyAndDispatchInput {
  /** Raw request body as the bytes/string Plumr signed. Critical: must be the
   *  exact bytes — *don't* `JSON.parse → JSON.stringify` it. */
  rawBody: string;
  /** Lowercased or mixed-case header map. */
  headers: Record<string, string | string[] | undefined>;
  /** Tool name (last URL path segment). */
  toolName: string;
}

export interface VerifyAndDispatchSuccess {
  ok: true;
  /** JSON-serialise this to the response body. */
  body: unknown;
  status: 200;
}

export interface VerifyAndDispatchFailure {
  ok: false;
  status: 400 | 401 | 404 | 500;
  /** JSON-serialise this to the response body. */
  body: { error: string };
}

export type VerifyAndDispatchResult =
  | VerifyAndDispatchSuccess
  | VerifyAndDispatchFailure;

/**
 * Framework-free dispatcher. Pass the raw body, the headers, and the tool
 * name; receive a status + body to return. Use `express.ts` for an Express
 * adapter, or wire this into your own framework.
 */
export async function verifyAndDispatch<P>(
  opts: ToolServerOptions<P>,
  input: VerifyAndDispatchInput,
): Promise<VerifyAndDispatchResult> {
  if (!opts.signingSecret) {
    return {
      ok: false,
      status: 500,
      body: { error: "Plumr tool-server: signingSecret is required." },
    };
  }

  const headers = lowercaseHeaders(input.headers);

  // Optional bearer token check (in addition to HMAC).
  if (opts.authToken) {
    const auth = headers["authorization"] ?? "";
    const expected = `Bearer ${opts.authToken}`;
    if (auth !== expected) {
      opts.onVerifyError?.("invalid bearer token", headers);
      return { ok: false, status: 401, body: { error: "unauthorized" } };
    }
  }

  // HMAC verification.
  const verifyError = verifySignature({
    rawBody: input.rawBody,
    signatureHeader: headers["x-plumr-signature"],
    signingSecret: opts.signingSecret,
    toleranceSeconds: opts.toleranceSeconds,
  });
  if (verifyError) {
    opts.onVerifyError?.(verifyError, headers);
    return { ok: false, status: 401, body: { error: verifyError } };
  }

  // Body parse.
  let body: { args?: unknown; callId?: string };
  try {
    body = JSON.parse(input.rawBody);
  } catch {
    return { ok: false, status: 400, body: { error: "invalid JSON body" } };
  }
  const args =
    body.args && typeof body.args === "object"
      ? (body.args as Record<string, unknown>)
      : {};
  const callId = typeof body.callId === "string" ? body.callId : "";
  const toolLabel = headers["x-plumr-tool"] ?? input.toolName;

  // Handler lookup.
  const handler = opts.handlers[input.toolName];
  if (!handler) {
    return { ok: false, status: 404, body: { error: `unknown tool: ${input.toolName}` } };
  }

  const params = extractPlumrParams(headers) as P;

  try {
    const result = await handler({
      args,
      params,
      callId,
      toolLabel,
      headers,
    });
    return { ok: true, status: 200, body: result ?? null };
  } catch (err) {
    if (err instanceof ToolServerError) {
      return {
        ok: false,
        status: err.statusCode as VerifyAndDispatchFailure["status"],
        body: { error: err.message },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: err instanceof Error ? err.message : "tool error" },
    };
  }
}
