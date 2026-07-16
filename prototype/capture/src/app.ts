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
  removeItem,
} from "./state.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

export interface CreateAppOptions {
  /** Absolute path to the directory holding item photos + items.json. */
  evalDataDir: string;
}

export function createApp(opts: CreateAppOptions): express.Express {
  const EVAL_DATA_DIR = opts.evalDataDir;
  const ITEMS_JSON_PATH = resolve(EVAL_DATA_DIR, "items.json");

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

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "../public")));
  app.use("/photos", express.static(EVAL_DATA_DIR));

  app.get("/api/state", (_req, res) => {
    const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();
    res.status(200).json(fixture);
  });

  app.post("/api/items", upload.single("photo"), (req, res) => {
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

    const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();
    const id = nextIdForCategory(fixture, category as ClothingCategory);
    const filename = `${id}${ext}`;
    const relativePhotoPath = `eval-data/${filename}`;
    const absolutePhotoPath = resolve(EVAL_DATA_DIR, filename);

    fs.mkdirSync(EVAL_DATA_DIR, { recursive: true });
    fs.writeFileSync(absolutePhotoPath, file.buffer);

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

  app.post("/api/style-refs", upload.single("photo"), (req, res) => {
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

    fs.mkdirSync(EVAL_DATA_DIR, { recursive: true });
    fs.writeFileSync(absolutePhotoPath, file.buffer);

    const newFixture = addStyleRef(fixture, relativePhotoPath);
    saveItemsJson(ITEMS_JSON_PATH, newFixture);

    res
      .status(201)
      .json({ styleRef: { photoPath: relativePhotoPath }, state: newFixture });
  });

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

  app.post("/api/reset", (req, res) => {
    if (req.headers["x-confirm-reset"] !== "yes") {
      res.status(400).json({ error: "missing X-Confirm-Reset header" });
      return;
    }

    const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();

    // Resolve photos by filename only (path.basename) so a tampered
    // photoPath in items.json can never make unlink escape EVAL_DATA_DIR.
    // Mirrors the DELETE /api/items/:id handler.
    for (const item of fixture.items) {
      const absPath = resolve(EVAL_DATA_DIR, path.basename(item.photoPath));
      try {
        fs.unlinkSync(absPath);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    }

    for (const ref of fixture.user.styleReferences) {
      const absPath = resolve(EVAL_DATA_DIR, path.basename(ref.photoPath));
      try {
        fs.unlinkSync(absPath);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    }

    try {
      fs.unlinkSync(ITEMS_JSON_PATH);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }

    res.status(200).json({ state: emptyFixture() });
  });

  app.delete("/api/items/:id", (req, res) => {
    const id = req.params.id;
    const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();
    const item = fixture.items.find((i) => i.id === id);
    if (!item) {
      res.status(404).json({ error: "item not found" });
      return;
    }

    // photoPath is stored as "eval-data/<filename>"; resolve against EVAL_DATA_DIR
    // by taking just the filename — works regardless of where EVAL_DATA_DIR lives.
    const absPath = resolve(EVAL_DATA_DIR, path.basename(item.photoPath));
    try {
      fs.unlinkSync(absPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }

    const newFixture = removeItem(fixture, id);
    if (!newFixture) {
      res.status(500).json({ error: "internal: removeItem returned null" });
      return;
    }
    saveItemsJson(ITEMS_JSON_PATH, newFixture);

    res.status(200).json({ state: newFixture });
  });

  return app;
}
