import { type ReactNode, useMemo, useState } from "react";
import { timeLabel } from "../lib/calendar";
import { applyListFilters, type ListFilter, type SortDir, type SortKey, sortCamps } from "../lib/listFilter";
import type { Camp } from "../lib/types";

function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtAge(camp: Camp): string {
  const f = (n: number | null) => (n == null ? "?" : Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (camp.ageMin == null && camp.ageMax == null) return "—";
  return `${f(camp.ageMin)}–${f(camp.ageMax)}`;
}

interface Props {
  camps: Camp[];
  shortlist: Set<string>;
  onToggleShortlist: (id: string) => void;
  showDrive?: boolean;
  /** Enable Excel-style per-column filters + sortable headers (List tab only). */
  filterable?: boolean;
  /** When set, clicking a row opens the camp detail card. */
  onSelectCamp?: (camp: Camp) => void;
}

export function CampTable({
  camps,
  shortlist,
  onToggleShortlist,
  showDrive = false,
  filterable = false,
  onSelectCamp,
}: Props) {
  const [lf, setLf] = useState<ListFilter>({});
  const [sort, setSort] = useState<{ key: SortKey | null; dir: SortDir }>({ key: null, dir: "asc" });

  const categories = useMemo(() => Array.from(new Set(camps.map((c) => c.category))).sort(), [camps]);
  const rows = filterable ? sortCamps(applyListFilters(camps, lf), sort.key, sort.dir) : camps;
  const filtersActive = Object.values(lf).some((v) => v !== undefined && v !== "") || sort.key != null;

  const toggleSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));
  const ind = (k: SortKey) => (sort.key === k ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  const tIn = (k: keyof ListFilter, ph: string) => (
    <input
      className="col-filter"
      type="text"
      placeholder={ph}
      value={(lf[k] as string) ?? ""}
      onChange={(e) => setLf((p) => ({ ...p, [k]: e.target.value || undefined }))}
    />
  );
  const nIn = (k: keyof ListFilter, ph: string) => (
    <input
      className="col-filter"
      type="number"
      placeholder={ph}
      value={(lf[k] as number) ?? ""}
      onChange={(e) => setLf((p) => ({ ...p, [k]: e.target.value === "" ? undefined : Number(e.target.value) }))}
    />
  );

  // Render-function (not a component) so the filter inputs keep focus across renders.
  const th = (label: string, sortKey?: SortKey, filter?: ReactNode) => (
    <th key={label}>
      {filterable && sortKey ? (
        <button type="button" className="th-sort" onClick={() => toggleSort(sortKey)}>
          {label}
          {ind(sortKey)}
        </button>
      ) : (
        <span>{label}</span>
      )}
      {filterable && filter ? <div className="th-filter">{filter}</div> : null}
    </th>
  );

  const catSelect = (
    <select
      className="col-filter"
      value={lf.category ?? ""}
      onChange={(e) => setLf((p) => ({ ...p, category: e.target.value || undefined }))}
    >
      <option value="">All</option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );

  return (
    <>
      {filterable ? (
        <div className="list-toolbar no-print">
          {rows.length} of {camps.length}
          {filtersActive ? (
            <button
              className="clear-link"
              onClick={() => {
                setLf({});
                setSort({ key: null, dir: "asc" });
              }}
            >
              clear table filters
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="table-wrap">
        <table className="camps">
          <thead>
            <tr>
              <th className="no-print" aria-label="shortlist"></th>
              {th("Camp", "title", tIn("title", "filter"))}
              {th("Catalog ID", "catalogId", tIn("catalogId", "filter"))}
              {th("Category", "category", catSelect)}
              {th("Location", "venue", tIn("venue", "filter"))}
              {th("Dates", "startDate")}
              {th("Time", "startTime", tIn("time", "e.g. 9:00 AM"))}
              {th("Ages", "ageMin", nIn("childAge", "age"))}
              {th("Fee", "fee", nIn("maxFee", "≤ $"))}
              {showDrive ? th("Drive", "driveMinutes", nIn("maxDrive", "≤ min")) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const picked = shortlist.has(c.catalogId);
              return (
                <tr
                  key={`${c.catalogId}-${i}`}
                  className={onSelectCamp ? "row-click" : undefined}
                  onClick={onSelectCamp ? () => onSelectCamp(c) : undefined}
                >
                  <td className="no-print">
                    <button
                      className={`star ${picked ? "on" : ""}`}
                      title={picked ? "Remove from shortlist" : "Add to shortlist"}
                      aria-label={picked ? "Remove from shortlist" : "Add to shortlist"}
                      aria-pressed={picked}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleShortlist(c.catalogId);
                      }}
                    >
                      {picked ? "★" : "☆"}
                    </button>
                  </td>
                  <td>{c.title}</td>
                  <td>
                    <code>{c.catalogId}</code>
                  </td>
                  <td>{c.category}</td>
                  <td>
                    {c.isVirtual ? "Virtual" : c.venue}
                    {!c.isVirtual && c.community ? (
                      <div style={{ color: "#5b6573" }}>{c.community}</div>
                    ) : null}
                  </td>
                  <td>
                    {fmtDate(c.startDate)}
                    {c.endDate && c.endDate !== c.startDate ? `–${fmtDate(c.endDate)}` : ""}
                  </td>
                  <td>{timeLabel(c) || "—"}</td>
                  <td>{fmtAge(c)}</td>
                  <td>${c.fee}</td>
                  {showDrive ? <td>{c.driveMinutes != null ? `~${c.driveMinutes} min` : "—"}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
