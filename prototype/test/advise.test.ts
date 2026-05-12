import { describe, it, expect, vi, beforeEach } from "vitest";
import { advise, type AdviceClient } from "../src/advise.js";
import { SIMONE_FIXTURE } from "../src/fixture.js";

// Mock fs.readFileSync so prompt-builder doesn't need real image files.
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => Buffer.from([0xff, 0xd8, 0xff])),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function mockClient(responseText: string): AdviceClient {
  return {
    create: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: responseText }],
    }),
  };
}

describe("advise", () => {
  it("returns the parsed AdviceResponse on a happy path", async () => {
    const client = mockClient(`{
      "outfit": {
        "anchorItemId": "top-1",
        "complementItemIds": ["bottom-1", "shoes-1", "coat-1"]
      },
      "uitleg": "Klassieke combinatie."
    }`);

    const result = await advise(client, SIMONE_FIXTURE, "top-1");
    expect(result.outfit.anchorItemId).toBe("top-1");
    expect(result.outfit.complementItemIds).toHaveLength(3);
    expect(client.create).toHaveBeenCalledOnce();
  });

  it("passes the built prompt to the client", async () => {
    const client = mockClient(`{
      "outfit": {
        "anchorItemId": "top-2",
        "complementItemIds": ["bottom-1","shoes-2","coat-2"]
      },
      "uitleg": "Test."
    }`);

    await advise(client, SIMONE_FIXTURE, "top-2");
    const callArg = (client.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.model).toMatch(/claude/);
    expect(callArg.messages).toHaveLength(1);
    expect(callArg.messages[0].role).toBe("user");
  });

  it("throws if the client returns no text block", async () => {
    const client: AdviceClient = {
      create: vi.fn().mockResolvedValue({ content: [] }),
    };
    await expect(advise(client, SIMONE_FIXTURE, "top-1")).rejects.toThrow(
      /no text block/i,
    );
  });
});
