import { describe, expect, it } from "vitest";
import { applyListFilters, sortCamps } from "./listFilter";
import type { Camp } from "./types";

function camp(o: Partial<Camp> = {}): Camp {
  return {
    title: "Softball Camp",
    category: "SPORTS",
    catalogId: "ABC.1",
    community: "Annandale",
    venue: "Audrey Moore Rec Center",
    fee: 100,
    startDate: "2026-07-06",
    endDate: "2026-07-10",
    startTime: "09:00",
    endTime: "16:00",
    ageMin: 6,
    ageMax: 13,
    weekLabel: "Week 3",
    status: "",
    isVirtual: false,
    driveMinutes: 20,
    ...o,
  };
}

describe("applyListFilters", () => {
  const camps = [
    camp({ catalogId: "a", title: "LEGO Robotics", category: "STEM", venue: "Cub Run Rec Center", fee: 200, driveMinutes: 40, ageMin: 8, ageMax: 12 }),
    camp({ catalogId: "b", title: "Soccer Stars", category: "SPORTS", venue: "Audrey Moore Rec Center", fee: 90, driveMinutes: 15, ageMin: 5, ageMax: 7 }),
    camp({ catalogId: "c", title: "Soccer Skills", category: "SPORTS", venue: "Lake Fairfax Park", fee: 120, driveMinutes: 25, ageMin: 6, ageMax: 10 }),
  ];

  it("filters by title contains (case-insensitive)", () => {
    expect(applyListFilters(camps, { title: "soccer" }).map((c) => c.catalogId)).toEqual(["b", "c"]);
  });
  it("filters by exact category", () => {
    expect(applyListFilters(camps, { category: "STEM" }).map((c) => c.catalogId)).toEqual(["a"]);
  });
  it("filters by venue contains", () => {
    expect(applyListFilters(camps, { venue: "audrey" }).map((c) => c.catalogId)).toEqual(["b"]);
  });
  it("filters by max fee and max drive", () => {
    expect(applyListFilters(camps, { maxFee: 120, maxDrive: 30 }).map((c) => c.catalogId)).toEqual(["b", "c"]);
  });
  it("filters by child age within range", () => {
    expect(applyListFilters(camps, { childAge: 7 }).map((c) => c.catalogId).sort()).toEqual(["b", "c"]);
  });
  it("filters by time against the 12h label", () => {
    expect(applyListFilters(camps, { time: "9:00 AM" })).toHaveLength(3);
    expect(applyListFilters(camps, { time: "10:00 PM" })).toHaveLength(0);
  });
});

describe("sortCamps", () => {
  const camps = [
    camp({ catalogId: "a", fee: 200, title: "Bravo" }),
    camp({ catalogId: "b", fee: 90, title: "Alpha" }),
    camp({ catalogId: "c", fee: 120, title: "Charlie", driveMinutes: null }),
  ];
  it("sorts numerically asc/desc", () => {
    expect(sortCamps(camps, "fee", "asc").map((c) => c.fee)).toEqual([90, 120, 200]);
    expect(sortCamps(camps, "fee", "desc").map((c) => c.fee)).toEqual([200, 120, 90]);
  });
  it("sorts strings", () => {
    expect(sortCamps(camps, "title", "asc").map((c) => c.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
  it("keeps nulls last regardless of direction", () => {
    expect(sortCamps(camps, "driveMinutes", "asc").map((c) => c.catalogId).at(-1)).toBe("c");
    expect(sortCamps(camps, "driveMinutes", "desc").map((c) => c.catalogId).at(-1)).toBe("c");
  });
  it("returns input unchanged when no key", () => {
    expect(sortCamps(camps, null, "asc")).toBe(camps);
  });
});
