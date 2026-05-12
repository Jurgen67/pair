import type {
  Message,
  MessageCreateParamsNonStreaming,
  TextBlock,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { buildPromptMessages } from "./prompt.js";
import { parseAdviceResponse } from "./parse.js";
import type { AdviceResponse, WardrobeFixture } from "./types.js";

// Minimal interface so we can mock the Anthropic SDK in tests.
// The real `Anthropic` client satisfies this shape via `client.messages`.
export interface AdviceClient {
  create(params: MessageCreateParamsNonStreaming): Promise<Message>;
}

export const ADVISE_MODEL = "claude-sonnet-4-6";

export async function advise(
  client: AdviceClient,
  fixture: WardrobeFixture,
  anchorItemId: string,
): Promise<AdviceResponse> {
  const { system, messages } = buildPromptMessages(fixture, anchorItemId);

  const response = await client.create({
    model: ADVISE_MODEL,
    max_tokens: 1024,
    system,
    messages,
  });

  const textBlock = response.content.find(
    (b): b is TextBlock => b.type === "text",
  );
  if (!textBlock) {
    throw new Error("Anthropic response contains no text block");
  }
  return parseAdviceResponse(textBlock.text);
}
