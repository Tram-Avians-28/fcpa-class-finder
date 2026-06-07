import { describe, expect, it } from "vitest";
import type { Camp } from "./types";
import { PALETTE, buildVenueStyles } from "./venueStyle";

function camp(venue: string, isVirtual = false): Camp {
  return {
    title: "C",
    category: "X",
    catalogId: venue,
    community: "",
    venue,
    fee: 0,
    startDate: "2026-07-06",
    endDate: "2026-07-10",
    startTime: "09:00",
    endTime: "16:00",
    ageMin: null,
    ageMax: null,
    weekLabel: "",
    status: "",
    isVirtual,
  };
}

describe("buildVenueStyles", () => {
  it("gives the first 10 venues distinct colors", () => {
    const venues = Array.from({ length: 10 }, (_, i) => camp(`V${i}`));
    const styles = buildVenueStyles(venues);
    const colors = [...styles.values()].map((s) => s.color);
    expect(new Set(colors).size).toBe(10);
    expect([...styles.values()].every((s) => s.pattern === "solid")).toBe(true);
  });

  it("advances the pattern after the palette is exhausted", () => {
    const venues = Array.from({ length: 12 }, (_, i) => camp(`V${String(i).padStart(2, "0")}`));
    const styles = buildVenueStyles(venues);
    // 11th venue (index 10) wraps color to palette[0] but uses the next pattern.
    const eleventh = styles.get("V10")!;
    expect(eleventh.color).toBe(PALETTE[0]);
    expect(eleventh.pattern).toBe("stripes");
  });

  it("is stable/deterministic for the same venue set", () => {
    const set = [camp("B"), camp("A"), camp("C")];
    const a = buildVenueStyles(set);
    const b = buildVenueStyles(set);
    expect(a.get("A")).toEqual(b.get("A"));
  });

  it("ignores virtual venues", () => {
    const styles = buildVenueStyles([camp("Real"), camp("Virtual FCPA", true)]);
    expect(styles.has("Virtual FCPA")).toBe(false);
    expect(styles.has("Real")).toBe(true);
  });
});
