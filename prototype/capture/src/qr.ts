import * as os from "node:os";
import qrcodeTerminal from "qrcode-terminal";

/**
 * Returns the first non-loopback, non-internal IPv4 address found on this machine,
 * or "127.0.0.1" as fallback if none is found.
 */
export function detectLocalIpv4(): string {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue;
    for (const entry of iface) {
      if (entry.family === "IPv4" && entry.internal === false) {
        return entry.address;
      }
    }
  }
  return "127.0.0.1";
}

/**
 * Prints a QR code encoding the URL plus the plain URL string. Uses qrcode-terminal.
 * For testing, the actual printing is done via the optional `output` parameter
 * (defaults to console.log).
 */
export function printQrForUrl(
  url: string,
  output: (s: string) => void = console.log,
): void {
  qrcodeTerminal.generate(url, { small: true }, (qr) => output(qr));
  output("→ " + url);
}
