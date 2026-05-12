import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { advise, AdviceClient } from "./advise.js";
import { SIMONE_FIXTURE } from "./fixture.js";

config();

const ANCHOR_DEFAULT = "top-1";

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.",
    );
    process.exit(1);
  }

  const anchorId = process.argv[2] ?? ANCHOR_DEFAULT;

  console.log(`Asking Claude for an outfit anchored on item: ${anchorId}`);
  console.log("---");

  const client = new Anthropic({ apiKey });
  const adviceClient: AdviceClient = {
    create: (params, options) => client.messages.create(params, options),
  };
  const result = await advise(adviceClient, SIMONE_FIXTURE, anchorId);

  console.log("Outfit:");
  console.log(`  anchor:   ${result.outfit.anchorItemId}`);
  for (const id of result.outfit.complementItemIds) {
    console.log(`  + slot:   ${id}`);
  }
  console.log("");
  console.log("Uitleg:");
  console.log(result.uitleg);
}

main().catch((err) => {
  console.error("advise failed:", err);
  process.exit(1);
});
