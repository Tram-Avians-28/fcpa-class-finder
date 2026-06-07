import { describe, expect, it } from "vitest";
import { applyDriveTimes, uniqueVenuePoints, venueMinutesMap } from "./drivetime";
import type { Camp } from "./types";

function camp(overrides: Partial<Camp> = {}): Camp {
  return {
    title: "Camp",
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
    weekLabel: "Week 3 (July 6-10)",
    status: "",
    isVirtual: false,
    lat: 38.81,
    lng: -77.21,
    ...overrides,
  };
}

describe("uniqueVenuePoints", () => {
  it("dedupes by venue and skips virtual / un-geocoded camps", () => {
    const camps = [
      camp({ venue: "A", lat: 1, lng: 2 }),
      camp({ venue: "A", lat: 1, lng: 2 }),
      camp({ venue: "B", lat: 3, lng: 4 }),
      camp({ venue: "Virtual FCPA", isVirtual: true, lat: undefined, lng: undefined }),
      camp({ venue: "C", lat: undefined, lng: undefined }),
    ];
    const pts = uniqueVenuePoints(camps);
    expect(pts.map((p) => p.venue)).toEqual(["A", "B"]);
  });
});

describe("venueMinutesMap + applyDriveTimes", () => {
  it("assigns drive minutes back to camps by venue", () => {
    const camps = [
      camp({ catalogId: "a", venue: "A" }),
      camp({ catalogId: "b", venue: "B" }),
      camp({ catalogId: "v", venue: "Virtual FCPA", isVirtual: true }),
    ];
    const points = uniqueVenuePoints(camps);
    const map = venueMinutesMap(points, [12, 30]);
    const out = applyDriveTimes(camps, map);
    expect(out.find((c) => c.catalogId === "a")?.driveMinutes).toBe(12);
    expect(out.find((c) => c.catalogId === "b")?.driveMinutes).toBe(30);
    // virtual camps are untouched
    expect(out.find((c) => c.catalogId === "v")?.driveMinutes).toBeUndefined();
  });

  it("sets null when a venue could not be routed", () => {
    const camps = [camp({ venue: "A" })];
    const map = venueMinutesMap(uniqueVenuePoints(camps), [null]);
    expect(applyDriveTimes(camps, map)[0].driveMinutes).toBeNull();
  });
});
