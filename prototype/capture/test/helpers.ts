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
