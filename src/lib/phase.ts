/**
 * FCPA splits camp registration by location into two phases:
 *   Green = register Tuesday, Feb 3   ·   Blue = register Thursday, Feb 5
 *
 * This grouping isn't in the spreadsheet; it's published only as a map image
 * (see src/data/phase.json -> mapImage). The Green/Blue lists in phase.json are
 * transcribed from that map and include the camp-data spelling variants. Venues
 * not on the map (e.g. "Colin Powell Elementary School", "GMUFieldHouse")
 * resolve to "unknown". Use `npm run check-phase` / the monthly Action to detect
 * when the map changes or new venues need a phase.
 */
import phaseData from "../data/phase.json";

export type Phase = "green" | "blue";

export const PHASE_LABELS: Record<Phase, string> = {
  green: "Green — registers Feb 3",
  blue: "Blue — registers Feb 5",
};

export const KNOWN_UNKNOWNS: string[] = phaseData.knownUnknowns;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const PHASE_BY_VENUE = new Map<string, Phase>();
for (const v of phaseData.blue) PHASE_BY_VENUE.set(norm(v), "blue");
for (const v of phaseData.green) PHASE_BY_VENUE.set(norm(v), "green");

/** Registration phase for a venue, or "unknown" if FCPA hasn't published one. */
export function phaseForVenue(venue: string): Phase | "unknown" {
  return PHASE_BY_VENUE.get(norm(venue)) ?? "unknown";
}
