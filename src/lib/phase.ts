/**
 * FCPA splits camp registration by location into two phases:
 *   Green = register Tuesday, Feb 3   ·   Blue = register Thursday, Feb 5
 *
 * This grouping isn't in the spreadsheet; it's published only as a map image
 * (Camp-2026-Map-Split.jpg). The lists below are transcribed from that map.
 * Spelling variants used in the camp data are included alongside the official
 * names so lookups match. Two used venues are NOT on the published map —
 * "Colin Powell Elementary School" and "GMUFieldHouse" — so they resolve to
 * "unknown" until FCPA assigns them.
 */
export type Phase = "green" | "blue";

export const PHASE_LABELS: Record<Phase, string> = {
  green: "Green — registers Feb 3",
  blue: "Blue — registers Feb 5",
};

const BLUE: string[] = [
  "Bricks & Minifigs Herndon",
  "Bull Run Park",
  "Burke Lake Golf Course",
  "Burke Lake Park",
  "Bull Run Elementary School",
  "Colvin Run Mill",
  "Craftspace",
  "Cub Run Rec Center",
  "Eagle View Elementary School",
  "Ellanor C. Lawrence Park",
  "Fairfax Fencers",
  "Floris Elementary School",
  "Frying Pan Farm Park",
  "Frying Pan Park", // data spelling
  "Great Falls Nike",
  "Greenbriar East Elementary School",
  "Hidden Pond Nature Center",
  "Hunt Valley Elementary School",
  "Lake Fairfax Park",
  "Nottoway Park",
  "Oakmont Rec Center",
  "Oakton Elementary School",
  "Patriot Park North",
  "Riverbend Park",
  "Sangster Elementary School",
  "Silverbrook Elementary School",
  "South Run Rec Center",
  "Sully Community Center",
  "Sully Highlands",
  "Sully Historic Site",
  "Turner Farm Park",
  "Westbriar Elementary School",
  "Westfield High School",
  "Westfields High School", // data spelling (typo in source)
];

const GREEN: string[] = [
  "Annandale Park",
  "Audrey Moore Rec Center",
  "Bach to Rock McLean",
  "Braddock Elementary School",
  "Franconia Rec Center",
  "Garfield Elementary School",
  "George Washington Rec Center",
  "Green Spring Gardens Park",
  "Hidden Oaks Nature Center",
  "Historic Huntley",
  "Huntley Meadows Park",
  "Kings Park Elementary School",
  "Lake Accotink Park",
  "Lewinsville House",
  "Mount Vernon Rec Center",
  "NOVA Fencing Club",
  "Pinecrest Golf Course",
  "Providence Rec Center",
  "Riverside Elementary School",
  "Spring Hill Elementary School",
  "Spring Hill Rec Center",
  "Stenwood Elementary School",
  "Stone Mansion",
  "Stratford Landing Elementary School",
  "Woodburn Elementary School",
  "Woodley Hills Elementary School",
  "Woodley Hills Elementary", // data spelling
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const PHASE_BY_VENUE = new Map<string, Phase>();
for (const v of BLUE) PHASE_BY_VENUE.set(norm(v), "blue");
for (const v of GREEN) PHASE_BY_VENUE.set(norm(v), "green");

/** Registration phase for a venue, or "unknown" if FCPA hasn't published one. */
export function phaseForVenue(venue: string): Phase | "unknown" {
  return PHASE_BY_VENUE.get(norm(venue)) ?? "unknown";
}
