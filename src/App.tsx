import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPanel } from "./components/CalendarPanel";
import { CampTable } from "./components/CampTable";
import { DrivePanel } from "./components/DrivePanel";
import { Filters } from "./components/Filters";
import gazetteerData from "./data/gazetteer.json";
import { applyDriveTimes, uniqueVenuePoints, venueMinutesMap } from "./lib/drivetime";
import { distinctCategories, distinctVenues, distinctWeekLabels, filterCamps } from "./lib/filter";
import { driveMatrixMinutes, geocodeAddress } from "./lib/ors";
import { enrichWithGazetteer, parseWorkbook } from "./lib/parse";
import { toggleId } from "./lib/shortlist";
import { buildVenueStyles } from "./lib/venueStyle";
import { CampDetail } from "./components/CampDetail";
import { MapPanel } from "./components/MapPanel";
import { ShortlistView } from "./components/ShortlistView";
import { clearDataset, daysSince, isStale, loadDataset, saveDataset } from "./lib/datasetCache";
import { readSharedFromHash, shareUrl } from "./lib/shareState";
import { safeGet, safeSet } from "./lib/storage";
import type { Camp, FilterCriteria, Gazetteer, GeocodeResult } from "./lib/types";

const gazetteer = gazetteerData as Gazetteer;
const DEFAULT_DATASET_URL = `${import.meta.env.BASE_URL}fcpa-camp-spreadsheet.xlsx`;
// Build-time provenance, injected by vite.config.ts `define`.
// APP_VERSION is `git describe` output, e.g. "v0.1.0" or "v0.1.0-3-gabc1234".
const APP_VERSION = __APP_VERSION__;
const GIT_HASH = __GIT_HASH__;
// On exact tags the version has no hash, so show it; between releases the
// version already ends in "-g<hash>", so the separate hash would be redundant.
const SHOW_HASH = GIT_HASH !== "dev" && !APP_VERSION.includes(GIT_HASH);
// Commit date of the bundled spreadsheet, e.g. "2026-06-06T18:29:00-04:00".
const DATA_DATE = __DATA_DATE__ ? __DATA_DATE__.slice(0, 10) : "";
// Baked in at build time from the ORS_KEY secret (CI) or .env.local (dev).
const BUILT_IN_ORS_KEY = import.meta.env.VITE_ORS_KEY ?? "";
type Tab = "calendar" | "list" | "shortlist";

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Default filters: show from today through the last day in the dataset. */
function defaultCriteria(camps: Camp[]): FilterCriteria {
  const ends = camps.map((c) => c.endDate).filter(Boolean);
  if (ends.length === 0) return { includeVirtual: false };
  const maxEnd = ends.reduce((m, d) => (d > m ? d : m));
  const minStart = camps.map((c) => c.startDate).filter(Boolean).reduce((m, d) => (d < m ? d : m), maxEnd);
  const today = todayISO();
  return {
    includeVirtual: false,
    startDate: today <= maxEnd ? today : minStart,
    endDate: maxEnd,
    maxDriveMinutes: 30,
  };
}

export default function App() {
  // A shared view (#share= link) seeds the initial filters / tab / selection / shortlist.
  const [shared] = useState(() => readSharedFromHash());
  const consumedShare = useRef(false);

  const [camps, setCamps] = useState<Camp[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [criteria, setCriteria] = useState<FilterCriteria>(() => shared?.c ?? { includeVirtual: false });
  const [tab, setTab] = useState<Tab>(() =>
    shared?.t === "list" || shared?.t === "shortlist" ? shared.t : "calendar",
  );
  const [selectedVenue, setSelectedVenue] = useState<string | null>(() => shared?.sv ?? null);
  const [filtersOpen, setFiltersOpen] = useState(true); // mobile drawer open by default (discoverability)
  const [detailCamp, setDetailCamp] = useState<Camp | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dataset provenance: when the cached upload was saved, whether we're on the
  // bundled (CI-refreshed) default, and whether the stale reminder was dismissed.
  const [dataSavedAt, setDataSavedAt] = useState<number | null>(null);
  const [usingBundled, setUsingBundled] = useState(false);
  const [staleDismissed, setStaleDismissed] = useState(false);

  // Drive-time state. A saved key wins; otherwise use the app-provided key
  // (BUILT_IN_ORS_KEY). When that exists, the key field is hidden entirely.
  const [orsKey, setOrsKey] = useState(() => safeGet("ors_key") || BUILT_IN_ORS_KEY);
  const [address, setAddress] = useState(() => safeGet("home_address"));
  const [home, setHome] = useState<GeocodeResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [driveError, setDriveError] = useState("");

  // Shortlist of catalog IDs, persisted across reloads.
  const [shortlist, setShortlist] = useState<string[]>(() => {
    if (shared?.sl) return shared.sl;
    try {
      return JSON.parse(safeGet("shortlist") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    safeSet("ors_key", orsKey);
  }, [orsKey]);
  useEffect(() => {
    safeSet("home_address", address);
  }, [address]);
  useEffect(() => {
    safeSet("shortlist", JSON.stringify(shortlist));
  }, [shortlist]);

  const patch = (p: Partial<FilterCriteria>) => setCriteria((c) => ({ ...c, ...p }));
  const reset = () => {
    setCriteria(defaultCriteria(camps));
    setSelectedVenue(null);
  };
  const toggleShortlist = (id: string) => setShortlist((s) => toggleId(s, id));
  const forgetKey = () => setOrsKey("");

  // Parse + load a dataset into state. Throws if the file isn't a camp workbook.
  function ingest(bytes: ArrayBuffer, name: string): void {
    const { camps: parsed } = parseWorkbook(bytes);
    if (parsed.length === 0) throw new Error("No camps found in this file.");
    setCamps(enrichWithGazetteer(parsed, gazetteer));
    setFileName(name);
    // Honor a shared view on first load; otherwise apply default filters.
    if (shared && !consumedShare.current) {
      consumedShare.current = true;
    } else {
      setCriteria(defaultCriteria(parsed));
      setSelectedVenue(null);
    }
    setHome(null);
    setError("");
  }

  async function shareView() {
    const url = shareUrl({ c: criteria, t: tab, sv: selectedVenue, sl: shortlist });
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard may be blocked; still update the address bar below */
    }
    try {
      history.replaceState(null, "", url);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // On first load: restore the cached upload, else fetch the bundled default
  // (kept current by a monthly GitHub Action). Either is overridable by upload.
  useEffect(() => {
    let cancelled = false;
    const cached = loadDataset();
    if (cached) {
      try {
        ingest(cached.bytes, cached.fileName);
        setDataSavedAt(cached.savedAt || null);
        setUsingBundled(false);
        return;
      } catch {
        clearDataset();
      }
    }
    fetch(DEFAULT_DATASET_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("no default dataset"))))
      .then((buf) => {
        if (cancelled) return;
        ingest(buf, "FCPA camp spreadsheet (bundled)");
        setDataSavedAt(null);
        setUsingBundled(true);
      })
      .catch(() => {
        /* no default available — the upload prompt is shown */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    setError("");
    try {
      const buf = await file.arrayBuffer();
      ingest(buf, file.name);
      setDataSavedAt(saveDataset(buf, file.name));
      setUsingBundled(false);
      setStaleDismissed(false);
    } catch (err) {
      setCamps([]);
      setFileName("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function computeDrive() {
    setDriveError("");
    setComputing(true);
    try {
      const geo = await geocodeAddress(orsKey.trim(), address.trim());
      const points = uniqueVenuePoints(camps);
      const minutes = await driveMatrixMinutes(orsKey.trim(), { lat: geo.lat, lng: geo.lng }, points);
      const minutesByVenue = venueMinutesMap(points, minutes);
      setCamps((prev) => applyDriveTimes(prev, minutesByVenue));
      setHome(geo);
      if (criteria.maxDriveMinutes == null) patch({ maxDriveMinutes: 30 });
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : String(err));
    } finally {
      setComputing(false);
    }
  }

  const categories = useMemo(() => distinctCategories(camps), [camps]);
  const weekLabels = useMemo(() => distinctWeekLabels(camps), [camps]);
  const venueOptions = useMemo(() => distinctVenues(camps), [camps]);
  const feeBounds = useMemo(() => {
    if (camps.length === 0) return { min: 0, max: 1000 };
    const fees = camps.map((c) => c.fee);
    return { min: Math.min(...fees), max: Math.max(...fees) };
  }, [camps]);
  // Open the calendar on the default start (today, clamped into the season).
  const initialDate = useMemo(() => defaultCriteria(camps).startDate || "2026-06-22", [camps]);

  // The max-drive-time filter only applies once drive times exist (home set);
  // otherwise a shared link with that filter would hide everything.
  const filtered = useMemo(
    () => filterCamps(camps, home ? criteria : { ...criteria, maxDriveMinutes: undefined }),
    [camps, criteria, home],
  );
  const venueCamps = selectedVenue ? filtered.filter((c) => c.venue === selectedVenue) : filtered;
  const shortlistSet = useMemo(() => new Set(shortlist), [shortlist]);
  const shortlistCamps = useMemo(
    () => camps.filter((c) => shortlistSet.has(c.catalogId)),
    [camps, shortlistSet],
  );
  // Shared venue color+pattern coding for the calendar and map (based on what's visible).
  const venueStyles = useMemo(() => buildVenueStyles(filtered), [filtered]);

  const stale =
    !usingBundled && dataSavedAt != null && !staleDismissed && isStale(dataSavedAt, Date.now());

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <a
            href="https://fairfax.usedirect.com/FairfaxFCPAWeb/"
            target="_blank"
            rel="noreferrer"
            title="Open Parktakes Online registration"
          >
            FCPA Camps
          </a>
        </h1>
        {camps.length > 0 ? (
          <button
            className="filters-toggle"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            {filtersOpen ? "Hide filters" : "Filters"}
          </button>
        ) : null}
        <span className="status">
          {camps.length > 0
            ? `${fileName} · ${filtered.length} of ${camps.length} camps`
            : "Find Fairfax County summer camps by date, cost & drive time"}
        </span>
        <span className="spacer" />
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {camps.length > 0 ? (
          <button className="upload-btn" onClick={shareView} title="Copy a link that reproduces this view">
            {copied ? "Link copied!" : "Share view"}
          </button>
        ) : null}
      </header>

      {camps.length === 0 ? (
        <div className="empty">
          <div className="card">
            <h2>Get started</h2>
            <p>
              Download the official Fairfax County Park Authority camp spreadsheet from{" "}
              <a href="https://www.fairfaxcounty.gov/parks/camps" target="_blank" rel="noreferrer">
                fairfaxcounty.gov/parks/camps
              </a>
              , then upload it here to explore camps on a calendar and map, filtered by date, cost,
              age, and drive time from your home.
            </p>
            <button
              className="upload-btn"
              style={{ background: "var(--accent)" }}
              onClick={() => fileRef.current?.click()}
            >
              Upload spreadsheet
            </button>
            {error ? <div className="error">{error}</div> : null}
          </div>
        </div>
      ) : (
        <>
          {stale ? (
            <div className="stale-banner no-print">
              <span>
                ⚠️ Your camp data is {daysSince(dataSavedAt!, Date.now())} days old — listings may have
                changed. Download the latest from{" "}
                <a href="https://www.fairfaxcounty.gov/parks/camps" target="_blank" rel="noreferrer">
                  fairfaxcounty.gov/parks/camps
                </a>{" "}
                and re-upload.
              </span>
              <span className="spacer" />
              <button className="upload-btn" onClick={() => fileRef.current?.click()}>
                Upload latest
              </button>
              <button className="clear-link" onClick={() => setStaleDismissed(true)}>
                dismiss
              </button>
            </div>
          ) : null}
          <div className="layout">
            <aside className={`sidebar ${filtersOpen ? "open" : ""}`}>
            <DrivePanel
              orsKey={orsKey}
              onOrsKey={setOrsKey}
              address={address}
              onAddress={setAddress}
              onCompute={computeDrive}
              computing={computing}
              home={home}
              driveError={driveError}
              maxDriveMinutes={criteria.maxDriveMinutes}
              onMaxDrive={(v) => patch({ maxDriveMinutes: v })}
              onForgetKey={forgetKey}
              keyProvided={BUILT_IN_ORS_KEY !== ""}
            />
            <Filters
              criteria={criteria}
              onChange={patch}
              onReset={reset}
              categories={categories}
              weekLabels={weekLabels}
              venues={venueOptions}
              feeBounds={feeBounds}
            />
          </aside>

          <div className="main">
            <div className="tabs no-print">
              <button
                className={`tab ${tab === "calendar" ? "active" : ""}`}
                onClick={() => setTab("calendar")}
              >
                Calendar + Map
              </button>
              <button
                className={`tab ${tab === "list" ? "active" : ""}`}
                onClick={() => setTab("list")}
              >
                List <span className="count-pill">{venueCamps.length}</span>
              </button>
              <button
                className={`tab ${tab === "shortlist" ? "active" : ""}`}
                onClick={() => setTab("shortlist")}
              >
                Shortlist <span className="count-pill">{shortlist.length}</span>
              </button>
            </div>

            {selectedVenue && tab !== "shortlist" ? (
              <div className="selbar">
                Showing <strong>{selectedVenue}</strong> ({venueCamps.length} camps)
                <button className="clear-link" onClick={() => setSelectedVenue(null)}>
                  clear
                </button>
              </div>
            ) : null}

            {tab === "calendar" && (
              <>
                <MapPanel
                  camps={filtered}
                  home={home}
                  selectedVenue={selectedVenue}
                  onSelectVenue={setSelectedVenue}
                  venueStyles={venueStyles}
                />
                <CalendarPanel
                  camps={filtered}
                  initialDate={initialDate}
                  selectedVenue={selectedVenue}
                  onSelectCamp={setDetailCamp}
                  venueStyles={venueStyles}
                />
              </>
            )}
            {tab === "list" && (
              <CampTable
                camps={venueCamps}
                shortlist={shortlistSet}
                onToggleShortlist={toggleShortlist}
                showDrive={home != null}
                filterable
                onSelectCamp={setDetailCamp}
              />
            )}
            {tab === "shortlist" && (
              <ShortlistView
                camps={shortlistCamps}
                home={home}
                onToggleShortlist={toggleShortlist}
                onSelectCamp={setDetailCamp}
              />
            )}
            </div>
          </div>
        </>
      )}

      {detailCamp ? (
        <CampDetail
          camp={detailCamp}
          onClose={() => setDetailCamp(null)}
          inShortlist={shortlistSet.has(detailCamp.catalogId)}
          onToggleShortlist={toggleShortlist}
        />
      ) : null}

      <footer className="app-footer no-print">
        <span>
          {APP_VERSION}
          {SHOW_HASH ? ` (${GIT_HASH})` : ""}
        </span>
        {DATA_DATE ? <span>· camp data imported {DATA_DATE}</span> : null}
      </footer>
    </div>
  );
}
