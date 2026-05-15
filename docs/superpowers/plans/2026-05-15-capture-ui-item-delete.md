# Capture-UI — Item delete + lijst — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg per-item delete + lijst van reeds toegevoegde items toe aan de throwaway capture-UI (`prototype/capture/`), zodat een foute upload tijdens de eerste capture-sessie met Simone gerecovered kan worden zonder de hele state te wissen.

**Architecture:** Splits de bestaande monolithische `server.ts` in een Express `app.ts` factory + dunne `server.ts` listener om supertest-based integratie-tests mogelijk te maken. Voeg een pure `removeItem` helper toe in `state.ts`, een `DELETE /api/items/:id` route in `app.ts`, een statische `/photos` route voor thumbnails, en client-side een lijst-render + delete-handler met native `confirm()`.

**Tech Stack:** Node.js 20+, TypeScript 5, Express 4, multer 2, Vitest 4, supertest 7 (toegevoegd in dit plan), plain JS in `public/`. Geen frameworks aan client-zijde.

**Hoort bij spec:** `docs/superpowers/specs/2026-05-15-capture-ui-item-delete-design.md`.

---

## File Structure

Decompositie-redenering: elk bestand behoudt één duidelijke verantwoordelijkheid. Het splitsen van `server.ts` introduceert geen nieuwe lagen — alleen een `createApp(opts)` factory zodat tests dezelfde routes tegen een tmpdir kunnen aanroepen.

```
prototype/capture/
├── package.json              # Modify: add supertest + @types/supertest
├── src/
│   ├── app.ts                # NEW: createApp({ evalDataDir }) factory met alle routes
│   ├── server.ts             # Modify: reduceren tot import { createApp } + app.listen + QR
│   ├── state.ts              # Modify: removeItem(fixture, id) helper toevoegen
│   └── qr.ts                 # Ongewijzigd
├── public/
│   ├── index.html            # Modify: items-lijst container vóór formulier in sectie 3
│   ├── app.js                # Modify: renderItemsList + delete-handler met confirm()
│   └── style.css             # Modify: minimal styles voor lijst-rijen + thumbnail
└── test/                     # Heeft al qr.test.ts (3) + state.test.ts (~21); dit plan vult aan
    ├── helpers.ts            # NEW: tmpdir setup helpers voor route-tests
    ├── state.test.ts         # Modify: append removeItem-describe (bestaande tests intact)
    └── server.test.ts        # NEW: integration tests voor DELETE + /photos via supertest
```

**Niet aangepast (bewust):** `prototype/src/types.ts`, `prototype/capture/src/qr.ts`, `prototype/capture/tsconfig.json`, `prototype/capture/vitest.config.ts`. Bestaande POST-routes (`/api/items`, `/api/style-refs`, `/api/proportions`, `/api/reset`) krijgen géén retroactieve tests.

---

## Task 1: Add supertest devDep en eerste smoke test (refactor-trigger)

**Files:**
- Modify: `prototype/capture/package.json`
- Create: `prototype/capture/test/helpers.ts`
- Create: `prototype/capture/test/server.test.ts`

**Doel:** supertest installeren, de helpers neerzetten voor latere route-tests, en een minimale "GET /api/state geeft 200"-test schrijven die intentioneel faalt totdat Task 2 de `createApp` factory levert. Dit dwingt de refactor af op een testbare manier.

- [ ] **Step 1: Add supertest aan `package.json`**

Modify `prototype/capture/package.json` — voeg `supertest` en `@types/supertest` toe aan `devDependencies` (alfabetisch tussen `@types/qrcode-terminal` en `tsx`):

```json
{
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/multer": "^1.4.0",
    "@types/node": "^20.11.0",
    "@types/qrcode-terminal": "^0.12.0",
    "@types/supertest": "^6.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^4.0.0"
  }
}
```

- [ ] **Step 2: Installeer de nieuwe dep**

Run:
```powershell
cd prototype/capture; npm install; cd ../..
```

Expected: install slaagt; `package-lock.json` is bijgewerkt. Geen errors.

- [ ] **Step 3: Schrijf de test-helpers**

Create `prototype/capture/test/helpers.ts`:
```ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Creates a unique temporary directory to act as EVAL_DATA_DIR for an isolated
 * route test. The caller is responsible for invoking the returned cleanup
 * function in afterEach (or equivalent).
 */
export function makeTmpEvalDataDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pair-capture-"));
  const cleanup = (): void => {
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { dir, cleanup };
}
```

- [ ] **Step 4: Schrijf de eerste failing test**

Create `prototype/capture/test/server.test.ts`:
```ts
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { makeTmpEvalDataDir } from "./helpers.js";

describe("capture app", () => {
  let evalDataDir: string;
  let cleanup: () => void;

  beforeEach(() => {
    const tmp = makeTmpEvalDataDir();
    evalDataDir = tmp.dir;
    cleanup = tmp.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("GET /api/state returns 200 with an empty fixture by default", async () => {
    const app = createApp({ evalDataDir });
    const res = await request(app).get("/api/state");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { proportionsText: "", styleReferences: [] },
      items: [],
    });
  });
});
```

- [ ] **Step 5: Run tests om te bevestigen dat ze falen**

Run:
```powershell
cd prototype/capture; npm test; cd ../..
```

Expected: FAIL — `Cannot find module '../src/app.js'` of `createApp is not a function`. Dat is precies wat we willen: het dwingt Task 2 af.

- [ ] **Step 6: Commit (geen `app.ts` nog — testfile + helpers + dep)**

Run:
```powershell
git add prototype/capture/package.json prototype/capture/package-lock.json prototype/capture/test/
git commit -m "test(capture): scaffold supertest + tmp helpers + failing smoke test"
```

Expected: commit succeed; pre-existing files niet aangeraakt.

---

## Task 2: Refactor `server.ts` → `app.ts` + `server.ts`

**Files:**
- Create: `prototype/capture/src/app.ts`
- Modify: `prototype/capture/src/server.ts`

**Doel:** Verplaats alle route-definities, multer-setup en static-mounting naar een `createApp({ evalDataDir })` factory in `app.ts`. Reduceer `server.ts` tot importer + `app.listen` + QR-print. Geen functionele wijziging aan bestaande routes. De smoke test uit Task 1 moet hierna groen worden.

- [ ] **Step 1: Maak `prototype/capture/src/app.ts`**

Create exact:
```ts
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

    for (const item of fixture.items) {
      const absPath = resolve(EVAL_DATA_DIR, "..", item.photoPath);
      try {
        fs.unlinkSync(absPath);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    }

    for (const ref of fixture.user.styleReferences) {
      const absPath = resolve(EVAL_DATA_DIR, "..", ref.photoPath);
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

  return app;
}
```

(Reden voor `resolve(EVAL_DATA_DIR, "..", item.photoPath)`: `photoPath` is opgeslagen als `"eval-data/<file>"` relatief aan `PROTOTYPE_DIR`, dus de parent van `EVAL_DATA_DIR` is `PROTOTYPE_DIR`. Behavior van de reset-route blijft identiek aan de oude monolith.)

- [ ] **Step 2: Reduceer `server.ts`**

Overwrite `prototype/capture/src/server.ts` met:
```ts
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { createApp } from "./app.js";
import { detectLocalIpv4, printQrForUrl } from "./qr.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROTOTYPE_DIR = resolve(__dirname, "../../");
const EVAL_DATA_DIR = resolve(PROTOTYPE_DIR, "eval-data");

const app = createApp({ evalDataDir: EVAL_DATA_DIR });

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, "0.0.0.0", () => {
  const ip = detectLocalIpv4();
  const url = `http://${ip}:${PORT}`;
  console.log(`Capture server listening on ${url}`);
  console.log("Scan deze QR-code op je iPhone (camera-app):");
  printQrForUrl(url);
  console.log("\nDruk Ctrl+C om te stoppen.");
});
```

- [ ] **Step 3: Run tests om te bevestigen dat de smoke test groen is**

Run:
```powershell
cd prototype/capture; npm test; cd ../..
```

Expected: PASS — de "GET /api/state returns 200" test slaagt nu.

- [ ] **Step 4: Run typecheck**

Run:
```powershell
cd prototype/capture; npm run typecheck; cd ../..
```

Expected: geen output, exit 0.

- [ ] **Step 5: Smoke-test handmatig dat de server nog start**

Run (in een aparte terminal of als korte verificatie):
```powershell
cd prototype/capture; npm start
```

Expected output (laatste regels):
```
Capture server listening on http://<ip>:3000
Scan deze QR-code op je iPhone (camera-app):
<QR pattern>
→ http://<ip>:3000
Druk Ctrl+C om te stoppen.
```

Stop met Ctrl+C. (Geen test geautomatiseerd — dit is sanity check dat de QR-print intact is.)

- [ ] **Step 6: Commit**

Run:
```powershell
git add prototype/capture/src/app.ts prototype/capture/src/server.ts
git commit -m "refactor(capture): split server.ts into app factory + thin listener"
```

---

## Task 3: TDD `removeItem` helper in `state.ts`

**Files:**
- Modify: `prototype/capture/src/state.ts`
- Modify: `prototype/capture/test/state.test.ts` (append nieuwe describe, bestaande tests intact)

**Doel:** Pure helper die een item op id verwijdert uit een `WardrobeFixture`. Past bij stijl van `addItem` / `addStyleRef` / `setProportionsText` (immutable, geen side effects).

- [ ] **Step 1: Append failing tests aan het einde van het bestaande `test/state.test.ts`**

Het bestaande bestand begint met:
```ts
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
```

Voeg `removeItem` toe aan de import-list (alfabetisch tussen `nextIdForCategory` en `setProportionsText`, of waar logisch). Append onderaan het bestand:

```ts
// ---------------------------------------------------------------------------
// removeItem
// ---------------------------------------------------------------------------
describe("removeItem", () => {
  function withThreeTops(): WardrobeFixture {
    let f = emptyFixture();
    f = addItem(f, {
      category: "top",
      colors: "wit",
      occasion: "werk",
      photoPath: "eval-data/top-1.jpg",
    });
    f = addItem(f, {
      category: "top",
      colors: "donkerblauw",
      occasion: "casual",
      photoPath: "eval-data/top-2.jpg",
    });
    f = addItem(f, {
      category: "top",
      colors: "zwart",
      occasion: "uit",
      photoPath: "eval-data/top-3.jpg",
    });
    return f;
  }

  it("verwijdert het item met de gegeven id en laat de rest staan", () => {
    const before = withThreeTops();
    const after = removeItem(before, "top-2");
    expect(after).not.toBeNull();
    expect(after!.items.map((i) => i.id)).toEqual(["top-1", "top-3"]);
  });

  it("geeft null als de id niet bestaat", () => {
    const before = withThreeTops();
    expect(removeItem(before, "top-99")).toBeNull();
  });

  it("muteert de originele fixture niet (immutable)", () => {
    const before = withThreeTops();
    const idsBefore = before.items.map((i) => i.id);
    removeItem(before, "top-2");
    expect(before.items.map((i) => i.id)).toEqual(idsBefore);
  });

  it("laat gap-fill werken: na verwijderen van top-2 krijgt de volgende top weer id top-2", () => {
    const before = withThreeTops();
    const after = removeItem(before, "top-2")!;
    expect(nextIdForCategory(after, "top")).toBe("top-2");
  });
});
```

- [ ] **Step 2: Run tests om te bevestigen dat ze falen**

Run:
```powershell
cd prototype/capture; npm test; cd ../..
```

Expected: FAIL — `removeItem is not exported from '../src/state.js'`.

- [ ] **Step 3: Voeg `removeItem` toe aan `state.ts`**

Modify `prototype/capture/src/state.ts` — voeg toe ná `setProportionsText`:
```ts
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
```

- [ ] **Step 4: Run tests om te bevestigen dat ze slagen**

Run:
```powershell
cd prototype/capture; npm test; cd ../..
```

Expected: PASS — alle 4 `removeItem`-tests groen, plus de smoke test uit Task 1.

- [ ] **Step 5: Typecheck**

Run:
```powershell
cd prototype/capture; npm run typecheck; cd ../..
```

Expected: geen output, exit 0.

- [ ] **Step 6: Commit**

Run:
```powershell
git add prototype/capture/src/state.ts prototype/capture/test/state.test.ts
git commit -m "feat(capture): add pure removeItem helper to state"
```

---

## Task 4: TDD `DELETE /api/items/:id` route

**Files:**
- Modify: `prototype/capture/src/app.ts`
- Modify: `prototype/capture/test/server.test.ts`

**Doel:** Nieuwe route die `removeItem` aanroept, de bijbehorende foto verwijdert van schijf (`ENOENT` slikken), en de geüpdate state teruggeeft.

- [ ] **Step 1: Schrijf 3 failing tests in `server.test.ts`**

Modify `prototype/capture/test/server.test.ts` — voeg deze `describe` toe ná de bestaande `it`-blok (binnen dezelfde outer `describe("capture app", ...)`):

```ts
  describe("DELETE /api/items/:id", () => {
    async function postOneItem(app: ReturnType<typeof createApp>, category = "top") {
      const res = await request(app)
        .post("/api/items")
        .field("category", category)
        .field("colors", "wit")
        .field("occasion", "werk")
        .attach("photo", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
          filename: "fake.jpg",
          contentType: "image/jpeg",
        });
      expect(res.status).toBe(201);
      return res.body.item.id as string;
    }

    it("happy path: verwijdert item uit items.json en foto van schijf", async () => {
      const app = createApp({ evalDataDir });
      const id = await postOneItem(app);

      // Foto bestaat
      const fs = await import("node:fs");
      const path = await import("node:path");
      const expectedPhoto = path.resolve(evalDataDir, `${id}.jpg`);
      expect(fs.existsSync(expectedPhoto)).toBe(true);

      const del = await request(app).delete(`/api/items/${id}`);
      expect(del.status).toBe(200);
      expect(del.body.state.items).toEqual([]);

      // Foto is weg
      expect(fs.existsSync(expectedPhoto)).toBe(false);

      // items.json reflecteert de delete
      const itemsJsonPath = path.resolve(evalDataDir, "items.json");
      const persisted = JSON.parse(fs.readFileSync(itemsJsonPath, "utf-8"));
      expect(persisted.items).toEqual([]);
    });

    it("retourneert 404 als de id niet bestaat", async () => {
      const app = createApp({ evalDataDir });
      const res = await request(app).delete("/api/items/does-not-exist");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "item not found" });
    });

    it("retourneert 200 wanneer de fotofile al weg is (ENOENT geslikt)", async () => {
      const app = createApp({ evalDataDir });
      const id = await postOneItem(app);

      // Verwijder de foto handmatig vóór de DELETE
      const fs = await import("node:fs");
      const path = await import("node:path");
      fs.unlinkSync(path.resolve(evalDataDir, `${id}.jpg`));

      const del = await request(app).delete(`/api/items/${id}`);
      expect(del.status).toBe(200);
      expect(del.body.state.items).toEqual([]);
    });
  });
```

(Reden voor de async dynamic imports binnen tests: voorkomt module-toplevel mocking-bijwerkingen en houdt de helper-file simpel. Past bij Vitest's ESM-stijl.)

- [ ] **Step 2: Run tests om te bevestigen dat ze falen**

Run:
```powershell
cd prototype/capture; npm test; cd ../..
```

Expected: FAIL — 3 tests falen met "Cannot DELETE /api/items/..." of vergelijkbare 404-default van Express. De bestaande GET-smoke test blijft groen.

- [ ] **Step 3: Voeg de DELETE-route toe in `app.ts`**

Modify `prototype/capture/src/app.ts` — voeg `removeItem` toe aan de import uit `./state.js`:
```ts
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
```

Voeg de route toe binnen de `createApp` body, direct ná `app.post("/api/reset", ...)` en vóór `return app;`:
```ts
  app.delete("/api/items/:id", (req, res) => {
    const id = req.params.id;
    const fixture = loadItemsJson(ITEMS_JSON_PATH) ?? emptyFixture();
    const item = fixture.items.find((i) => i.id === id);
    if (!item) {
      res.status(404).json({ error: "item not found" });
      return;
    }

    const absPath = resolve(EVAL_DATA_DIR, "..", item.photoPath);
    try {
      fs.unlinkSync(absPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }

    const newFixture = removeItem(fixture, id);
    if (!newFixture) {
      // Defensive: removeItem should not return null after the find-check above.
      res.status(500).json({ error: "internal: removeItem returned null" });
      return;
    }
    saveItemsJson(ITEMS_JSON_PATH, newFixture);

    res.status(200).json({ state: newFixture });
  });
```

- [ ] **Step 4: Run tests om te bevestigen dat ze slagen**

Run:
```powershell
cd prototype/capture; npm test; cd ../..
```

Expected: PASS — alle 4 tests (1 smoke + 3 DELETE) groen, plus de 4 `removeItem` unit tests.

- [ ] **Step 5: Typecheck**

Run:
```powershell
cd prototype/capture; npm run typecheck; cd ../..
```

Expected: geen output, exit 0.

- [ ] **Step 6: Commit**

Run:
```powershell
git add prototype/capture/src/app.ts prototype/capture/test/server.test.ts
git commit -m "feat(capture): DELETE /api/items/:id removes item + photo from disk"
```

---

## Task 5: Voeg statische `/photos` route toe voor thumbnails

**Files:**
- Modify: `prototype/capture/src/app.ts`
- Modify: `prototype/capture/test/server.test.ts`

**Doel:** Express-static op `EVAL_DATA_DIR` onder pad `/photos`, zodat de client `<img src="/photos/top-1.jpg">` kan gebruiken. Eén regel server-code + één test die de mount bevestigt.

- [ ] **Step 1: Schrijf een failing test**

Modify `prototype/capture/test/server.test.ts` — voeg toe na de `DELETE`-describe-blok, binnen dezelfde outer `describe`:

```ts
  describe("GET /photos/:filename", () => {
    it("serveert een bestand uit eval-data onder /photos", async () => {
      const app = createApp({ evalDataDir });
      const fs = await import("node:fs");
      const path = await import("node:path");

      const filename = "smoke.jpg";
      const content = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      fs.writeFileSync(path.resolve(evalDataDir, filename), content);

      const res = await request(app).get(`/photos/${filename}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/^image\/jpeg/);
      expect(res.body.equals(content)).toBe(true);
    });

    it("retourneert 404 voor een onbekende file", async () => {
      const app = createApp({ evalDataDir });
      const res = await request(app).get("/photos/does-not-exist.jpg");
      expect(res.status).toBe(404);
    });
  });
```

- [ ] **Step 2: Run tests om te bevestigen dat ze falen**

Run:
```powershell
cd prototype/capture; npm test; cd ../..
```

Expected: FAIL — 404 op de happy-path test (omdat `/photos` nog niet gemount is), of body komt niet binnen als Buffer.

- [ ] **Step 3: Mount `/photos` in `app.ts`**

Modify `prototype/capture/src/app.ts` — voeg deze regel toe binnen `createApp`, direct ná `app.use(express.static(path.join(__dirname, "../public")));`:

```ts
  app.use("/photos", express.static(EVAL_DATA_DIR));
```

- [ ] **Step 4: Run tests om te bevestigen dat ze slagen**

Run:
```powershell
cd prototype/capture; npm test; cd ../..
```

Expected: PASS — alle tests groen.

- [ ] **Step 5: Typecheck**

Run:
```powershell
cd prototype/capture; npm run typecheck; cd ../..
```

Expected: geen output, exit 0.

- [ ] **Step 6: Commit**

Run:
```powershell
git add prototype/capture/src/app.ts prototype/capture/test/server.test.ts
git commit -m "feat(capture): expose eval-data photos under /photos for client thumbnails"
```

---

## Task 6: Render items-lijst in de client (geen delete-handler nog)

**Files:**
- Modify: `prototype/capture/public/index.html`
- Modify: `prototype/capture/public/app.js`
- Modify: `prototype/capture/public/style.css`

**Doel:** Bij iedere `updateProgress` ook de lijst van items renderen vóór het items-formulier, mét thumbnail. De delete-knop is al aanwezig in de markup maar doet in deze task nog niets — Task 7 wired hem.

Geen automated tests: de client is plain JS zonder browser-test-infra. Handmatige check op iPhone Safari aan het eind van Task 7.

- [ ] **Step 1: Voeg de lijst-container toe aan `index.html`**

Modify `prototype/capture/public/index.html` — vervang de bestaande sectie 3 (regels 62–104, het `<section id="sectie-items">` blok) met:

```html
  <section id="sectie-items">
    <h2>Sectie 3 — Items</h2>

    <div id="items-list">
      <p class="items-list-empty">Nog geen items toegevoegd.</p>
    </div>

    <hr class="subhr">

    <p class="hint">Tip: gebruik daglicht en een neutrale achtergrond voor de beste herkenning.</p>
    <form id="form-item" novalidate>
      <label for="item-category">Categorie:</label>
      <select id="item-category" name="category" required>
        <option value="top">Top</option>
        <option value="broek_of_rok">Broek of rok</option>
        <option value="schoenen">Schoenen</option>
        <option value="jas">Jas</option>
      </select>

      <label for="item-colors">Kleur(en):</label>
      <input
        type="text"
        id="item-colors"
        name="colors"
        placeholder="bijv. donkerblauw, wit met groene streep"
        required
      >

      <label for="item-occasion">Gelegenheid:</label>
      <select id="item-occasion" name="occasion" required>
        <option value="casual">Casual</option>
        <option value="werk">Werk</option>
        <option value="uit">Uit</option>
        <option value="sport">Sport</option>
      </select>

      <label for="item-photo">Foto:</label>
      <input
        type="file"
        id="item-photo"
        name="photo"
        accept="image/*"
        capture="environment"
        required
      >

      <button type="submit" id="btn-item">Item toevoegen</button>
      <div id="feedback-item" class="feedback" aria-live="polite"></div>
    </form>
  </section>
```

- [ ] **Step 2: Voeg de render-functie toe aan `app.js`**

Modify `prototype/capture/public/app.js` — voeg deze functie toe direct boven `updateProgress` (vóór regel 39):

```js
function photoUrlFor(photoPath) {
  // photoPath is "eval-data/<filename>". The /photos static route is mounted
  // on the eval-data dir, so strip the prefix.
  var prefix = 'eval-data/';
  if (photoPath.indexOf(prefix) === 0) {
    return '/photos/' + photoPath.slice(prefix.length);
  }
  return '/photos/' + photoPath;
}

function renderItemsList(items) {
  var container = document.getElementById('items-list');
  if (items.length === 0) {
    container.innerHTML = '<p class="items-list-empty">Nog geen items toegevoegd.</p>';
    return;
  }

  var html = '<p class="items-list-count">Ingevoerde items (' + items.length + ')</p>';
  html += '<ul class="items-list-ul">';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    html += '<li class="items-list-row" data-id="' + item.id + '">';
    html += '<img class="items-list-thumb" src="' + photoUrlFor(item.photoPath) + '" alt="">';
    html += '<span class="items-list-meta">';
    html += '<strong>' + item.id + '</strong> &middot; ' + item.colors + ' &middot; ' + item.occasion;
    html += '</span>';
    html += '<button type="button" class="items-list-delete" data-id="' + item.id + '">Verwijder</button>';
    html += '</li>';
  }
  html += '</ul>';

  container.innerHTML = html;
}
```

Modify de bestaande `updateProgress` functie — voeg aan het einde toe (binnen de body, na de proporties-hint-update, vóór de closing `}`):

```js
  // Render items list
  renderItemsList(state.items);
```

- [ ] **Step 3: Voeg styling toe aan `style.css`**

Modify `prototype/capture/public/style.css` — append aan het einde van het bestand:

```css
/* Items list */
.subhr {
  border: none;
  border-top: 1px dashed #ddd;
  margin: 1rem 0;
}

.items-list-empty {
  font-size: 0.875rem;
  color: #777;
  font-style: italic;
  margin: 0.5rem 0;
}

.items-list-count {
  font-size: 0.875rem;
  color: #555;
  margin: 0 0 0.5rem;
}

.items-list-ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.items-list-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.items-list-row:last-child {
  border-bottom: none;
}

.items-list-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: #f5f5f5;
}

.items-list-meta {
  flex: 1;
  font-size: 0.875rem;
  line-height: 1.3;
  min-width: 0;
}

.items-list-delete {
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.375rem 0.625rem;
  color: #c0392b;
  background: #fff;
  border: 1px solid #c0392b;
  border-radius: 6px;
  cursor: pointer;
  touch-action: manipulation;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Smoke-test handmatig**

Run:
```powershell
cd prototype/capture; npm start
```

Open de URL/QR op iPhone of in een browser. Verwachte uitkomst:
- Eerste keer (lege `items.json`): "Nog geen items toegevoegd."
- Voeg een item toe via het formulier: na succes zie je een rij verschijnen mét thumbnail (de foto die je net upload), id, kleur, occasion en een "Verwijder"-knop (de knop doet nog niets — wordt in Task 7 wired).

Stop met Ctrl+C.

- [ ] **Step 5: Commit**

Run:
```powershell
git add prototype/capture/public/
git commit -m "feat(capture): render items list with thumbnails above the form"
```

---

## Task 7: Wire delete-handler met `confirm()` en DELETE-call

**Files:**
- Modify: `prototype/capture/public/app.js`

**Doel:** Tap op `[Verwijder]` → native `confirm()` → bij OK een `DELETE /api/items/:id` request → re-render. Bij failure: alert + behoud van huidige state.

Event delegation op `#items-list` (niet per knop een eigen listener) — past bij re-render-stijl.

- [ ] **Step 1: Voeg de delete-init-functie toe aan `app.js`**

Modify `prototype/capture/public/app.js` — voeg deze functie toe vóór de bestaande `initItems`-functie (rond regel 201):

```js
function initItemsDelete() {
  var container = document.getElementById('items-list');

  container.addEventListener('click', function(e) {
    var target = e.target;
    if (!target || target.className !== 'items-list-delete') return;

    var id = target.getAttribute('data-id');
    if (!id) return;

    var ok = window.confirm(id + ' verwijderen?');
    if (!ok) return;

    target.disabled = true;
    target.textContent = 'Bezig...';

    fetch('/api/items/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function(res) {
        if (!res.ok) return extractError(res).then(function(msg) { throw new Error(msg); });
        return res.json();
      })
      .then(function(data) {
        updateProgress(data.state);
      })
      .catch(function(err) {
        target.disabled = false;
        target.textContent = 'Verwijder';
        window.alert('Verwijderen mislukt: ' + err.message);
      });
  });
}
```

Modify de DOMContentLoaded-handler onderaan `app.js` (regel 260–265) — voeg `initItemsDelete()` toe ná `initItems()`:

```js
document.addEventListener('DOMContentLoaded', function() {
  fetchState();
  initProportions();
  initStijlRefs();
  initItems();
  initItemsDelete();
});
```

- [ ] **Step 2: Smoke-test handmatig op de iPhone (de hoofdcase)**

Run:
```powershell
cd prototype/capture; npm start
```

Op iPhone Safari (via de QR):
1. Voeg minstens 2 items toe (verschillende categorieën om gap-fill te testen).
2. Tap op de "Verwijder"-knop bij item 1.
3. Verwachte uitkomst: iOS-systeempopup met `top-1 verwijderen?` (of zijn id) → "Annuleer" sluit zonder actie, "OK" verwijdert de rij + thumbnail uit de lijst en de status-bar telt het terug.
4. Voeg een nieuw item toe in dezelfde categorie. Verwachte uitkomst: het krijgt de zojuist vrijgemaakte id (gap-fill).
5. Probeer ook: na refresh van de page is de delete persistent (gap blijft, items.json reflecteert).

Stop met Ctrl+C.

- [ ] **Step 3: Verifieer dat `eval-data/` schoon is bijgewerkt**

Run (na de smoke-test):
```powershell
ls prototype/eval-data
```

Expected: geen achtergebleven `top-1.jpg`-bestand voor het verwijderde item. `items.json` bevat het item niet meer.

Als er testfoto's achterbleven die je niet meer wilt: `Remove-Item prototype/eval-data/*` (handmatig — niet onderdeel van het plan).

- [ ] **Step 4: Run de complete test-suite + typecheck één keer**

Run:
```powershell
cd prototype/capture; npm test; npm run typecheck; cd ../..
```

Expected: PASS op alle tests, geen typecheck-output.

- [ ] **Step 5: Commit**

Run:
```powershell
git add prototype/capture/public/app.js
git commit -m "feat(capture): wire delete button with confirm + DELETE call"
```

---

## Self-Review Checklist

- [x] **Spec coverage** — Spec §3 (UI-wijziging) → Tasks 6 + 7. Spec §4.1 (refactor `app.ts`/`server.ts`) → Task 2. Spec §4.2 (`/photos` static) → Task 5. Spec §4.3 (DELETE route) → Task 4. Spec §4.4 (`removeItem` helper) → Task 3. Spec §4.5 (gap-fill blijft werken) → testcase in Task 3, Step 1, vierde test. Spec §5.1 (state-unit-tests) → Task 3. Spec §5.2 (server integration tests met supertest, tmp eval-data) → Tasks 1+4+5. Spec §6 (bestanden) → alle paden in dit plan komen overeen. Spec §7 (acceptatiecriteria) → handmatige smoke in Task 2 Step 5, Task 6 Step 4, Task 7 Step 2; geautomatiseerde dekking via tests. Spec §8 open punt over `typecheck` is bevestigd: script bestaat al in `package.json`.

- [x] **Placeholder scan** — Elke step bevat code of een commando. Geen TBD/TODO. Geen "implementeer naar gelang".

- [x] **Type-consistentie** — `removeItem` signatuur (`(fixture, id) => WardrobeFixture | null`) is identiek in Task 3 (declaratie + unit-tests) en Task 4 (gebruik in route). Import-pad `"./state.js"` consistent. `createApp({ evalDataDir })` signatuur identiek in Tasks 1 + 2 + alle volgende. `photoPath`-string `"eval-data/<filename>"` consistent gebruikt in app.ts reset + delete + client `photoUrlFor`.

- [x] **TDD-discipline** — Tasks 3, 4, 5 starten met failing test → run → impl → run → commit. Tasks 1 en 2 zijn samen één TDD-cyclus: failing smoke in Task 1, factory-implementatie in Task 2. Tasks 6 en 7 hebben geen automated test (client-side, throwaway-tool, geen browser-infra) — handmatige smoke gedocumenteerd.

- [x] **Frequent commits** — 7 tasks → 7 commits, elk semantisch (`test:`, `refactor:`, `feat:`).

- [x] **YAGNI** — Geen edit-endpoint, geen style-ref-delete, geen reset-UI, geen klaar-knop, geen browser-tests. Geen feature flags. Defensive `if (!newFixture)` in de DELETE-route is *één* lijn — geen volledige error-handling-laag.

---

## Execution Handoff

Plan complete en saved to `docs/superpowers/plans/2026-05-15-capture-ui-item-delete.md`. Twee executie-opties:

**1. Subagent-Driven (aanbevolen)** — Per task dispatch ik een fresh subagent, ik review tussendoor, snelle iteratie en clean context per task.

**2. Inline Execution** — Tasks worden in deze sessie uitgevoerd via `superpowers:executing-plans`, batch-executie met checkpoints voor jouw review.

**Welke aanpak?**
