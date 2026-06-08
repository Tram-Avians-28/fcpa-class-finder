import { timeLabel } from "./calendar";
import type { Camp } from "./types";

/** Per-column, in-table filters for the list view (Excel-style). */
export interface ListFilter {
  title?: string; // contains
  catalogId?: string; // contains
  category?: string; // exact (from dropdown)
  venue?: string; // contains
  time?: string; // contains (against the displayed 12h label)
  childAge?: number; // camp's age range must include this
  maxFee?: number; // fee <= this
  maxDrive?: number; // drive minutes <= this
}

const has = (hay: string, needle?: string) =>
  !needle || hay.toLowerCase().includes(needle.toLowerCase());

export function applyListFilters(camps: Camp[], f: ListFilter): Camp[] {
  return camps.filter((c) => {
    if (!has(c.title, f.title)) return false;
    if (!has(c.catalogId, f.catalogId)) return false;
    if (f.category && c.category !== f.category) return false;
    if (!has(c.isVirtual ? "Virtual" : c.venue, f.venue)) return false;
    if (!has(timeLabel(c), f.time)) return false;
    if (f.childAge != null) {
      if (c.ageMin != null && f.childAge < c.ageMin) return false;
      if (c.ageMax != null && f.childAge > c.ageMax) return false;
    }
    if (f.maxFee != null && c.fee > f.maxFee) return false;
    if (f.maxDrive != null && (c.driveMinutes == null || c.driveMinutes > f.maxDrive)) return false;
    return true;
  });
}

export type SortKey =
  | "title"
  | "catalogId"
  | "category"
  | "venue"
  | "startDate"
  | "startTime"
  | "ageMin"
  | "fee"
  | "driveMinutes";
export type SortDir = "asc" | "desc";

/** Stable sort by a Camp field; nulls always sort last regardless of direction. */
export function sortCamps(camps: Camp[], key: SortKey | null, dir: SortDir): Camp[] {
  if (!key) return camps;
  const mul = dir === "desc" ? -1 : 1;
  return [...camps].sort((a, b) => {
    const va = a[key] as string | number | null;
    const vb = b[key] as string | number | null;
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
    return String(va).localeCompare(String(vb)) * mul;
  });
}
