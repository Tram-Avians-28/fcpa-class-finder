/** A single camp offering, normalized from the FCPA spreadsheet. */
export interface Camp {
  title: string;
  category: string; // "Uncategorized" when the source cell is blank
  catalogId: string; // registration code, e.g. "33S.QI2N"
  community: string; // town the camp is associated with
  venue: string; // specific facility/location name
  fee: number;
  startDate: string; // ISO "YYYY-MM-DD"
  endDate: string; // ISO "YYYY-MM-DD"
  startTime: string | null; // 24h "HH:MM"
  endTime: string | null; // 24h "HH:MM"
  ageMin: number | null; // fractional years (e.g. 3.5 for "3 Years 6 Months")
  ageMax: number | null;
  weekLabel: string; // e.g. "Week 1 (June 22-26)"
  status: string;
  isVirtual: boolean;
  /** Filled in by gazetteer enrichment; undefined until then. */
  lat?: number;
  lng?: number;
  /** Filled in by the drive-time matrix; null means unreachable/unknown. */
  driveMinutes?: number | null;
}

/** A venue name → town pairing read from the spreadsheet's "Lookup Tables". */
export interface VenueRef {
  name: string;
  town: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult extends LatLng {
  label: string;
}

/** Result of parsing an uploaded workbook. */
export interface ParsedWorkbook {
  camps: Camp[];
  venues: VenueRef[];
}

/** A geocoded venue, as stored in the shipped gazetteer JSON. */
export interface GazetteerEntry {
  town: string;
  lat: number;
  lng: number;
}

export type Gazetteer = Record<string, GazetteerEntry>;

/** User-supplied filter criteria. All fields optional → no constraint. */
export interface FilterCriteria {
  startDate?: string; // ISO; keep camps overlapping [startDate, endDate]
  endDate?: string;
  maxFee?: number;
  maxDriveMinutes?: number;
  childAge?: number; // years; keep camps whose [ageMin, ageMax] include it
  categories?: string[]; // keep camps whose category is in this set
  weekLabels?: string[]; // keep camps whose weekLabel is in this set
  includeVirtual?: boolean; // default true; when a drive-time cap is set, virtual camps are kept only if this is true
}
