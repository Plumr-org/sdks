/**
 * Parse a Server-Sent Events stream into typed PlumrEvent objects. Plumr's
 * stream format is plain SSE: blank-line-separated frames, each with one or
 * more `data: ...` lines whose payload is a JSON-encoded event.
 */

import type { PlumrEvent } from "./types.js";

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<PlumrEvent, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            yield JSON.parse(payload) as PlumrEvent;
          } catch {
            // Skip malformed payloads — never abort the stream over one bad line.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
