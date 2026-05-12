import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildPromptMessages } from "../src/prompt.js";
import { SIMONE_FIXTURE } from "../src/fixture.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => Buffer.from([0xff, 0xd8, 0xff])),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildPromptMessages", () => {
  it("returns a system string and one user message", () => {
    const { system, messages } = buildPromptMessages(SIMONE_FIXTURE, "top-1");
    expect(typeof system).toBe("string");
    expect(system.length).toBeGreaterThan(0);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
  });

  it("includes the proportions text verbatim in the user message", () => {
    const { messages } = buildPromptMessages(SIMONE_FIXTURE, "top-1");
    const flat = JSON.stringify(messages);
    expect(flat).toContain(SIMONE_FIXTURE.user.proportionsText);
  });

  it("includes every wardrobe item id in the user message", () => {
    const { messages } = buildPromptMessages(SIMONE_FIXTURE, "top-1");
    const flat = JSON.stringify(messages);
    for (const item of SIMONE_FIXTURE.items) {
      expect(flat).toContain(item.id);
    }
  });

  it("marks the anchor item explicitly", () => {
    const { messages } = buildPromptMessages(SIMONE_FIXTURE, "top-2");
    const flat = JSON.stringify(messages);
    expect(flat).toContain("ANCHOR ITEM");
    expect(flat).toContain("top-2");
  });

  it("throws when anchor id is not in the fixture", () => {
    expect(() => buildPromptMessages(SIMONE_FIXTURE, "does-not-exist")).toThrow(
      /anchor/i,
    );
  });

  it("emits image content blocks for anchor and style references", () => {
    const { messages } = buildPromptMessages(SIMONE_FIXTURE, "top-1");
    const content = messages[0].content as Array<{ type: string }>;
    const imageBlocks = content.filter((c) => c.type === "image");
    // 1 anchor + 2 style references in fixture = 3 images
    expect(imageBlocks.length).toBe(3);
  });

  it("handles empty styleReferences gracefully", () => {
    const fixture = {
      ...SIMONE_FIXTURE,
      user: { ...SIMONE_FIXTURE.user, styleReferences: [] },
    };
    const { messages } = buildPromptMessages(fixture, "top-1");
    const content = messages[0].content as Array<{ type: string }>;
    const imageBlocks = content.filter((c) => c.type === "image");
    // Only the anchor image — no style references
    expect(imageBlocks).toHaveLength(1);
    expect(JSON.stringify(messages)).toContain("(geen)");
  });

  it("system prompt names the 4 v0.1 outfit slots and forbids accessories", () => {
    const { system } = buildPromptMessages(SIMONE_FIXTURE, "top-1");
    expect(system).toMatch(/top/i);
    expect(system).toMatch(/broek/i);
    expect(system).toMatch(/schoen/i);
    expect(system).toMatch(/jas/i);
    expect(system).toMatch(/accessoire/i);
    // Must instruct the model not to add accessories
    expect(system.toLowerCase()).toContain("geen accessoire");
  });

  it("system prompt requires JSON output", () => {
    const { system } = buildPromptMessages(SIMONE_FIXTURE, "top-1");
    expect(system.toLowerCase()).toContain("json");
  });
});
