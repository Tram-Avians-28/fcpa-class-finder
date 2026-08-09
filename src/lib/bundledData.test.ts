import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWorkbook } from "./parse";

const bundled = readFileSync(
  resolve(process.cwd(), "public/fcpa-camp-spreadsheet.xlsx"),
);

describe("bundled FCPA camp data", () => {
  const { camps, venues } = parseWorkbook(bundled);

  it("parses the current official download", () => {
    expect(camps.length).toBeGreaterThan(0);
    expect(venues.length).toBeGreaterThan(0);
  });

  it("contains unique catalog IDs and usable core fields", () => {
    expect(new Set(camps.map((camp) => camp.catalogId)).size).toBe(camps.length);
    for (const camp of camps) {
      expect(camp.title).toBeTruthy();
      expect(camp.catalogId).toBeTruthy();
      expect(camp.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(camp.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
