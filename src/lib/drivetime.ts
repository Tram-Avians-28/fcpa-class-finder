import type { Camp, LatLng } from "./types";

export interface VenuePoint extends LatLng {
  venue: string;
}

/** Distinct, geocoded, non-virtual venues among the given camps. */
export function uniqueVenuePoints(camps: Camp[]): VenuePoint[] {
  const byVenue = new Map<string, VenuePoint>();
  for (const c of camps) {
    if (c.isVirtual || c.lat == null || c.lng == null) continue;
    if (!byVenue.has(c.venue)) {
      byVenue.set(c.venue, { venue: c.venue, lat: c.lat, lng: c.lng });
    }
  }
  return [...byVenue.values()];
}

/** Pair venue points with their computed drive minutes into a lookup map. */
export function venueMinutesMap(
  points: VenuePoint[],
  minutes: (number | null)[],
): Map<string, number | null> {
  const m = new Map<string, number | null>();
  points.forEach((p, i) => m.set(p.venue, minutes[i] ?? null));
  return m;
}

/** Return a copy of camps with driveMinutes set from the venue→minutes map. */
export function applyDriveTimes(
  camps: Camp[],
  minutesByVenue: Map<string, number | null>,
): Camp[] {
  return camps.map((c) => {
    if (c.isVirtual) return c;
    if (!minutesByVenue.has(c.venue)) return c;
    return { ...c, driveMinutes: minutesByVenue.get(c.venue) ?? null };
  });
}
