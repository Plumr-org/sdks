// node --loader tsx examples/basic.ts
//   PLUMR_API_KEY=plm_live_… npx tsx examples/basic.ts

import Plumr from "@plumr/sdk";

const plumr = new Plumr({
  apiKey: process.env.PLUMR_API_KEY ?? "",
});

const stream = plumr.run({
  input: process.argv.slice(2).join(" ") || "Write a haiku about Mars.",
});

for await (const event of stream) {
  if (event.type === "llm.delta") {
    process.stdout.write(event.text);
  } else if (event.type === "run.end") {
    process.stdout.write("\n");
    console.error(`done · ${event.durationMs}ms · ${event.status}`);
    if (event.error) console.error("error:", event.error);
  }
}
