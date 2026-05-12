import type {
  Message,
  MessageCreateParamsNonStreaming,
  TextBlock,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import type { RequestOptions } from "@anthropic-ai/sdk/core.mjs";
import { buildPromptMessages } from "./prompt.js";
import { parseAdviceResponse } from "./parse.js";
import type { AdviceResponse, WardrobeFixture } from "./types.js";

// Minimal interface so we can mock the Anthropic SDK in tests.
// The real `Anthropic` client satisfies this shape via `client.messages`.
export interface AdviceClient {
  create(
    params: MessageCreateParamsNonStreaming,
    options?: RequestOptions,
  ): Promise<Message>;
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
  let parsed;
  try {
    parsed = parseAdviceResponse(textBlock.text);
  } catch (e) {
    throw new Error(
      `Failed to parse Claude response for anchor "${anchorItemId}": ${(e as Error).message}`,
      { cause: e },
    );
  }

  const knownIds = new Set(fixture.items.map((i) => i.id));
  const allReturnedIds = [
    parsed.outfit.anchorItemId,
    ...parsed.outfit.complementItemIds,
  ];
  const unknown = allReturnedIds.filter((id) => !knownIds.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `Claude returned item IDs not in fixture: ${unknown.join(", ")}`,
    );
  }

  return parsed;
}
