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
import { MapPanel } from "./components/MapPanel";
import { ShortlistView } from "./components/ShortlistView";
import { clearDataset, daysSince, isStale, loadDataset, saveDataset } from "./lib/datasetCache";
import { safeGet, safeSet } from "./lib/storage";
import type { Camp, FilterCriteria, Gazetteer, GeocodeResult } from "./lib/types";

const gazetteer = gazetteerData as Gazetteer;
const DEFAULT_DATASET_URL = `${import.meta.env.BASE_URL}fcpa-camp-spreadsheet.xlsx`;
type Tab = "calendar" | "list" | "shortlist";

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Default filters: show from today through the last day in the dataset. */
function defaultCriteria(camps: Camp[]): FilterCriteria {
  const ends = camps.map((c) => c.endDate).filter(Boolean);
  if (ends.length === 0) return { includeVirtual: true };
  const maxEnd = ends.reduce((m, d) => (d > m ? d : m));
  const minStart = camps.map((c) => c.startDate).filter(Boolean).reduce((m, d) => (d < m ? d : m), maxEnd);
  const today = todayISO();
  return { includeVirtual: true, startDate: today <= maxEnd ? today : minStart, endDate: maxEnd };
}

export default function App() {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [criteria, setCriteria] = useState<FilterCriteria>({ includeVirtual: true });
  const [tab, setTab] = useState<Tab>("calendar");
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile drawer
  const fileRef = useRef<HTMLInputElement>(null);

  // Dataset provenance: when the cached upload was saved, whether we're on the
  // bundled (CI-refreshed) default, and whether the stale reminder was dismissed.
  const [dataSavedAt, setDataSavedAt] = useState<number | null>(null);
  const [usingBundled, setUsingBundled] = useState(false);
  const [staleDismissed, setStaleDismissed] = useState(false);

  // Drive-time state
  // Saved key wins; otherwise fall back to a local-dev key from .env.local
  // (VITE_ORS_KEY). That file is gitignored and not present in CI, so the
  // deployed build never embeds a key.
  const [orsKey, setOrsKey] = useState(() => safeGet("ors_key") || (import.meta.env.VITE_ORS_KEY ?? ""));
  const [address, setAddress] = useState(() => safeGet("home_address"));
  const [home, setHome] = useState<GeocodeResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [driveError, setDriveError] = useState("");

  // Shortlist of catalog IDs, persisted across reloads.
  const [shortlist, setShortlist] = useState<string[]>(() => {
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
    setCriteria(defaultCriteria(parsed));
    setSelectedVenue(null);
    setHome(null);
    setError("");
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

  const filtered = useMemo(() => filterCamps(camps, criteria), [camps, criteria]);
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
        <h1>FFX Camps</h1>
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
        <button className="upload-btn" onClick={() => fileRef.current?.click()}>
          {camps.length > 0 ? "Upload a different spreadsheet" : "Upload FCPA camp spreadsheet"}
        </button>
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
                  onSelectVenue={setSelectedVenue}
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
              />
            )}
            {tab === "shortlist" && (
              <ShortlistView camps={shortlistCamps} home={home} onToggleShortlist={toggleShortlist} />
            )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
