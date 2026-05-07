/**
 * Express adapter for @plumr/tool-server.
 *
 *   import express from "express";
 *   import { plumrTools } from "@plumr/tool-server/express";
 *
 *   const app = express();
 *   app.use("/tools", plumrTools({
 *     signingSecret: process.env.PLUMR_TOOL_SECRET!,
 *     handlers: {
 *       lookup_user: async ({ args }) => {
 *         const u = await db.users.find({ email: args.email });
 *         return u ? { id: u.id, name: u.name } : null;
 *       },
 *     },
 *   }));
 *
 * The middleware mounts at any base path and routes `POST <base>/<toolName>`
 * to the matching handler. It captures the raw body itself (so don't add
 * `express.json()` upstream — HMAC verification needs the exact bytes).
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  verifyAndDispatch,
  type ToolServerOptions,
} from "./index.js";

function readRawBody(req: Request): Promise<string> {
  return new Promise((resolve, reject) => {
    // Already consumed (e.g. body-parser ran first) — best-effort fallback.
    if ((req as Request & { rawBody?: string }).rawBody !== undefined) {
      resolve((req as Request & { rawBody?: string }).rawBody!);
      return;
    }
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error("request body exceeds 5MB"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function plumrTools<P = Record<string, string>>(
  opts: ToolServerOptions<P>,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST") {
      next();
      return;
    }
    // Split off the leading slash + take the LAST path segment as the tool name.
    const path = req.path.replace(/^\/+|\/+$/g, "");
    const toolName = path.split("/").pop() ?? "";
    if (!toolName) {
      res.status(400).json({ error: "missing tool name in URL" });
      return;
    }

    let rawBody: string;
    try {
      rawBody = await readRawBody(req);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "failed to read body",
      });
      return;
    }

    const result = await verifyAndDispatch(opts, {
      rawBody,
      headers: req.headers as Record<string, string | string[] | undefined>,
      toolName,
    });
    res.status(result.status).json(result.body);
  };
}
