import { describe, expect, it } from "vitest";
import { campsToTimedEvents, expandCampToTimedEvents } from "./calendar";
import type { Camp } from "./types";

function camp(overrides: Partial<Camp> = {}): Camp {
  return {
    title: "Camp",
    category: "SPORTS",
    catalogId: "ABC.1",
    community: "Annandale",
    venue: "Audrey Moore Rec Center",
    fee: 100,
    startDate: "2026-07-06", // Monday
    endDate: "2026-07-10", // Friday
    startTime: "09:00",
    endTime: "16:00",
    ageMin: 6,
    ageMax: 13,
    weekLabel: "Week 3 (July 6-10)",
    status: "",
    isVirtual: false,
    ...overrides,
  };
}

describe("expandCampToTimedEvents", () => {
  it("emits one timed event per weekday for a Mon–Fri camp", () => {
    const ev = expandCampToTimedEvents(camp(), "2026-07-05", "2026-07-12");
    expect(ev).toHaveLength(5);
    expect(ev[0]).toMatchObject({ start: "2026-07-06T09:00", end: "2026-07-06T16:00", allDay: false });
    expect(ev[4].start).toBe("2026-07-10T09:00");
  });

  it("skips weekends for multi-day camps", () => {
    // A two-week camp spanning a weekend should not emit Sat/Sun.
    const ev = expandCampToTimedEvents(
      camp({ startDate: "2026-07-06", endDate: "2026-07-17" }),
      "2026-07-05",
      "2026-07-19",
    );
    const days = ev.map((e) => e.start.slice(0, 10));
    expect(days).not.toContain("2026-07-11"); // Sat
    expect(days).not.toContain("2026-07-12"); // Sun
    expect(days).toHaveLength(10); // two Mon–Fri weeks
  });

  it("clips to the visible range", () => {
    const ev = expandCampToTimedEvents(camp(), "2026-07-08", "2026-07-10");
    // range [Wed, Fri) -> Wed + Thu only
    expect(ev.map((e) => e.start.slice(0, 10))).toEqual(["2026-07-08", "2026-07-09"]);
  });

  it("falls back to an all-day block when the camp has no times", () => {
    const ev = expandCampToTimedEvents(
      camp({ startTime: null, endTime: null }),
      "2026-07-05",
      "2026-07-12",
    );
    expect(ev).toHaveLength(1);
    expect(ev[0].allDay).toBe(true);
  });
});

describe("campsToTimedEvents", () => {
  it("includes only camps overlapping the range", () => {
    const camps = [
      camp({ catalogId: "in", startDate: "2026-07-06", endDate: "2026-07-10" }),
      camp({ catalogId: "out", startDate: "2026-08-03", endDate: "2026-08-07" }),
    ];
    const ev = campsToTimedEvents(camps, "2026-07-05", "2026-07-12");
    expect(new Set(ev.map((e) => e.extendedProps.camp.catalogId))).toEqual(new Set(["in"]));
  });
});
