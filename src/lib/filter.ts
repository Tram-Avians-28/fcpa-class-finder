import { parseAges } from "./ages";
import { phaseForVenue } from "./phase";
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

function weekday(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** True when an activity has an occurrence on a selected weekday in the active date range. */
export function activityMeetsOnWeekday(
  camp: Camp,
  selectedDays: Set<number>,
  rangeStart?: string,
  rangeEnd?: string,
): boolean {
  if (!camp.startDate || !camp.endDate) return false;
  const lower = rangeStart && rangeStart > camp.startDate ? rangeStart : camp.startDate;
  const upper = rangeEnd && rangeEnd < camp.endDate ? rangeEnd : camp.endDate;
  if (lower > upper) return false;

  const meetingDays = camp.meetingDays?.length
    ? new Set(camp.meetingDays)
    : camp.startDate === camp.endDate
      ? new Set([weekday(camp.startDate)])
      : new Set([1, 2, 3, 4, 5]);

  // At most one week is needed to encounter every possible weekday.
  for (let date = lower, checked = 0; date <= upper && checked < 7; date = addDays(date, 1), checked += 1) {
    const day = weekday(date);
    if (selectedDays.has(day) && meetingDays.has(day)) return true;
  }
  return false;
}

/** Apply all filter criteria to a list of camps. Pure; returns a new array. */
export function filterCamps(camps: Camp[], f: FilterCriteria): Camp[] {
  const includeVirtual = f.includeVirtual ?? true;
  const categories = f.categories && f.categories.length ? new Set(f.categories) : null;
  const weekLabels = f.weekLabels && f.weekLabels.length ? new Set(f.weekLabels) : null;
  const venues = f.venues && f.venues.length ? new Set(f.venues) : null;
  const phases = f.phases && f.phases.length ? new Set(f.phases) : null;
  const weekdays = f.weekdays && f.weekdays.length ? new Set(f.weekdays) : null;
  const ages = f.ageText ? parseAges(f.ageText) : [];

  return camps.filter((c) => {
    // Date overlap
    if (f.startDate && f.endDate && c.startDate && c.endDate) {
      if (!dateRangesOverlap(c.startDate, c.endDate, f.startDate, f.endDate)) return false;
    }

    if (weekdays && !activityMeetsOnWeekday(c, weekdays, f.startDate, f.endDate)) return false;

    // Cost
    if (f.maxFee != null && (c.fee == null || c.fee > f.maxFee)) return false;

    // Ages: keep the camp if it fits ANY requested age (multiple kids / a range).
    if (ages.length) {
      const fits = ages.some(
        (a) => (c.ageMin == null || a >= c.ageMin) && (c.ageMax == null || a <= c.ageMax),
      );
      if (!fits) return false;
    }

    // Category / week label / venue
    if (categories && !categories.has(c.category)) return false;
    if (weekLabels && !weekLabels.has(c.weekLabel)) return false;
    if (venues && !venues.has(c.venue)) return false;
    // Registration phase (unknown-phase venues are excluded when a phase is chosen).
    if (phases) {
      const p = phaseForVenue(c.venue);
      if (p === "unknown" || !phases.has(p)) return false;
    }

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
