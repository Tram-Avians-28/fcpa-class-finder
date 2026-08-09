import { describe, expect, it } from "vitest";
import { parseActivityCatalog } from "./activityData";

const activity = {
  title: "Saturday Pottery",
  category: "FINE ARTS",
  catalogId: "ABC.1234",
  community: "",
  venue: "Oakmont Rec Center",
  fee: null,
  startDate: "2026-09-05",
  endDate: "2026-09-26",
  startTime: "10:00",
  endTime: "11:00",
  ageMin: 8,
  ageMax: 12,
  weekLabel: "",
  status: "Sign Up!",
  meetingDays: [6],
  isVirtual: false,
};

describe("parseActivityCatalog", () => {
  it("preserves nullable fees and meeting days", () => {
    const parsed = parseActivityCatalog({
      version: 1,
      generatedAt: "2026-08-09T00:00:00Z",
      sourceUrl: "https://fairfax.usedirect.com/",
      startDate: "2026-08-09",
      activities: [activity],
    });
    expect(parsed.activities[0]).toMatchObject({ fee: null, meetingDays: [6] });
  });

  it("rejects duplicate catalog IDs", () => {
    expect(() =>
      parseActivityCatalog({ version: 1, activities: [activity, { ...activity }] }),
    ).toThrow(/duplicate catalog IDs/i);
  });

  it("rejects malformed dates", () => {
    expect(() =>
      parseActivityCatalog({ version: 1, activities: [{ ...activity, startDate: "09/05/2026" }] }),
    ).toThrow(/valid dates/i);
  });
});
