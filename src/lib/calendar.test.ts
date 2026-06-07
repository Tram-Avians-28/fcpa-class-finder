import { describe, expect, it } from "vitest";
import { addDays, campToEvent, campsToEvents, timeLabel, timeWindow, to12h } from "./calendar";
import type { Camp } from "./types";

function camp(overrides: Partial<Camp> = {}): Camp {
  return {
    title: "Softball Camp",
    category: "SPORTS",
    catalogId: "6J2.B9BH",
    community: "Annandale",
    venue: "Audrey Moore Rec Center",
    fee: 139,
    startDate: "2026-07-06",
    endDate: "2026-07-10",
    startTime: "09:00",
    endTime: "16:00",
    ageMin: 7,
    ageMax: 13,
    weekLabel: "Week 3 (July 6-10)",
    status: "",
    isVirtual: false,
    ...overrides,
  };
}

describe("addDays", () => {
  it("adds across month boundaries (UTC, no drift)", () => {
    expect(addDays("2026-07-10", 1)).toBe("2026-07-11");
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("to12h / timeLabel", () => {
  it("formats 24h to 12h", () => {
    expect(to12h("09:00")).toBe("9:00 AM");
    expect(to12h("16:00")).toBe("4:00 PM");
    expect(to12h("12:00")).toBe("12:00 PM");
    expect(to12h("00:30")).toBe("12:30 AM");
  });
  it("returns empty label when times are missing", () => {
    expect(timeLabel(camp({ startTime: null, endTime: null }))).toBe("");
    expect(timeLabel(camp())).toBe("9:00 AM–4:00 PM");
  });
});

describe("timeWindow", () => {
  it("starts an hour before the earliest start and ends an hour after the latest end", () => {
    const camps = [camp({ startTime: "09:00", endTime: "16:00" }), camp({ startTime: "13:00", endTime: "17:30" })];
    expect(timeWindow(camps)).toEqual({ slotMinTime: "08:00:00", slotMaxTime: "19:00:00" });
  });
  it("falls back to 7am–7pm when there are no times", () => {
    expect(timeWindow([camp({ startTime: null, endTime: null })])).toEqual({
      slotMinTime: "07:00:00",
      slotMaxTime: "19:00:00",
    });
  });
});

describe("campToEvent", () => {
  it("makes an all-day event with an exclusive end date", () => {
    const e = campToEvent(camp(), 0);
    expect(e.start).toBe("2026-07-06");
    expect(e.end).toBe("2026-07-11"); // 1 day past the Friday end
    expect(e.allDay).toBe(true);
    expect(e.title).toContain("Softball Camp");
    expect(e.extendedProps.camp.catalogId).toBe("6J2.B9BH");
  });

  it("skips camps without a start date", () => {
    expect(campsToEvents([camp({ startDate: "" })])).toHaveLength(0);
  });
});
