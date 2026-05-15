import * as fs from "fs";
import * as path from "path";
import type {
  WardrobeFixture,
  ClothingCategory,
  ClothingItem,
} from "../../src/types.js";

/** Returns an empty WardrobeFixture as a starting point for a fresh capture session. */
export function emptyFixture(): WardrobeFixture {
  return {
    user: { proportionsText: "", styleReferences: [] },
    items: [],
  };
}

/**
 * Reads items.json from disk.
 * Returns null if the file doesn't exist, contains invalid JSON,
 * or doesn't match the expected WardrobeFixture shape.
 */
export function loadItemsJson(filePath: string): WardrobeFixture | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("user" in parsed) ||
      !("items" in parsed)
    ) {
      return null;
    }
    return parsed as WardrobeFixture;
  } catch {
    return null;
  }
}

/**
 * Writes the fixture to a JSON file with 2-space indentation.
 * Creates parent directories if they don't exist.
 */
export function saveItemsJson(filePath: string, fixture: WardrobeFixture): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2), "utf-8");
}

/**
 * Computes the next item id for a given category by scanning existing items.
 * Fills gaps: if top-1 and top-3 exist, returns top-2.
 */
export function nextIdForCategory(
  fixture: WardrobeFixture,
  category: ClothingCategory,
): string {
  const usedNumbers = new Set<number>();
  for (const item of fixture.items) {
    if (item.category === category) {
      const match = item.id.match(/^.+-(\d+)$/);
      if (match) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    }
  }
  let n = 1;
  while (usedNumbers.has(n)) {
    n++;
  }
  return `${category}-${n}`;
}

/**
 * Returns a new fixture with the given item added.
 * Auto-assigns an id via nextIdForCategory if id is omitted or empty string.
 * Throws if an explicit id is provided and already exists.
 */
export function addItem(
  fixture: WardrobeFixture,
  newItem: Omit<ClothingItem, "id"> & { id?: string },
): WardrobeFixture {
  const id =
    newItem.id === undefined || newItem.id === ""
      ? nextIdForCategory(fixture, newItem.category)
      : newItem.id;

  if (fixture.items.some((item) => item.id === id)) {
    throw new Error(`Item with id "${id}" already exists in fixture.`);
  }

  const item: ClothingItem = {
    id,
    category: newItem.category,
    colors: newItem.colors,
    occasion: newItem.occasion,
    photoPath: newItem.photoPath,
  };

  return {
    ...fixture,
    items: [...fixture.items, item],
  };
}

/** Returns a new fixture with the given style reference appended. */
export function addStyleRef(fixture: WardrobeFixture, photoPath: string): WardrobeFixture {
  return {
    ...fixture,
    user: {
      ...fixture.user,
      styleReferences: [...fixture.user.styleReferences, { photoPath }],
    },
  };
}

/** Returns a new fixture with proportionsText replaced. */
export function setProportionsText(
  fixture: WardrobeFixture,
  text: string,
): WardrobeFixture {
  return {
    ...fixture,
    user: {
      ...fixture.user,
      proportionsText: text,
    },
  };
}

/**
 * Returns a new fixture with the item identified by `id` removed.
 * Returns null if no item with that id exists.
 */
export function removeItem(
  fixture: WardrobeFixture,
  id: string,
): WardrobeFixture | null {
  const idx = fixture.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  return {
    ...fixture,
    items: fixture.items.filter((item) => item.id !== id),
  };
}
