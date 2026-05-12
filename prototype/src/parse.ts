import type { AdviceResponse } from "./types.js";

export function parseAdviceResponse(text: string): AdviceResponse {
  const json = extractJsonObject(text);
  return validateAdviceResponse(json);
}

function extractJsonObject(text: string): unknown {
  // Strip Markdown code fences, common patterns: ```json ... ``` or ``` ... ```.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const stripped = fenceMatch ? fenceMatch[1] : text;

  // Find the first balanced JSON object in the (stripped) text.
  const start = stripped.indexOf("{");
  if (start === -1) {
    throw new Error("no JSON object found in response");
  }

  let depth = 0;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = stripped.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (e) {
          throw new Error(
            `found JSON-like block but parsing failed: ${(e as Error).message}`,
          );
        }
      }
    }
  }
  throw new Error("unbalanced JSON braces in response");
}

function validateAdviceResponse(obj: unknown): AdviceResponse {
  if (typeof obj !== "object" || obj === null) {
    throw new Error("response is not an object");
  }
  const o = obj as Record<string, unknown>;

  if (typeof o.outfit !== "object" || o.outfit === null) {
    throw new Error("response.outfit missing or not an object");
  }
  const outfit = o.outfit as Record<string, unknown>;

  if (typeof outfit.anchorItemId !== "string" || outfit.anchorItemId.length === 0) {
    throw new Error("outfit.anchorItemId missing or empty");
  }

  if (!Array.isArray(outfit.complementItemIds)) {
    throw new Error("outfit.complementItemIds is not an array");
  }
  if (outfit.complementItemIds.length !== 3) {
    throw new Error(
      `outfit.complementItemIds must have exactly 3 entries, got ${outfit.complementItemIds.length}`,
    );
  }
  for (const id of outfit.complementItemIds) {
    if (typeof id !== "string" || id.length === 0) {
      throw new Error("each complementItemId must be a non-empty string");
    }
  }

  if (typeof o.uitleg !== "string" || o.uitleg.trim().length === 0) {
    throw new Error("response.uitleg missing or empty");
  }

  return {
    outfit: {
      anchorItemId: outfit.anchorItemId,
      complementItemIds: outfit.complementItemIds as readonly string[],
    },
    uitleg: o.uitleg,
  };
}
