import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64, daysSince, isStale } from "./datasetCache";
import { parseWorkbook } from "./parse";

describe("base64 round-trip", () => {
  it("preserves arbitrary bytes", () => {
    const data = new Uint8Array([0, 1, 2, 65, 66, 200, 253, 254, 255]);
    const back = new Uint8Array(base64ToBytes(bytesToBase64(data.buffer)));
    expect([...back]).toEqual([...data]);
  });

  it("survives a full spreadsheet (still parses to 2151 camps)", () => {
    const bytes = new Uint8Array(
      readFileSync(resolve(process.cwd(), "src/test/fixtures/fcpa-camp-spreadsheet.xlsx")),
    ).buffer;
    const restored = base64ToBytes(bytesToBase64(bytes));
    expect(parseWorkbook(restored).camps.length).toBe(2151);
  });
});

describe("staleness", () => {
  const now = Date.UTC(2026, 5, 7);
  it("daysSince computes whole days", () => {
    expect(daysSince(now - 10 * 86_400_000, now)).toBe(10);
    expect(daysSince(now, now)).toBe(0);
  });
  it("isStale triggers at/after the threshold", () => {
    expect(isStale(now - 29 * 86_400_000, now)).toBe(false);
    expect(isStale(now - 30 * 86_400_000, now)).toBe(true);
    expect(isStale(now - 45 * 86_400_000, now)).toBe(true);
  });
});
