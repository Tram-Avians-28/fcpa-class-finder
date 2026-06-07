/**
 * Normalization helpers for the messy/mixed cell values in the FCPA spreadsheet.
 * Kept pure and dependency-free so they're trivially unit-testable.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Parse a clock time from the various representations the sheet uses:
 *  - Start Time arrives as an Excel time value (fraction of a day, e.g. 0.375)
 *  - End Time arrives as text with a leading space, e.g. " 4:00 PM"
 *  - occasionally a real Date or a "HH:MM" string
 * Returns 24h "HH:MM" or null.
 */
export function parseClockTime(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel time = fraction of a 24h day. Use only the fractional part.
    const frac = value - Math.floor(value);
    let mins = Math.round(frac * 24 * 60);
    mins = ((mins % 1440) + 1440) % 1440;
    return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
  }

  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3]?.toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return `${pad2(h)}:${pad2(min)}`;
  }

  return null;
}

/**
 * Parse an age expressed like "6 Years", "3 Years 6 Months", or a bare number,
 * into fractional years. Returns null when unparseable.
 */
export function parseAgeYears(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const years = value.match(/(\d+(?:\.\d+)?)\s*years?/i);
  const months = value.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (!years && !months) {
    // bare numeric string?
    const n = Number(value.trim());
    return Number.isFinite(n) && value.trim() !== "" ? n : null;
  }
  const y = years ? parseFloat(years[1]) : 0;
  const mo = months ? parseFloat(months[1]) : 0;
  return y + mo / 12;
}

const EXCEL_EPOCH_OFFSET = 25569; // days from 1899-12-30 to 1970-01-01

/**
 * Convert an Excel date serial (or Date / ISO string) to an ISO "YYYY-MM-DD".
 * Uses UTC throughout to avoid timezone drift. Returns null when unparseable.
 */
export function excelDateToISO(value: unknown): string | null {
  if (value == null || value === "") return null;

  let d: Date;
  if (value instanceof Date) {
    d = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  } else if (typeof value === "number" && Number.isFinite(value)) {
    d = new Date(Math.round((value - EXCEL_EPOCH_OFFSET) * 86400 * 1000));
  } else if (typeof value === "string") {
    const parsed = new Date(value.trim());
    if (Number.isNaN(parsed.getTime())) return null;
    d = parsed;
  } else {
    return null;
  }

  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Trim/normalize a free-text cell to a string ("" for blank). */
export function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/** Parse a fee cell to a number; null when not numeric. */
export function parseFee(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) && value.trim() !== "" ? n : null;
  }
  return null;
}
