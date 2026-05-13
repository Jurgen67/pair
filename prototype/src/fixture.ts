import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { WardrobeFixture } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Path to the live items.json written by the capture server.
 * Located at prototype/eval-data/items.json (relative to this file's prototype/src/ location).
 */
export const LIVE_ITEMS_JSON_PATH = resolve(__dirname, "../eval-data/items.json");

/**
 * Loads the live fixture from items.json if present, else returns SIMONE_FIXTURE.
 * Prints a warning to stderr when falling back so the user knows.
 *
 * Validation: requires the parsed JSON to have `user` and `items` keys at top level.
 * If validation fails, also falls back (with stderr warning).
 */
export function loadLiveFixture(
  path: string = LIVE_ITEMS_JSON_PATH,
  warn: (msg: string) => void = (m) => console.error(m),
): WardrobeFixture {
  if (!existsSync(path)) {
    warn(
      `Warning: no items.json at ${path}. Using dummy SIMONE_FIXTURE — run the capture server first to record real items.`,
    );
    return SIMONE_FIXTURE;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    warn(`Warning: items.json at ${path} is unparseable. Using SIMONE_FIXTURE fallback.`);
    return SIMONE_FIXTURE;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("user" in parsed) ||
    !("items" in parsed)
  ) {
    warn(`Warning: items.json at ${path} has unexpected shape. Using SIMONE_FIXTURE fallback.`);
    return SIMONE_FIXTURE;
  }
  return parsed as WardrobeFixture;
}

// Dummy fixture for unit tests + manual eval starting point.
// During manual eval (Task 8), point photoPath values at real images in eval-data/.

export const SIMONE_FIXTURE: WardrobeFixture = {
  user: {
    proportionsText:
      "Korte benen, iets dikkere benen. Liever geen strakke pijp onder de knie.",
    styleReferences: [
      { photoPath: "eval-data/style-ref-1.jpg" },
      { photoPath: "eval-data/style-ref-2.jpg" },
    ],
  },
  items: [
    // Tops
    { id: "top-1", category: "top", colors: "wit", occasion: "werk", photoPath: "eval-data/top-1.jpg" },
    { id: "top-2", category: "top", colors: "donkerblauw", occasion: "casual", photoPath: "eval-data/top-2.jpg" },
    { id: "top-3", category: "top", colors: "zwart met patroon", occasion: "uit", photoPath: "eval-data/top-3.jpg" },
    { id: "top-4", category: "top", colors: "lichtgrijs", occasion: "casual", photoPath: "eval-data/top-4.jpg" },

    // Broeken / rokken
    { id: "bottom-1", category: "broek_of_rok", colors: "donkerblauwe jeans", occasion: "casual", photoPath: "eval-data/bottom-1.jpg" },
    { id: "bottom-2", category: "broek_of_rok", colors: "zwart", occasion: "werk", photoPath: "eval-data/bottom-2.jpg" },
    { id: "bottom-3", category: "broek_of_rok", colors: "beige", occasion: "werk", photoPath: "eval-data/bottom-3.jpg" },
    { id: "bottom-4", category: "broek_of_rok", colors: "zwarte rok", occasion: "uit", photoPath: "eval-data/bottom-4.jpg" },

    // Schoenen
    { id: "shoes-1", category: "schoenen", colors: "witte sneakers", occasion: "casual", photoPath: "eval-data/shoes-1.jpg" },
    { id: "shoes-2", category: "schoenen", colors: "zwarte loafers", occasion: "werk", photoPath: "eval-data/shoes-2.jpg" },
    { id: "shoes-3", category: "schoenen", colors: "bruine boots", occasion: "uit", photoPath: "eval-data/shoes-3.jpg" },

    // Jassen
    { id: "coat-1", category: "jas", colors: "donkergrijs trenchcoat", occasion: "werk", photoPath: "eval-data/coat-1.jpg" },
    { id: "coat-2", category: "jas", colors: "spijkerjasje", occasion: "casual", photoPath: "eval-data/coat-2.jpg" },
    { id: "coat-3", category: "jas", colors: "zwart leren jasje", occasion: "uit", photoPath: "eval-data/coat-3.jpg" },
  ],
};
