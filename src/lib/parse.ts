import * as XLSX from "xlsx";
import {
  cellText,
  excelDateToISO,
  parseAgeYears,
  parseClockTime,
  parseFee,
} from "./normalize";
import type { Camp, Gazetteer, ParsedWorkbook, VenueRef } from "./types";

const VIRTUAL_VENUE = "virtual fcpa";

type Row = unknown[];

/** Column headers we expect on the camps sheet (lowercased for matching). */
const REQUIRED_HEADERS = ["camp title", "catalog id"];

function rowToLowerStrings(row: Row): string[] {
  return row.map((c) => cellText(c).toLowerCase());
}

/** Find the header row index and a map of header-name → column index. */
function findHeader(rows: Row[]): { headerRow: number; cols: Record<string, number> } {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const lower = rowToLowerStrings(rows[i]);
    if (REQUIRED_HEADERS.every((h) => lower.includes(h))) {
      const cols: Record<string, number> = {};
      lower.forEach((name, idx) => {
        if (name && !(name in cols)) cols[name] = idx;
      });
      return { headerRow: i, cols };
    }
  }
  throw new Error(
    "Could not find the camp header row (expected columns 'Camp Title' and 'Catalog ID'). Is this the FCPA camp spreadsheet?",
  );
}

/** Pick the worksheet that holds camp data (prefer one named like "...Camps"). */
function findCampSheet(wb: XLSX.WorkBook): string {
  const named = wb.SheetNames.find((n) => /camp/i.test(n));
  if (named) return named;
  return wb.SheetNames[0];
}

function cell(row: Row, cols: Record<string, number>, name: string): unknown {
  const idx = cols[name];
  return idx == null ? undefined : row[idx];
}

function rowToCamp(row: Row, cols: Record<string, number>): Camp | null {
  const title = cellText(cell(row, cols, "camp title"));
  const catalogId = cellText(cell(row, cols, "catalog id"));
  // A real camp row must have at least a title and a catalog id.
  if (!title || !catalogId) return null;

  const venue = cellText(cell(row, cols, "location"));
  const categoryRaw = cellText(cell(row, cols, "camp category"));

  return {
    title,
    category: categoryRaw || "Uncategorized",
    catalogId,
    community: cellText(cell(row, cols, "community")),
    venue,
    fee: parseFee(cell(row, cols, "fee")) ?? 0,
    startDate: excelDateToISO(cell(row, cols, "start date")) ?? "",
    endDate: excelDateToISO(cell(row, cols, "end date")) ?? "",
    startTime: parseClockTime(cell(row, cols, "start time")),
    endTime: parseClockTime(cell(row, cols, "end time")),
    ageMin: parseAgeYears(cell(row, cols, "min age")),
    ageMax: parseAgeYears(cell(row, cols, "max age")),
    weekLabel: cellText(cell(row, cols, "date range")),
    status: cellText(cell(row, cols, "status")),
    isVirtual: venue.toLowerCase() === VIRTUAL_VENUE,
  };
}

/** Read the "Lookup Tables" sheet for the venue → town list, if present. */
function parseVenues(wb: XLSX.WorkBook): VenueRef[] {
  const sheetName = wb.SheetNames.find((n) => /lookup/i.test(n));
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], {
    header: 1,
    raw: true,
    blankrows: false,
  });

  // Locate the "Location" and "Town/City" header columns.
  let locCol = -1;
  let townCol = -1;
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const lower = rowToLowerStrings(rows[i]);
    const l = lower.indexOf("location");
    const t = lower.findIndex((c) => c === "town/city" || c === "town" || c === "city");
    if (l !== -1 && t !== -1) {
      locCol = l;
      townCol = t;
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) return [];

  const seen = new Set<string>();
  const venues: VenueRef[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const name = cellText(rows[i][locCol]);
    if (!name) continue;
    const town = cellText(rows[i][townCol]);
    const key = `${name.toLowerCase()}|${town.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    venues.push({ name, town });
  }
  return venues;
}

/** Parse an uploaded FCPA camp workbook into normalized camps + venue list. */
export function parseWorkbook(data: ArrayBuffer | Uint8Array): ParsedWorkbook {
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.Sheets[findCampSheet(wb)];
  if (!sheet) throw new Error("Workbook has no usable sheets.");

  const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
  });

  const { headerRow, cols } = findHeader(rows);
  const camps: Camp[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const camp = rowToCamp(rows[i], cols);
    if (camp) camps.push(camp);
  }

  return { camps, venues: parseVenues(wb) };
}

/** Normalize a venue name for gazetteer lookup (case/space/variant tolerant). */
export function venueKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Attach lat/lng to camps from a gazetteer, matching on venue name. */
export function enrichWithGazetteer(camps: Camp[], gaz: Gazetteer): Camp[] {
  const byKey = new Map<string, { lat: number; lng: number }>();
  for (const [name, entry] of Object.entries(gaz)) {
    byKey.set(venueKey(name), { lat: entry.lat, lng: entry.lng });
  }
  return camps.map((c) => {
    if (c.isVirtual) return c;
    const hit = byKey.get(venueKey(c.venue));
    return hit ? { ...c, lat: hit.lat, lng: hit.lng } : c;
  });
}
