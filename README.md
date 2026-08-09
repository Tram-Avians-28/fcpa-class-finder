# FCPA Class Finder

Find Fairfax County Park Authority summer camps by **drive time, cost, and dates**,
shown on a **linked calendar + map**, with a **printable shortlist** of registration codes.

A fully static, client-only React app — no backend, no database. It ships with the
current camp spreadsheet bundled in and works out of the box; you can also upload a
newer one.

## How it works

1. The app loads the bundled FCPA camp spreadsheet (or your cached upload, or a fresh upload).
2. It parses ~2,000+ camps and attaches venue coordinates from a shipped gazetteer.
3. Enter your home address + a free [OpenRouteService](https://openrouteservice.org/dev/#/signup)
   key to compute drive times; filter by date, cost, age, category, week, and drive time.
4. Calendar and map are color/pattern-coded by venue and linked by selection.
5. Star camps into a shortlist and print the codes to register with.

Your ORS key and shortlist live only in your browser (`localStorage`); nothing is sent
anywhere except OpenRouteService.

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

- Official source page: [Fairfax County Park Authority Camps](https://www.fairfaxcounty.gov/parks/camps), under **Ready, Set, Register! → Camp Spreadsheet**.
- Official direct download: `https://www.fairfaxcounty.gov/parks/sites/parks/files/Assets/documents/camps/fcpa-camp-spreadsheet.xlsx`.
- `public/fcpa-camp-spreadsheet.xlsx` — the bundled default dataset. Fairfax publishes
  this as a rolling list of upcoming camps, so later downloads can contain fewer rows
  as past sessions are removed and availability is refreshed.
- `.github/workflows/refresh-data.yml` — a monthly Action that re-downloads the latest
  sheet server-side and commits it if it changed (~12 requests/year).
- `src/test/fixtures/fcpa-camp-spreadsheet.xlsx` — a stable real-world parser fixture;
  routine data refreshes intentionally do not replace it or its exact-count tests.
- `fcpa-camp-spreadsheet.xlsx` — the original planning/reference snapshot described in
  `PLAN.md`; it is historical and is not loaded by the app.
- `npm run gazetteer` — regenerates `src/data/gazetteer.json` (venue → lat/lng). Set
  `ORS_API_KEY` to enable the ORS geocoding fallback.

To refresh the bundled data manually from the same official URL used by CI:

```bash
curl -fSL --retry 3 \
  -o public/fcpa-camp-spreadsheet.xlsx \
  "https://www.fairfaxcounty.gov/parks/sites/parks/files/Assets/documents/camps/fcpa-camp-spreadsheet.xlsx"
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
