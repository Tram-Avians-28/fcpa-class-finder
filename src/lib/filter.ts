import type { Camp, FilterCriteria } from "./types";

/** True when [aStart,aEnd] overlaps [bStart,bEnd] (inclusive, ISO date strings). */
export function dateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Apply all filter criteria to a list of camps. Pure; returns a new array. */
export function filterCamps(camps: Camp[], f: FilterCriteria): Camp[] {
  const includeVirtual = f.includeVirtual ?? true;
  const categories = f.categories && f.categories.length ? new Set(f.categories) : null;
  const weekLabels = f.weekLabels && f.weekLabels.length ? new Set(f.weekLabels) : null;
  const venues = f.venues && f.venues.length ? new Set(f.venues) : null;

  return camps.filter((c) => {
    // Date overlap
    if (f.startDate && f.endDate && c.startDate && c.endDate) {
      if (!dateRangesOverlap(c.startDate, c.endDate, f.startDate, f.endDate)) return false;
    }

    // Cost
    if (f.maxFee != null && c.fee > f.maxFee) return false;

    // Age (inclusive). If the camp has no age bounds, don't exclude it.
    if (f.childAge != null) {
      if (c.ageMin != null && f.childAge < c.ageMin) return false;
      if (c.ageMax != null && f.childAge > c.ageMax) return false;
    }

    // Category / week label / venue
    if (categories && !categories.has(c.category)) return false;
    if (weekLabels && !weekLabels.has(c.weekLabel)) return false;
    if (venues && !venues.has(c.venue)) return false;

    // Virtual handling
    if (c.isVirtual) {
      if (!includeVirtual) return false;
      // Virtual camps have no location, so a drive-time cap can't apply to them.
      return true;
    }

    // Drive time (physical camps only)
    if (f.maxDriveMinutes != null) {
      // Unknown drive time (no coords / not computed) is excluded when a cap is set.
      if (c.driveMinutes == null) return false;
      if (c.driveMinutes > f.maxDriveMinutes) return false;
    }

    return true;
  });
}

/** Distinct, sorted category names present in the camp list. */
export function distinctCategories(camps: Camp[]): string[] {
  return Array.from(new Set(camps.map((c) => c.category))).sort();
}

/** Distinct week labels, ordered by the earliest start date they appear with. */
export function distinctWeekLabels(camps: Camp[]): string[] {
  const earliest = new Map<string, string>();
  for (const c of camps) {
    if (!c.weekLabel) continue;
    const cur = earliest.get(c.weekLabel);
    if (cur == null || (c.startDate && c.startDate < cur)) {
      earliest.set(c.weekLabel, c.startDate || "9999");
    }
  }
  return Array.from(earliest.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([label]) => label);
}

/** Distinct physical (non-virtual) venue names present in the camp list. */
export function distinctVenues(camps: Camp[]): string[] {
  return Array.from(
    new Set(camps.filter((c) => !c.isVirtual && c.venue).map((c) => c.venue)),
  ).sort();
}
