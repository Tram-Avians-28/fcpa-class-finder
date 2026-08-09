# FCPA Activity Finder

Find Fairfax County Park Authority **classes, camps, events, tours, and programs** by
date, age, category, location, and drive time on a linked calendar and map. Save a
printable shortlist of registration codes and open any session in Parktakes Online.

The deployed app is fully static. A scheduled GitHub Action collects the public
registration catalog ahead of time, so visitors do not scrape Fairfax or encounter
browser CORS restrictions.

## How it works

1. The app loads the bundled FCPA activity catalog (or a cached catalog upload).
2. It validates each session and attaches venue coordinates from a shipped gazetteer.
3. Enter your home address + a free [OpenRouteService](https://openrouteservice.org/dev/#/signup)
   key to compute drive times; filter by date, age, category, location, and drive time.
4. Calendar and map are color/pattern-coded by venue and linked by selection.
5. Star activities into a shortlist, print their codes, or open registration details.

Your ORS key and shortlist live only in your browser (`localStorage`). Address searches
and drive-time calculations go to OpenRouteService; the map loads OpenStreetMap tiles.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # typecheck + production build
```

Optional: copy `.env.example` to `.env.local` and set `VITE_ORS_KEY=...` to prefill the
ORS key during local testing. `.env.local` is gitignored and never included in CI builds.

## Data

- Official source: [FCPA Activities Search](https://fairfax.usedirect.com/FairfaxFCPAWeb/ACTIVITIES/Search.aspx).
- `scripts/fetch-activities.mjs` — rate-limited server-side collector. Fairfax caps broad
  searches at five pages, so the collector queries each program category separately and
  subdivides saturated results by month, place, weekday, and age before deduplicating by
  catalog ID.
- `public/fcpa-activities.json` — generated rolling catalog loaded by the app.
- `.github/workflows/refresh-data.yml` — weekly refresh, validation, and commit workflow.
- Admission-ticket, boat/facility-rental, farmers-market, and similar inventory categories
  are excluded from the default program catalog because their thousands of time-slot rows
  would overwhelm a class/activity calendar. Set `FCPA_INCLUDE_INVENTORY=1` when running
  the collector to include them.
- `public/fcpa-camp-spreadsheet.xlsx` — the current official camp workbook, used as a
  secondary source for camp fees and extended-care rows and for legacy workbook uploads.
  It is no longer the default app dataset.
- `src/test/fixtures/fcpa-camp-spreadsheet.xlsx` — a stable real-world parser fixture;
  catalog refreshes intentionally do not replace its legacy-parser tests.
- `fcpa-camp-spreadsheet.xlsx` — the original planning/reference snapshot described in
  `PLAN.md`; it is historical and is not loaded by the app.
- `npm run gazetteer` — regenerates `src/data/gazetteer.json` (venue → lat/lng). Set
  `ORS_API_KEY` to enable the ORS geocoding fallback.

To refresh the bundled catalog manually:

```bash
npm run activities
npm test
npm run build
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys on push to `main`. In the repo:

- **Settings → Pages → Source: GitHub Actions**
- **Settings → Actions → General → Workflow permissions: Read and write** (so the data-refresh job can commit).

The Vite `base` is relative, so it works at `https://<user>.github.io/<repo>/`.

## Versioning

The version shown in the on-screen footer comes from `git describe --tags` at
build time (see `vite.config.ts`). To cut a release, tag a commit and push the tag:

```bash
git tag v0.2.0      # follow semver: vMAJOR.MINOR.PATCH
git push origin v0.2.0
```

Pushing a `v*` tag triggers `deploy.yml`, so the release goes live automatically.
On a tagged commit the footer reads `v0.2.0 (abc1234)`; commits after a tag show
`v0.2.0-3-gabc1234` (3 commits past `v0.2.0`). With no tags it falls back to
`v<package.json version>`. The deploy workflow checks out with `fetch-depth: 0`
so tags are available to the build.
