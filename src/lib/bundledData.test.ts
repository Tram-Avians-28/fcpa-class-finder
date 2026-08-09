import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseActivityCatalog } from "./activityData";
import { venueKey } from "./parse";

const bundled = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/fcpa-activities.json"), "utf8"),
);
const gazetteer = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/data/gazetteer.json"), "utf8"),
);

describe("bundled FCPA activity data", () => {
  const { activities, sourceUrl } = parseActivityCatalog(bundled);

  it("parses the current official catalog", () => {
    expect(activities.length).toBeGreaterThan(0);
    expect(sourceUrl).toContain("fairfax.usedirect.com");
    expect(new Set(activities.map((activity) => activity.category)).size).toBeGreaterThan(10);
  });

  it("contains unique catalog IDs and usable core fields", () => {
    expect(new Set(activities.map((activity) => activity.catalogId)).size).toBe(activities.length);
    for (const activity of activities) {
      expect(activity.title).toBeTruthy();
      expect(activity.catalogId).toBeTruthy();
      expect(activity.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(activity.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("preserves age ranges printed in activity titles", () => {
    for (const activity of activities) {
      const range = activity.title.match(/\((\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*yrs?\.?\)/i);
      if (range) {
        expect([activity.ageMin, activity.ageMax], activity.title).toEqual([
          Number(range[1]),
          Number(range[2]),
        ]);
      }
      if (/\(Adults?\)$/i.test(activity.title)) {
        expect([activity.ageMin, activity.ageMax], activity.title).toEqual([18, null]);
      }
    }
  });

  it("maps every current physical venue", () => {
    const mapped = new Set(Object.keys(gazetteer).map(venueKey));
    const missing = Array.from(
      new Set(
        activities
          .filter((activity) => !activity.isVirtual && activity.venue)
          .map((activity) => activity.venue)
          .filter((venue) => !mapped.has(venueKey(venue))),
      ),
    );
    expect(missing).toEqual([]);
  });
});
