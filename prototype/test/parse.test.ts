import { describe, it, expect } from "vitest";
import { parseAdviceResponse } from "../src/parse.js";

const VALID = `{
  "outfit": {
    "anchorItemId": "top-1",
    "complementItemIds": ["bottom-1", "shoes-1", "coat-1"]
  },
  "uitleg": "Wit topje met donkerblauwe jeans is rustig en flatteert korte benen door verticale lijn van bovenaf."
}`;

describe("parseAdviceResponse", () => {
  it("parses a clean JSON string", () => {
    const result = parseAdviceResponse(VALID);
    expect(result.outfit.anchorItemId).toBe("top-1");
    expect(result.outfit.complementItemIds).toEqual([
      "bottom-1",
      "shoes-1",
      "coat-1",
    ]);
    expect(result.uitleg).toContain("Wit topje");
  });

  it("strips ```json code fences", () => {
    const wrapped = "```json\n" + VALID + "\n```";
    const result = parseAdviceResponse(wrapped);
    expect(result.outfit.anchorItemId).toBe("top-1");
  });

  it("ignores preamble text before the JSON", () => {
    const noisy = "Hier is mijn advies:\n\n" + VALID + "\n\nDoe er je voordeel mee!";
    const result = parseAdviceResponse(noisy);
    expect(result.outfit.anchorItemId).toBe("top-1");
  });

  it("throws on missing anchorItemId", () => {
    const bad = `{
      "outfit": { "complementItemIds": ["a","b","c"] },
      "uitleg": "test"
    }`;
    expect(() => parseAdviceResponse(bad)).toThrow(/anchorItemId/);
  });

  it("throws when complementItemIds has wrong length", () => {
    const bad = `{
      "outfit": { "anchorItemId": "x", "complementItemIds": ["a","b"] },
      "uitleg": "test"
    }`;
    expect(() => parseAdviceResponse(bad)).toThrow(/complementItemIds/);
  });

  it("throws on empty uitleg", () => {
    const bad = `{
      "outfit": { "anchorItemId": "x", "complementItemIds": ["a","b","c"] },
      "uitleg": ""
    }`;
    expect(() => parseAdviceResponse(bad)).toThrow(/uitleg/);
  });

  it("throws on completely invalid input", () => {
    expect(() => parseAdviceResponse("nope")).toThrow();
  });
});
