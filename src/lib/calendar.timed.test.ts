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

  it("uses explicit meeting weekdays for recurring classes", () => {
    const ev = expandCampToTimedEvents(
      camp({
        title: "Saturday Pottery",
        startDate: "2026-09-05",
        endDate: "2026-09-26",
        meetingDays: [6],
      }),
      "2026-09-01",
      "2026-10-01",
    );
    expect(ev.map((event) => event.start.slice(0, 10))).toEqual([
      "2026-09-05",
      "2026-09-12",
      "2026-09-19",
      "2026-09-26",
    ]);
  });

  it("clips to the visible range", () => {
    const ev = expandCampToTimedEvents(camp(), "2026-07-08", "2026-07-10");
    // range [Wed, Fri) -> Wed + Thu only
    expect(ev.map((e) => e.start.slice(0, 10))).toEqual(["2026-07-08", "2026-07-09"]);
  });

  it("keeps untimed occurrences on their scheduled days with exclusive ends", () => {
    const ev = expandCampToTimedEvents(
      camp({ startTime: null, endTime: null, meetingDays: [1, 3, 5] }),
      "2026-07-05",
      "2026-07-12",
    );
    expect(ev.map(({ start, end, allDay }) => ({ start, end, allDay }))).toEqual([
      { start: "2026-07-06", end: "2026-07-07", allDay: true },
      { start: "2026-07-08", end: "2026-07-09", allDay: true },
      { start: "2026-07-10", end: "2026-07-11", allDay: true },
    ]);
    expect(expandCampToTimedEvents(camp({ startTime: null }), "2026-08-01", "2026-08-08")).toEqual([]);
  });

  it("renders the reported aerobic class only on Monday, Wednesday and Friday", () => {
    const activity = camp({
      catalogId: "3AD.Q3CK",
      title: "Aerobic Water Exercise (13-Adult)",
      startDate: "2026-10-26",
      endDate: "2026-12-18",
      startTime: "09:00",
      endTime: "09:55",
      meetingDays: [1, 3, 5],
    });
    const ev = campsToTimedEvents([activity], "2026-11-08", "2026-11-15");
    expect(ev.map((event) => event.start)).toEqual([
      "2026-11-09T09:00", "2026-11-11T09:00", "2026-11-13T09:00",
    ]);
    expect(ev.every((event) => !event.allDay && event.end.endsWith("T09:55"))).toBe(true);
    expect(ev.every((event) => event.extendedProps.camp === activity)).toBe(true);
  });

  it("preserves weekend-only activities and ignores records without a start date", () => {
    const ev = campsToTimedEvents([
      camp({ startDate: "2026-11-08", endDate: "2026-11-15", meetingDays: [0] }),
      camp({ startDate: "" }),
    ], "2026-11-08", "2026-11-15");
    expect(ev.map((event) => event.start)).toEqual(["2026-11-08T09:00"]);
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
