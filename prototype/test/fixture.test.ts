import { describe, it, expect } from "vitest";
import { SIMONE_FIXTURE } from "../src/fixture.js";
import { CLOTHING_CATEGORIES } from "../src/types.js";

describe("SIMONE_FIXTURE", () => {
  it("has at least one item in every v0.1 category", () => {
    const present = new Set(SIMONE_FIXTURE.items.map((i) => i.category));
    for (const c of CLOTHING_CATEGORIES) {
      expect(present.has(c)).toBe(true);
    }
  });

  it("contains at most 30 items (spec §5 budget)", () => {
    expect(SIMONE_FIXTURE.items.length).toBeLessThanOrEqual(30);
  });

  it("has a non-empty proportions text", () => {
    expect(SIMONE_FIXTURE.user.proportionsText.trim().length).toBeGreaterThan(0);
  });

  it("has zero to five style references (spec §6)", () => {
    expect(SIMONE_FIXTURE.user.styleReferences.length).toBeGreaterThanOrEqual(0);
    expect(SIMONE_FIXTURE.user.styleReferences.length).toBeLessThanOrEqual(5);
  });

  it("has unique item IDs", () => {
    const ids = SIMONE_FIXTURE.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
