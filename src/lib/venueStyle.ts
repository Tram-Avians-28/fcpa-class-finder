import type { Camp } from "./types";

/** Distinct, high-contrast palette (d3 category10). */
export const PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#17becf",
  "#bcbd22",
  "#7f7f7f",
] as const;

/** Pattern names; each has a matching CSS class `pat-<name>`. */
export const PATTERNS = ["solid", "stripes", "dots", "cross"] as const;

export interface VenueStyle {
  color: string;
  pattern: (typeof PATTERNS)[number];
  index: number;
}

/**
 * Assign each non-virtual venue a (color, pattern) pair. Venues are sorted so the
 * mapping is stable for a given set; the first PALETTE.length venues all get
 * distinct colors, after which the pattern advances — so color+pattern stays
 * distinct well past 10 venues. Recomputed from whatever camps are visible, so a
 * filtered view's handful of venues are maximally distinguishable.
 */
export function buildVenueStyles(camps: Camp[]): Map<string, VenueStyle> {
  const venues = Array.from(
    new Set(camps.filter((c) => !c.isVirtual && c.venue).map((c) => c.venue)),
  ).sort();

  const styles = new Map<string, VenueStyle>();
  venues.forEach((venue, i) => {
    styles.set(venue, {
      color: PALETTE[i % PALETTE.length],
      pattern: PATTERNS[Math.floor(i / PALETTE.length) % PATTERNS.length],
      index: i,
    });
  });
  return styles;
}
