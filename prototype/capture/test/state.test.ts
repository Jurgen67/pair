import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  emptyFixture,
  loadItemsJson,
  saveItemsJson,
  nextIdForCategory,
  addItem,
  addStyleRef,
  setProportionsText,
} from "../src/state.js";
import type { WardrobeFixture, ClothingItem } from "../../src/types.js";

// ---------------------------------------------------------------------------
// emptyFixture
// ---------------------------------------------------------------------------
describe("emptyFixture", () => {
  it("returns the canonical empty shape", () => {
    const f = emptyFixture();
    expect(f).toEqual({
      user: { proportionsText: "", styleReferences: [] },
      items: [],
    });
  });
});

// ---------------------------------------------------------------------------
// loadItemsJson
// ---------------------------------------------------------------------------
describe("loadItemsJson", () => {
  it("returns null when file does not exist", () => {
    const result = loadItemsJson("/nonexistent/path/items.json");
    expect(result).toBeNull();
  });

  it("returns null when file contains invalid JSON", () => {
    const tmpFile = path.join(os.tmpdir(), `state-test-invalid-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, "{ not valid json <<<");
    try {
      expect(loadItemsJson(tmpFile)).toBeNull();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("returns null when JSON parses but is missing the user field", () => {
    const tmpFile = path.join(os.tmpdir(), `state-test-noshape-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ items: [] }));
    try {
      expect(loadItemsJson(tmpFile)).toBeNull();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("returns parsed fixture when file is valid", () => {
    const fixture: WardrobeFixture = {
      user: { proportionsText: "tall", styleReferences: [] },
      items: [],
    };
    const tmpFile = path.join(os.tmpdir(), `state-test-valid-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(fixture));
    try {
      expect(loadItemsJson(tmpFile)).toEqual(fixture);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

// ---------------------------------------------------------------------------
// saveItemsJson
// ---------------------------------------------------------------------------
describe("saveItemsJson", () => {
  it("writes file with 2-space indented JSON", () => {
    const tmpFile = path.join(os.tmpdir(), `state-test-save-${Date.now()}.json`);
    const fixture = emptyFixture();
    saveItemsJson(tmpFile, fixture);
    try {
      const raw = fs.readFileSync(tmpFile, "utf-8");
      expect(raw).toBe(JSON.stringify(fixture, null, 2));
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("creates parent directory if missing", () => {
    const tmpDir = path.join(os.tmpdir(), `state-test-dir-${Date.now()}`);
    const tmpFile = path.join(tmpDir, "nested", "items.json");
    const fixture = emptyFixture();
    saveItemsJson(tmpFile, fixture);
    try {
      expect(fs.existsSync(tmpFile)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// nextIdForCategory
// ---------------------------------------------------------------------------
describe("nextIdForCategory", () => {
  it("returns category-1 for an empty fixture", () => {
    const f = emptyFixture();
    expect(nextIdForCategory(f, "top")).toBe("top-1");
    expect(nextIdForCategory(f, "schoenen")).toBe("schoenen-1");
    expect(nextIdForCategory(f, "broek_of_rok")).toBe("broek_of_rok-1");
    expect(nextIdForCategory(f, "jas")).toBe("jas-1");
  });

  it("returns category-3 when top-1 and top-2 already exist", () => {
    const f: WardrobeFixture = {
      user: { proportionsText: "", styleReferences: [] },
      items: [
        { id: "top-1", category: "top", colors: "rood", occasion: "casual", photoPath: "/a.jpg" },
        { id: "top-2", category: "top", colors: "blauw", occasion: "werk", photoPath: "/b.jpg" },
      ],
    };
    expect(nextIdForCategory(f, "top")).toBe("top-3");
  });

  it("fills gap: returns top-2 when top-1 and top-3 exist", () => {
    const f: WardrobeFixture = {
      user: { proportionsText: "", styleReferences: [] },
      items: [
        { id: "top-1", category: "top", colors: "rood", occasion: "casual", photoPath: "/a.jpg" },
        { id: "top-3", category: "top", colors: "groen", occasion: "sport", photoPath: "/c.jpg" },
      ],
    };
    expect(nextIdForCategory(f, "top")).toBe("top-2");
  });

  it("different categories are independent", () => {
    const f: WardrobeFixture = {
      user: { proportionsText: "", styleReferences: [] },
      items: [
        { id: "top-1", category: "top", colors: "rood", occasion: "casual", photoPath: "/a.jpg" },
        { id: "top-2", category: "top", colors: "blauw", occasion: "werk", photoPath: "/b.jpg" },
        { id: "broek_of_rok-1", category: "broek_of_rok", colors: "zwart", occasion: "uit", photoPath: "/d.jpg" },
      ],
    };
    expect(nextIdForCategory(f, "top")).toBe("top-3");
    expect(nextIdForCategory(f, "broek_of_rok")).toBe("broek_of_rok-2");
  });
});

// ---------------------------------------------------------------------------
// addItem
// ---------------------------------------------------------------------------
describe("addItem", () => {
  it("adds item with auto-id when id is omitted", () => {
    const f = emptyFixture();
    const result = addItem(f, { category: "top", colors: "wit", occasion: "casual", photoPath: "/x.jpg" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("top-1");
  });

  it("adds item with explicit id when provided", () => {
    const f = emptyFixture();
    const result = addItem(f, { id: "top-99", category: "top", colors: "wit", occasion: "casual", photoPath: "/x.jpg" });
    expect(result.items[0].id).toBe("top-99");
  });

  it("throws when explicit id already exists in fixture", () => {
    const f: WardrobeFixture = {
      user: { proportionsText: "", styleReferences: [] },
      items: [
        { id: "top-1", category: "top", colors: "rood", occasion: "casual", photoPath: "/a.jpg" },
      ],
    };
    expect(() =>
      addItem(f, { id: "top-1", category: "top", colors: "blauw", occasion: "werk", photoPath: "/b.jpg" })
    ).toThrow();
  });

  it("does not mutate the original fixture", () => {
    const f = emptyFixture();
    const original = JSON.stringify(f);
    addItem(f, { category: "top", colors: "wit", occasion: "casual", photoPath: "/x.jpg" });
    expect(JSON.stringify(f)).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// addStyleRef
// ---------------------------------------------------------------------------
describe("addStyleRef", () => {
  it("appends the photo path", () => {
    const f = emptyFixture();
    const result = addStyleRef(f, "/photos/style1.jpg");
    expect(result.user.styleReferences).toEqual([{ photoPath: "/photos/style1.jpg" }]);
  });

  it("does not mutate the original fixture", () => {
    const f = emptyFixture();
    const original = JSON.stringify(f);
    addStyleRef(f, "/photos/style1.jpg");
    expect(JSON.stringify(f)).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// setProportionsText
// ---------------------------------------------------------------------------
describe("setProportionsText", () => {
  it("replaces proportionsText", () => {
    const f = emptyFixture();
    const result = setProportionsText(f, "lang en slank");
    expect(result.user.proportionsText).toBe("lang en slank");
  });

  it("does not mutate the original fixture", () => {
    const f = emptyFixture();
    const original = JSON.stringify(f);
    setProportionsText(f, "lang en slank");
    expect(JSON.stringify(f)).toBe(original);
  });
});
