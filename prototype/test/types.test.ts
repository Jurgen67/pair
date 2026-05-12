import { describe, it, expect } from "vitest";
import { isClothingCategory, type ClothingCategory } from "../src/types.js";

describe("isClothingCategory", () => {
  it("accepts the four v0.1 categories", () => {
    const valid: ClothingCategory[] = ["top", "broek_of_rok", "schoenen", "jas"];
    for (const c of valid) {
      expect(isClothingCategory(c)).toBe(true);
    }
  });

  it("rejects categories not in v0.1 scope", () => {
    expect(isClothingCategory("accessoire")).toBe(false);
    expect(isClothingCategory("")).toBe(false);
    expect(isClothingCategory(42 as unknown as string)).toBe(false);
  });
});
