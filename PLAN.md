# FFX Camps — Planning Spec

A web app that makes Fairfax County Park Authority (FCPA) **kids' summer camps**
explorable by **drive time, cost, and dates**, showing results on a **calendar and
map simultaneously**, and producing a **printable list of registration codes**.

Status: planning / refining. No code yet. Data model now verified against the
real spreadsheet (`fcpa-camp-spreadsheet.xlsx`, 2,151 camps).

---

## Decisions locked in

| Decision | Choice | Implication |
|---|---|---|
| Scope | FCPA kids' summer camps only | Focused catalog, not adult/RECenter classes |
| Data source | **User imports the official FCPA camp spreadsheet** | No scraping, no pipeline, no ToS issues |
| Data freshness | One-time import per session | No database, no scheduled jobs |
| Drive time | OpenRouteService (ORS), free tier | `geocode` + `matrix` endpoints |
| API key handling | **Pure client-side** — user supplies own ORS key | Zero backend; key stored in browser localStorage |
| Calendar times | **Real start/end times** (confirmed present) | No need to assume hours |

**Net architecture: a fully static, client-only single-page app.** No server, no
database, near-zero hosting cost (GitHub Pages / Netlify / Vercel static).

---

## Confirmed data profile (from the real file)

- **Sheets:** `2026 FCPA Camps` (data, header on row 11), `How to Use This
  Spreadsheet` (instructions), `Lookup Tables` (communities, venues→town, week labels).
- **2,151 camps**, dates **2026-05-25 → 2026-09-04**.
- **Fees:** $32–$1,440, all numeric.
- **Categories:** 21 values (SPORTS, STEM, NATURE, PERFORMING ARTS, COOKING,
  AQUATIC, EQUESTRIAN, …); 298 rows have a blank category → treat as "Uncategorized".
- **Durations:** 5-day (1,751), 4-day (333), 1–3 day "School Day Out" (49),
  multi-week 11–12 day (18). Calendar must handle variable spans.
- **Virtual:** 70 camps at venue `Virtual FCPA` (town `Virtual`) — no map/drive-time.
- **Venues:** 59 used this year; `Lookup Tables` lists **121 venues with Town/City**.
- **Completeness:** only `Camp Category` ever blank; all other fields populated.

---

## End-to-end flow

```
1. User downloads the FCPA camp spreadsheet from fairfaxcounty.gov/parks/camps
2. User opens the app, pastes their free ORS API key (saved locally), uploads the file.
3. App parses it in-browser (SheetJS) → list of camps + venue list from Lookup Tables.
4. App attaches lat/lng to each venue via the shipped gazetteer.
5. User enters: home address, date range, max cost, max drive time (+ optional age/category).
6. App geocodes the home address (1 ORS call) and computes a drive-time matrix:
   home → all distinct physical venues (batched, ~2 ORS calls).
7. App filters camps and renders a linked calendar + map. Sliders re-filter
   instantly (no further API calls).
8. User adds camps to a shortlist (persisted locally) and prints a clean sheet
   of registration codes.
```

---

## Tech stack

- **App:** Vite + React (single static bundle)
- **Spreadsheet parsing:** SheetJS (`xlsx`)
- **Calendar:** FullCalendar
- **Map:** Leaflet + OpenStreetMap tiles
- **Routing/geocoding:** OpenRouteService (`/geocode/search`, `/v2/matrix/driving-car`)
- **Persistence:** browser `localStorage` (ORS key + shortlist)
- **Backend / DB:** none

---

## Data model + parsing rules (per camp)

| Field | Source column | Type | Parsing rule |
|---|---|---|---|
| `title` | Camp Title | str | — |
| `category` | Camp Category | str | blank → "Uncategorized" |
| `catalog_id` | Catalog ID | str | e.g. `33S.QI2N` — the print payoff |
| `community` | Community | str | town for grouping/filter |
| `venue` | Location | str | join to gazetteer for lat/lng |
| `fee` | Fee | number | cost filter |
| `start_date` | Start Date | date | — |
| `end_date` | End Date | date | spans 1–12 days |
| `start_time` | Start Time | time | already a time value |
| `end_time` | End Time | str/time | **strip leading space, parse "H:MM AM/PM"**; also accept time value |
| `age_min` | Min Age | str | parse `"N Years [M Months]"` → years (e.g. 5.25) |
| `age_max` | Max Age | str | same |
| `week_label` | Date Range | str | e.g. `Week 1 (June 22-26)` — week filter |
| `status` | Status | str | availability note text |
| `is_virtual` | derived | bool | venue == `Virtual FCPA` → no map/drive-time |

---

## Venue gazetteer (the only data we own)

A static JSON shipped with the app: venue name → `{town, lat, lng}`, built once
by geocoding `"<venue>, <town>, VA"` for the 121 venues in `Lookup Tables`.

- Cleanup: merge `GMU Field House` / `GMUFieldHouse`; handle `Clark House` and
  `Navy Elementary School` appearing under two towns; `Woodley Hills` town = Mt. Vernon.
- Only the **home address** needs live geocoding (1 call).
- Drive time = matrix call, home → distinct physical venues, batched (~50/req → ~2 calls).
- Unknown/new venue → geocode live + flag for user correction.

---

## Filtering (all client-side after the one matrix pass)

- **Dates:** keep camps whose [start,end] overlaps the chosen range (or by week label).
- **Cost:** `fee ≤ max`.
- **Drive time:** venue's matrix duration `≤ max minutes` (virtual camps excluded).
- **Age (optional):** `age_min ≤ child age ≤ age_max`.
- **Category (optional):** multi-select.

Filtering is in-memory, so all controls update the calendar + map live.

---

## Linked calendar + map

- Camps render as events spanning their real dates/times (FullCalendar), color-coded
  by venue or drive-time bucket. Handles 1-day through multi-week spans.
- Each distinct physical venue is a Leaflet pin; pin shows count of matching camps + drive time.
- **Shared selection/hover state:** hover a calendar event → its pin highlights;
  click a pin → calendar filters to that venue. Core feature.
- Virtual camps shown in a separate list/section (no pin).

---

## Shortlist → print

A local "cart." Printable output lists, per chosen camp:
**catalog/registration code, title, week, real times, venue, fee** — so parents
have codes ready when registration opens (FCPA opens registration on staggered dates).

---

## Build phases (proposed)

1. **Parser + data model** — upload, parse, normalize (times/ages/virtual). ✅ schema verified.
2. **Gazetteer** — geocode the 121 venues once → ship JSON.
3. **ORS integration** — key entry, address geocode, batched drive-time matrix.
4. **Filters + results list** — date/cost/drive-time/age/category, plain list first.
5. **Calendar + map** — render, then link selection state.
6. **Shortlist + print** — cart, printable sheet, localStorage.

---

## Open items
- **Virtual camps (70):** show in a separate list, or omit entirely? (default: separate list)
- Default treatment when a camp's age range is given in months (e.g. "3 Years 6 Months").
- Whether to expose the week-label filter (`Week 1…9`, Pre/Post-Summer) in addition to a date range.
