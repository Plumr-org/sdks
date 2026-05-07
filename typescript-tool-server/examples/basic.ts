/**
 * 30-line example: Express server that hosts three Plumr external tools.
 *
 *   PLUMR_TOOL_SECRET=whsec_xxx node --experimental-strip-types examples/basic.ts
 *
 * In Plumr, configure each tool node with:
 *   - URL: https://your-host.example.com/tools/<tool_name>
 *   - Signing secret: matches PLUMR_TOOL_SECRET
 */
import express from "express";
import { plumrTools, ToolServerError } from "@plumr/tool-server/express";

const app = express();

app.use(
  "/tools",
  plumrTools({
    signingSecret: process.env.PLUMR_TOOL_SECRET!,
    handlers: {
      // GET /tools/get_weather → resolves args.city to a fake forecast.
      get_weather: async ({ args }) => {
        const city = String(args.city ?? "").trim();
        if (!city) throw new ToolServerError(400, "city is required");
        return { city, tempC: 21, condition: "sunny" };
      },

      // Tools can use params bound on the calling node (passed by Plumr as
      // X-Plumr-Param-* headers).
      whoami: async ({ params }) => {
        return { user: params.userId ?? "anonymous" };
      },

      // Throwing a ToolServerError lets you control the HTTP status the LLM
      // sees as the tool error.
      flaky: async () => {
        if (Math.random() < 0.1) throw new ToolServerError(503, "downstream is down");
        return { ok: true };
      },
    },
  }),
);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`tools listening on :${port}`));
