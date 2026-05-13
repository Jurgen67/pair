import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SIMONE_FIXTURE, loadLiveFixture } from "../src/fixture.js";
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

describe("loadLiveFixture", () => {
  it("returns SIMONE_FIXTURE and warns when file is missing", () => {
    const warn = vi.fn();
    const result = loadLiveFixture("does-not-exist.json", warn);
    expect(result).toBe(SIMONE_FIXTURE);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/no items\.json/i);
  });

  it("returns SIMONE_FIXTURE and warns when JSON is unparseable", () => {
    const tmp = path.join(os.tmpdir(), `live-fixture-bad-${Date.now()}.json`);
    fs.writeFileSync(tmp, "{not valid json");
    try {
      const warn = vi.fn();
      const result = loadLiveFixture(tmp, warn);
      expect(result).toBe(SIMONE_FIXTURE);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toMatch(/unparseable/i);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it("returns SIMONE_FIXTURE and warns when shape is wrong", () => {
    const tmp = path.join(os.tmpdir(), `live-fixture-wrong-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ foo: "bar" }));
    try {
      const warn = vi.fn();
      const result = loadLiveFixture(tmp, warn);
      expect(result).toBe(SIMONE_FIXTURE);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toMatch(/unexpected shape/i);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it("returns the parsed fixture when file is valid", () => {
    const tmp = path.join(os.tmpdir(), `live-fixture-ok-${Date.now()}.json`);
    const liveData = {
      user: { proportionsText: "test", styleReferences: [] },
      items: [
        { id: "top-1", category: "top", colors: "rood", occasion: "casual", photoPath: "eval-data/top-1.jpg" },
      ],
    };
    fs.writeFileSync(tmp, JSON.stringify(liveData));
    try {
      const warn = vi.fn();
      const result = loadLiveFixture(tmp, warn);
      expect(warn).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("top-1");
      expect(result.user.proportionsText).toBe("test");
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});
