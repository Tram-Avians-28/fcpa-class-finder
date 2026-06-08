/**
 * Build/extend src/data/gazetteer.json: venue name -> { town, lat, lng }.
 *
 * Geocodes the venues from the spreadsheet's "Lookup Tables" sheet.
 *
 * Geocoders, in order per venue:
 *   1. Google Geocoding    (most accurate; only if GOOGLE_MAPS_API_KEY is set —
 *      and when set, ALL venues are re-geocoded for consistency)
 *   2. OpenStreetMap Nominatim (no key; >=1s between requests per their policy)
 *   3. OpenRouteService Pelias (fallback; only if ORS_API_KEY is set)
 * MANUAL_COORDS (verified street addresses) always win. Without a key it runs
 * incrementally, filling only missing venues.
 *
 *   npm run gazetteer                              # Nominatim, fills gaps only
 *   GOOGLE_MAPS_API_KEY=xxx npm run gazetteer      # Google, re-geocode everything
 *   npm run gazetteer -- path/to/file.xlsx
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import * as XLSX from "xlsx";

const SRC = process.argv[2] || "fcpa-camp-spreadsheet.xlsx";
const OUT = "src/data/gazetteer.json";
const UA = "ffx-camps/0.1 one-time venue geocoder (https://github.com/local/ffx-camps)";
const DELAY_MS = 1100;
const ORS_KEY = process.env.ORS_API_KEY || "";
const GOOGLE = process.env.GOOGLE_MAPS_API_KEY || "";

// Normalize odd source spellings to a canonical name.
const ALIASES = { gmufieldhouse: "GMU Field House" };
const canonical = (name) => ALIASES[name.toLowerCase().replace(/\s+/g, "")] ?? name;
const key = (name) => name.toLowerCase().replace(/\s+/g, " ").trim();

// All FCPA venues sit in/around Fairfax County. Reject anything outside this box
// (catches same-named places in other cities/states, e.g. an "Acton Academy" in TX).
const REGION = { minLat: 38.5, maxLat: 39.15, minLng: -77.65, maxLng: -77.0 };
const inRegion = (lat, lng) =>
  lat >= REGION.minLat && lat <= REGION.maxLat && lng >= REGION.minLng && lng <= REGION.maxLng;

// Better search strings for venues Nominatim can't find under their sheet name.
const QUERY_OVERRIDES = {
  "westfields high school": "Westfield High School, Chantilly, VA, USA",
  "spring hill rec center": "Spring Hill RECenter, McLean, VA, USA",
  "south run rec center": "South Run RECenter, Springfield, VA, USA",
  "oakmont rec center": "Oakmont Recreation Center, Oakton, VA, USA",
  "george washington rec center": "George Washington RECenter, Alexandria, VA, USA",
  "gmu field house": "George Mason University Field House, Fairfax, VA, USA",
  "colin powell elementary school": "Colin Powell Elementary School, Centreville, VA, USA",
  "bach to rock mclean": "Bach to Rock, McLean, VA, USA",
  "back to rock herndon": "Bach to Rock, Herndon, VA, USA",
  "bricks & minifigs herndon": "Bricks & Minifigs, Herndon, VA, USA",
  "craftspace": "Craftspace, Chantilly, VA, USA",
  "fairfax fencers": "Fairfax Fencers, Chantilly, VA, USA",
  "lucia farms equestrian": "Lucia Farms, Herndon, VA, USA",
  "northern va therapeutic riding program":
    "Northern Virginia Therapeutic Riding Program, Clifton, VA, USA",
  "reston conservatory": "Reston Conservatory Ballet, Reston, VA, USA",
  "lewinsville house": "Lewinsville Park, McLean, VA, USA",
  "acton academy": "Acton Academy, Falls Church, VA, USA",
  "va academy of fencing": "Virginia Academy of Fencing, Springfield, VA, USA",
};

// Hard-coded coordinates, sourced from each venue's real street address
// (US Census geocoder; GMU Field House via ORS). These override geocoding so the
// result is deterministic. Fixes the 3 that wouldn't geocode plus a few that
// matched the wrong place. "GMUFieldHouse" is the no-space spelling used in the
// camp rows, so it's included as its own key for enrichment matching.
const MANUAL_COORDS = {
  Craftspace: { town: "Chantilly", lat: 38.9106, lng: -77.450869 },
  "Bricks & Minifigs Herndon": { town: "Herndon", lat: 38.966147, lng: -77.396775 },
  "Patriot Park North": { town: "Fairfax", lat: 38.830339, lng: -77.378051 },
  "Northern Va Therapeutic Riding Program": { town: "Clifton", lat: 38.806493, lng: -77.39805 },
  "GMU Field House": { town: "Fairfax", lat: 38.82655, lng: -77.309231 },
  GMUFieldHouse: { town: "Fairfax", lat: 38.82655, lng: -77.309231 },
  "Oakmont Rec Center": { town: "Oakton", lat: 38.875016, lng: -77.312743 },
  "George Washington Rec Center": { town: "Fort Belvoir", lat: 38.728371, lng: -77.094009 },
  "South Run Rec Center": { town: "Springfield", lat: 38.750929, lng: -77.275444 },
  "Spring Hill Rec Center": { town: "McLean", lat: 38.915244, lng: -77.235422 },
  "Spring Hill Elementary School": { town: "McLean", lat: 38.93749, lng: -77.239272 },
  "VA Academy of Fencing": { town: "Springfield", lat: 38.730438, lng: -77.185689 },
  // Google mis-placed this 3.4km into Great Falls village; real address 1089 Utterback Store Rd.
  "Great Falls Nike": { town: "Great Falls", lat: 38.995213, lng: -77.329267 },
};

function readVenues(file) {
  const wb = XLSX.read(readFileSync(file));
  const sheet = wb.SheetNames.find((n) => /lookup/i.test(n));
  if (!sheet) throw new Error("No 'Lookup Tables' sheet found.");
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, blankrows: false });
  let locCol = -1, townCol = -1, headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const lower = rows[i].map((c) => String(c ?? "").trim().toLowerCase());
    const l = lower.indexOf("location");
    const t = lower.findIndex((c) => ["town/city", "town", "city"].includes(c));
    if (l !== -1 && t !== -1) { locCol = l; townCol = t; headerRow = i; break; }
  }
  if (headerRow === -1) throw new Error("Could not find Location/Town columns.");
  const out = new Map();
  for (let i = headerRow + 1; i < rows.length; i++) {
    const raw = String(rows[i][locCol] ?? "").trim();
    if (!raw || /^virtual/i.test(raw)) continue;
    const name = canonical(raw);
    const town = String(rows[i][townCol] ?? "").trim();
    if (!out.has(key(name))) out.set(key(name), { name, town });
  }
  return [...out.values()];
}

function validate(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!inRegion(lat, lng)) return null; // reject out-of-area matches
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

async function geocodeNominatim(query) {
  // viewbox + bounded restricts results to the NoVA box.
  const viewbox = `${REGION.minLng},${REGION.maxLat},${REGION.maxLng},${REGION.minLat}`;
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&bounded=1" +
    `&viewbox=${viewbox}&q=` + encodeURIComponent(query);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr.length) return null;
  return validate(+arr[0].lat, +arr[0].lon);
}

async function geocodeORS(query) {
  if (!ORS_KEY) return null;
  const rect =
    `&boundary.rect.min_lon=${REGION.minLng}&boundary.rect.min_lat=${REGION.minLat}` +
    `&boundary.rect.max_lon=${REGION.maxLng}&boundary.rect.max_lat=${REGION.maxLat}`;
  const url =
    "https://api.openrouteservice.org/geocode/search?boundary.country=US&size=1&api_key=" +
    ORS_KEY + rect + "&text=" + encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  const f = j.features && j.features[0];
  if (!f) return null;
  const [lng, lat] = f.geometry.coordinates;
  return validate(lat, lng);
}

async function geocodeGoogle(query) {
  if (!GOOGLE) return null;
  const params = new URLSearchParams({
    key: GOOGLE,
    address: query,
    components: "country:US|administrative_area:VA",
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  if (!res.ok) return null;
  const j = await res.json();
  if (j.status === "REQUEST_DENIED" || j.status === "OVER_QUERY_LIMIT") {
    throw new Error(`Google Geocoding ${j.status}: ${j.error_message || "check the key/billing"}`);
  }
  const loc = j.results?.[0]?.geometry?.location;
  return loc ? validate(loc.lat, loc.lng) : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let gaz = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
// Drop any previously-stored entries that fall outside the region (bad matches),
// so they get re-geocoded with the bounded queries below.
const before = Object.keys(gaz).length;
gaz = Object.fromEntries(Object.entries(gaz).filter(([, v]) => inRegion(v.lat, v.lng)));
const pruned = before - Object.keys(gaz).length;
const have = new Set(Object.keys(gaz).map(key));
const venues = readVenues(SRC);
// With Google available, re-geocode everything for consistent accuracy; otherwise
// only fill gaps. Hard-coded (verified) venues are always skipped here.
const refreshAll = Boolean(GOOGLE);
const todo = venues.filter((v) => !(v.name in MANUAL_COORDS) && (refreshAll || !have.has(key(v.name))));
console.error(
  `${venues.length} venues; ${Object.keys(gaz).length} valid existing (pruned ${pruned}); ` +
    `${todo.length} to ${refreshAll ? "re-geocode (Google)" : "fill (Nominatim)"}.`,
);

const missing = [];
for (const { name, town } of todo) {
  const override = QUERY_OVERRIDES[key(name)];
  let hit = null;

  if (GOOGLE) {
    hit = await geocodeGoogle(override || `${name}, ${town}, VA, USA`);
    await sleep(120); // Google allows ~50 QPS; stay gentle
  }
  if (!hit) {
    const queries = [override, `${name}, ${town}, VA, USA`, `${name}, Fairfax County, VA, USA`, `${name}, Virginia, USA`].filter(Boolean);
    for (const q of queries) {
      hit = await geocodeNominatim(q);
      await sleep(DELAY_MS);
      if (hit) break;
    }
  }
  if (!hit && ORS_KEY) {
    hit = await geocodeORS(override || `${name}, ${town}, VA`);
  }

  if (hit) {
    gaz[name] = { town, lat: hit.lat, lng: hit.lng };
    console.error(`  ok   ${name} -> ${hit.lat},${hit.lng}`);
  } else {
    missing.push(`${name} (${town})`);
    console.error(`  MISS ${name}`);
  }
}

// Apply hard-coded overrides last so they always win.
for (const [name, coords] of Object.entries(MANUAL_COORDS)) {
  gaz[name] = coords;
}
console.error(`Applied ${Object.keys(MANUAL_COORDS).length} hard-coded coordinates.`);

mkdirSync(dirname(OUT), { recursive: true });
const sorted = Object.fromEntries(Object.entries(gaz).sort((a, b) => a[0].localeCompare(b[0])));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.error(`\nWrote ${Object.keys(sorted).length} venues to ${OUT}`);
if (missing.length) console.error(`Still missing (${missing.length}): ${missing.join("; ")}`);
