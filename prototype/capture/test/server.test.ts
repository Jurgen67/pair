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
