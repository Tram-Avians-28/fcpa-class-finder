import { describe, expect, it } from "vitest";
import {
  dateRangesOverlap,
  distinctCategories,
  distinctWeekLabels,
  filterCamps,
} from "./filter";
import type { Camp } from "./types";

function camp(overrides: Partial<Camp> = {}): Camp {
  return {
    title: "Test Camp",
    category: "SPORTS",
    catalogId: "ABC.1234",
    community: "Annandale",
    venue: "Audrey Moore Rec Center",
    fee: 100,
    startDate: "2026-07-06",
    endDate: "2026-07-10",
    startTime: "09:00",
    endTime: "16:00",
    ageMin: 6,
    ageMax: 13,
    weekLabel: "Week 3 (July 6-10)",
    status: "",
    isVirtual: false,
    driveMinutes: 20,
    ...overrides,
  };
}

describe("dateRangesOverlap", () => {
  it("detects overlap and non-overlap", () => {
    expect(dateRangesOverlap("2026-07-06", "2026-07-10", "2026-07-01", "2026-07-07")).toBe(true);
    expect(dateRangesOverlap("2026-07-06", "2026-07-10", "2026-07-11", "2026-07-20")).toBe(false);
    expect(dateRangesOverlap("2026-07-06", "2026-07-10", "2026-07-10", "2026-07-10")).toBe(true);
  });
});

describe("filterCamps", () => {
  it("filters by date overlap", () => {
    const camps = [
      camp({ catalogId: "A", startDate: "2026-07-06", endDate: "2026-07-10" }),
      camp({ catalogId: "B", startDate: "2026-08-03", endDate: "2026-08-07" }),
    ];
    const out = filterCamps(camps, { startDate: "2026-07-01", endDate: "2026-07-15" });
    expect(out.map((c) => c.catalogId)).toEqual(["A"]);
  });

  it("filters by max fee", () => {
    const camps = [camp({ catalogId: "A", fee: 89 }), camp({ catalogId: "B", fee: 200 })];
    expect(filterCamps(camps, { maxFee: 100 }).map((c) => c.catalogId)).toEqual(["A"]);
  });

  it("filters by child age inclusively", () => {
    const camps = [
      camp({ catalogId: "young", ageMin: 3, ageMax: 5 }),
      camp({ catalogId: "fits", ageMin: 6, ageMax: 13 }),
      camp({ catalogId: "edge", ageMin: 7, ageMax: 7 }),
    ];
    expect(filterCamps(camps, { childAge: 7 }).map((c) => c.catalogId)).toEqual(["fits", "edge"]);
  });

  it("does not exclude camps with missing age bounds", () => {
    const camps = [camp({ catalogId: "noages", ageMin: null, ageMax: null })];
    expect(filterCamps(camps, { childAge: 99 })).toHaveLength(1);
  });

  it("filters by category and week label sets", () => {
    const camps = [
      camp({ catalogId: "sport", category: "SPORTS" }),
      camp({ catalogId: "stem", category: "STEM" }),
    ];
    expect(filterCamps(camps, { categories: ["STEM"] }).map((c) => c.catalogId)).toEqual(["stem"]);
  });

  it("filters by registration phase (excludes unknown-phase venues)", () => {
    const camps = [
      camp({ catalogId: "green1", venue: "Audrey Moore Rec Center" }),
      camp({ catalogId: "blue1", venue: "Cub Run Rec Center" }),
      camp({ catalogId: "unknown1", venue: "GMUFieldHouse" }),
    ];
    expect(filterCamps(camps, { phases: ["green"] }).map((c) => c.catalogId)).toEqual(["green1"]);
    expect(filterCamps(camps, { phases: ["green", "blue"] }).map((c) => c.catalogId).sort()).toEqual([
      "blue1",
      "green1",
    ]);
  });

  it("filters by venue/location set", () => {
    const camps = [
      camp({ catalogId: "a", venue: "Audrey Moore Rec Center" }),
      camp({ catalogId: "b", venue: "Lake Fairfax Park" }),
      camp({ catalogId: "c", venue: "Frying Pan Park" }),
    ];
    expect(
      filterCamps(camps, { venues: ["Audrey Moore Rec Center", "Frying Pan Park"] }).map((c) => c.catalogId),
    ).toEqual(["a", "c"]);
  });

  it("applies drive-time cap to physical camps and excludes unknown drive times", () => {
    const camps = [
      camp({ catalogId: "near", driveMinutes: 15 }),
      camp({ catalogId: "far", driveMinutes: 45 }),
      camp({ catalogId: "unknown", driveMinutes: null }),
    ];
    expect(filterCamps(camps, { maxDriveMinutes: 30 }).map((c) => c.catalogId)).toEqual(["near"]);
  });

  it("keeps virtual camps regardless of drive-time cap, but respects includeVirtual", () => {
    const camps = [
      camp({ catalogId: "virt", isVirtual: true, venue: "Virtual FCPA", driveMinutes: null }),
      camp({ catalogId: "phys", driveMinutes: 15 }),
    ];
    expect(filterCamps(camps, { maxDriveMinutes: 30 }).map((c) => c.catalogId).sort()).toEqual([
      "phys",
      "virt",
    ]);
    expect(
      filterCamps(camps, { maxDriveMinutes: 30, includeVirtual: false }).map((c) => c.catalogId),
    ).toEqual(["phys"]);
  });

  it("combines multiple criteria", () => {
    const camps = [
      camp({ catalogId: "match", fee: 90, driveMinutes: 10, category: "STEM" }),
      camp({ catalogId: "toofar", fee: 90, driveMinutes: 60, category: "STEM" }),
      camp({ catalogId: "toopricey", fee: 500, driveMinutes: 10, category: "STEM" }),
      camp({ catalogId: "wrongcat", fee: 90, driveMinutes: 10, category: "DANCE" }),
    ];
    const out = filterCamps(camps, { maxFee: 150, maxDriveMinutes: 30, categories: ["STEM"] });
    expect(out.map((c) => c.catalogId)).toEqual(["match"]);
  });
});

describe("distinct helpers", () => {
  it("returns sorted distinct categories", () => {
    const camps = [camp({ category: "STEM" }), camp({ category: "SPORTS" }), camp({ category: "STEM" })];
    expect(distinctCategories(camps)).toEqual(["SPORTS", "STEM"]);
  });

  it("orders week labels by earliest start date", () => {
    const camps = [
      camp({ weekLabel: "Week 3 (July 6-10)", startDate: "2026-07-06" }),
      camp({ weekLabel: "Week 1 (June 22-26)", startDate: "2026-06-22" }),
    ];
    expect(distinctWeekLabels(camps)).toEqual(["Week 1 (June 22-26)", "Week 3 (July 6-10)"]);
  });
});
