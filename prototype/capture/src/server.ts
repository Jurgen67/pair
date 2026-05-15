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
