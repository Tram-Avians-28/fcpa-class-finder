import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { enrichWithGazetteer, parseWorkbook, venueKey } from "./parse";
import type { Gazetteer } from "./types";

const fixture = readFileSync(
  resolve(process.cwd(), "src/test/fixtures/fcpa-camp-spreadsheet.xlsx"),
);

describe("parseWorkbook (real FCPA fixture)", () => {
  const { camps, venues } = parseWorkbook(fixture);

  it("parses all camp rows", () => {
    expect(camps.length).toBe(2151);
  });

  it("every camp has the essential fields populated", () => {
    for (const c of camps) {
      expect(c.title).toBeTruthy();
      expect(c.catalogId).toBeTruthy();
      expect(c.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof c.fee).toBe("number");
    }
  });

  it("normalizes times from mixed source types", () => {
    // Start times come as Excel fractions, end times as ' H:MM PM' text.
    const withTimes = camps.filter((c) => c.startTime && c.endTime);
    expect(withTimes.length).toBeGreaterThan(2000);
    for (const c of withTimes.slice(0, 50)) {
      expect(c.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(c.endTime).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it("blank categories become 'Uncategorized'", () => {
    expect(camps.some((c) => c.category === "Uncategorized")).toBe(true);
    expect(camps.every((c) => c.category.length > 0)).toBe(true);
  });

  it("flags virtual camps by venue (incl. ones mis-categorized as STEM)", () => {
    // 73 rows use the "Virtual FCPA" venue: 70 in the VIRTUAL category plus 3
    // "App Attack!" rows tagged STEM. Venue is the reliable "no location" signal.
    const virtual = camps.filter((c) => c.isVirtual);
    expect(virtual.length).toBe(73);
    expect(virtual.every((c) => /virtual/i.test(c.venue))).toBe(true);
  });

  it("parses ages into numbers within a sane range", () => {
    const aged = camps.filter((c) => c.ageMin != null);
    expect(aged.length).toBeGreaterThan(2000);
    for (const c of aged) {
      expect(c.ageMin!).toBeGreaterThanOrEqual(0);
      expect(c.ageMin!).toBeLessThan(25);
    }
  });

  it("dates fall within the 2026 season", () => {
    const starts = camps.map((c) => c.startDate);
    expect(Math.min(...starts.map((s) => +s.replaceAll("-", "")))).toBe(20260525);
    expect(Math.max(...camps.map((c) => +c.endDate.replaceAll("-", "")))).toBe(20260904);
  });

  it("reads the venue list from Lookup Tables", () => {
    expect(venues.length).toBeGreaterThan(100);
    const names = venues.map((v) => v.name);
    expect(names).toContain("Audrey Moore Rec Center");
    expect(names).toContain("Lake Fairfax Park");
    // Same name under two towns is preserved.
    expect(venues.filter((v) => v.name === "Clark House").length).toBe(2);
  });
});

describe("enrichWithGazetteer", () => {
  it("attaches lat/lng by case/space-insensitive venue match", () => {
    const { camps } = parseWorkbook(fixture);
    const gaz: Gazetteer = {
      "Audrey Moore Rec Center": { town: "Annandale", lat: 38.81, lng: -77.21 },
    };
    const enriched = enrichWithGazetteer(camps, gaz);
    const hit = enriched.find((c) => venueKey(c.venue) === venueKey("Audrey Moore Rec Center"));
    expect(hit?.lat).toBe(38.81);
    expect(hit?.lng).toBe(-77.21);
  });

  it("leaves virtual camps without coordinates", () => {
    const { camps } = parseWorkbook(fixture);
    const enriched = enrichWithGazetteer(camps, {});
    const virt = enriched.find((c) => c.isVirtual);
    expect(virt?.lat).toBeUndefined();
  });
});
