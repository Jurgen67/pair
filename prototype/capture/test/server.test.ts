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

  describe("DELETE /api/items/:id", () => {
    async function postOneItem(
      app: ReturnType<typeof createApp>,
      category = "top",
    ): Promise<string> {
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

      const fs = await import("node:fs");
      const path = await import("node:path");
      const expectedPhoto = path.resolve(evalDataDir, `${id}.jpg`);
      expect(fs.existsSync(expectedPhoto)).toBe(true);

      const del = await request(app).delete(`/api/items/${id}`);
      expect(del.status).toBe(200);
      expect(del.body.state.items).toEqual([]);

      expect(fs.existsSync(expectedPhoto)).toBe(false);

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

      const fs = await import("node:fs");
      const path = await import("node:path");
      fs.unlinkSync(path.resolve(evalDataDir, `${id}.jpg`));

      const del = await request(app).delete(`/api/items/${id}`);
      expect(del.status).toBe(200);
      expect(del.body.state.items).toEqual([]);
    });
  });
});
