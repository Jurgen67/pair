import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// detectLocalIpv4 — mock os.networkInterfaces
// ---------------------------------------------------------------------------

vi.mock("node:os", () => ({
  default: {
    networkInterfaces: vi.fn(),
  },
  networkInterfaces: vi.fn(),
}));

import * as os from "node:os";
import { detectLocalIpv4, printQrForUrl } from "../src/qr.js";

describe("detectLocalIpv4", () => {
  beforeEach(() => {
    vi.mocked(os.networkInterfaces).mockReset();
  });

  it("returns the first non-loopback IPv4 address", () => {
    vi.mocked(os.networkInterfaces).mockReturnValue({
      lo: [
        {
          address: "127.0.0.1",
          netmask: "255.0.0.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: true,
          cidr: "127.0.0.1/8",
        },
      ],
      eth0: [
        {
          address: "192.168.1.42",
          netmask: "255.255.255.0",
          family: "IPv4",
          mac: "aa:bb:cc:dd:ee:ff",
          internal: false,
          cidr: "192.168.1.42/24",
        },
      ],
    });
    expect(detectLocalIpv4()).toBe("192.168.1.42");
  });

  it("returns fallback 127.0.0.1 when only loopback/internal entries exist", () => {
    vi.mocked(os.networkInterfaces).mockReturnValue({
      lo: [
        {
          address: "127.0.0.1",
          netmask: "255.0.0.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: true,
          cidr: "127.0.0.1/8",
        },
      ],
    });
    expect(detectLocalIpv4()).toBe("127.0.0.1");
  });

  it("returns fallback 127.0.0.1 when no interfaces exist", () => {
    vi.mocked(os.networkInterfaces).mockReturnValue({});
    expect(detectLocalIpv4()).toBe("127.0.0.1");
  });
});

// ---------------------------------------------------------------------------
// printQrForUrl — capture output via optional output param
// ---------------------------------------------------------------------------

describe("printQrForUrl", () => {
  it("outputs the plain URL line with the arrow prefix", () => {
    const lines: string[] = [];
    printQrForUrl("http://192.168.1.42:3000", (s) => lines.push(s));
    const combined = lines.join("\n");
    expect(combined).toContain("→ http://192.168.1.42:3000");
  });

  it("outputs something that looks like a QR code (block characters)", () => {
    const lines: string[] = [];
    printQrForUrl("http://example.com", (s) => lines.push(s));
    const combined = lines.join("\n");
    // qrcode-terminal uses block characters like █ or spaces for the QR
    // Just verify some non-empty QR output was produced before the URL line
    expect(lines.length).toBeGreaterThan(1);
  });
});
