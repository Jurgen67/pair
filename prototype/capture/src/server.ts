import express from "express";
import multer from "multer";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { CLOTHING_CATEGORIES } from "../../src/types.js";
import type { ClothingCategory, ClothingOccasion } from "../../src/types.js";
import {
  loadItemsJson,
  saveItemsJson,
  nextIdForCategory,
  addItem,
  addStyleRef,
  setProportionsText,
  emptyFixture,
} from "./state.js";

// ---------------------------------------------------------------------------
// Path constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROTOTYPE_DIR = resolve(__dirname, "../../"); // .../prototype/
const EVAL_DATA_DIR = resolve(PROTOTYPE_DIR, "eval-data");
const ITEMS_JSON_PATH = resolve(EVAL_DATA_DIR, "items.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_OCCASIONS: ClothingOccasion[] = ["casual", "werk", "uit", "sport"];

function mimetypeToExt(mimetype: string): string | null {
  switch (mimetype) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Multer setup — memory storage, 10 MB limit
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ---------------------------------------------------------------------------
// GET /api/state
// ---------------------------------------------------------------------------

app.get("/api/state", (_req, res) => {
  const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();
  res.status(200).json(fixture);
});

// ---------------------------------------------------------------------------
// POST /api/items
// ---------------------------------------------------------------------------

app.post("/api/items", upload.single("photo"), (req, res) => {
  // Validate text fields
  const { category, colors, occasion } = req.body as {
    category?: string;
    colors?: string;
    occasion?: string;
  };

  if (
    !category ||
    !(CLOTHING_CATEGORIES as readonly string[]).includes(category)
  ) {
    res.status(400).json({ error: "invalid or missing category" });
    return;
  }
  if (!occasion || !VALID_OCCASIONS.includes(occasion as ClothingOccasion)) {
    res.status(400).json({ error: "invalid or missing occasion" });
    return;
  }
  if (!colors || colors.trim() === "") {
    res.status(400).json({ error: "colors must be a non-empty string" });
    return;
  }

  // Validate photo
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "photo is required and must be an image" });
    return;
  }
  if (!file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "photo mimetype must start with image/" });
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    res.status(400).json({ error: "photo exceeds 10 MB limit" });
    return;
  }

  const ext = mimetypeToExt(file.mimetype);
  if (!ext) {
    res
      .status(400)
      .json({ error: "unsupported image type; use jpeg, png, or webp" });
    return;
  }

  // Load / compute
  const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();
  const id = nextIdForCategory(fixture, category as ClothingCategory);
  const filename = `${id}${ext}`;
  const relativePhotoPath = `eval-data/${filename}`;
  const absolutePhotoPath = resolve(EVAL_DATA_DIR, filename);

  // Write photo
  fs.mkdirSync(EVAL_DATA_DIR, { recursive: true });
  fs.writeFileSync(absolutePhotoPath, file.buffer);

  // Update fixture
  const newFixture = addItem(fixture, {
    category: category as ClothingCategory,
    colors: colors.trim(),
    occasion: occasion as ClothingOccasion,
    photoPath: relativePhotoPath,
  });
  saveItemsJson(ITEMS_JSON_PATH, newFixture);

  const newItem = newFixture.items.find((i) => i.id === id)!;
  res.status(201).json({ item: newItem, state: newFixture });
});

// ---------------------------------------------------------------------------
// POST /api/style-refs
// ---------------------------------------------------------------------------

app.post("/api/style-refs", upload.single("photo"), (req, res) => {
  // Validate photo
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "photo is required and must be an image" });
    return;
  }
  if (!file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "photo mimetype must start with image/" });
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    res.status(400).json({ error: "photo exceeds 10 MB limit" });
    return;
  }

  const ext = mimetypeToExt(file.mimetype);
  if (!ext) {
    res
      .status(400)
      .json({ error: "unsupported image type; use jpeg, png, or webp" });
    return;
  }

  // Load fixture and check limit
  const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();
  const existingCount = fixture.user.styleReferences.length;
  if (existingCount >= 5) {
    res.status(400).json({ error: "max 5 style references" });
    return;
  }

  const n = existingCount + 1;
  const filename = `style-ref-${n}${ext}`;
  const relativePhotoPath = `eval-data/${filename}`;
  const absolutePhotoPath = resolve(EVAL_DATA_DIR, filename);

  // Write photo
  fs.mkdirSync(EVAL_DATA_DIR, { recursive: true });
  fs.writeFileSync(absolutePhotoPath, file.buffer);

  // Update fixture
  const newFixture = addStyleRef(fixture, relativePhotoPath);
  saveItemsJson(ITEMS_JSON_PATH, newFixture);

  res
    .status(201)
    .json({ styleRef: { photoPath: relativePhotoPath }, state: newFixture });
});

// ---------------------------------------------------------------------------
// POST /api/proportions
// ---------------------------------------------------------------------------

app.post("/api/proportions", (req, res) => {
  const body = req.body as { text?: unknown };
  if (typeof body.text !== "string" || body.text.trim() === "") {
    res.status(400).json({ error: "text must be a non-empty string" });
    return;
  }

  const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();
  const newFixture = setProportionsText(fixture, body.text.trim());
  saveItemsJson(ITEMS_JSON_PATH, newFixture);

  res.status(200).json({ state: newFixture });
});

// ---------------------------------------------------------------------------
// POST /api/reset
// ---------------------------------------------------------------------------

app.post("/api/reset", (req, res) => {
  if (req.headers["x-confirm-reset"] !== "yes") {
    res.status(400).json({ error: "missing X-Confirm-Reset header" });
    return;
  }

  const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();

  // Delete all item photos
  for (const item of fixture.items) {
    const absPath = resolve(PROTOTYPE_DIR, item.photoPath);
    try {
      fs.unlinkSync(absPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  // Delete all style-ref photos
  for (const ref of fixture.user.styleReferences) {
    const absPath = resolve(PROTOTYPE_DIR, ref.photoPath);
    try {
      fs.unlinkSync(absPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  // Delete items.json
  try {
    fs.unlinkSync(ITEMS_JSON_PATH);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  res.status(200).json({ state: emptyFixture() });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Capture server listening on http://0.0.0.0:${PORT}`);
});
