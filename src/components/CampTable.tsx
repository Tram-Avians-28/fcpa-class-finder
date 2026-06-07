import { timeLabel } from "../lib/calendar";
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
}

export function CampTable({ camps, shortlist, onToggleShortlist, showDrive = false }: Props) {
  return (
    <div className="table-wrap">
    <table className="camps">
      <thead>
        <tr>
          <th className="no-print" aria-label="shortlist"></th>
          <th>Camp</th>
          <th>Catalog ID</th>
          <th>Category</th>
          <th>Location</th>
          <th>Dates</th>
          <th>Time</th>
          <th>Ages</th>
          <th>Fee</th>
          {showDrive ? <th>Drive</th> : null}
        </tr>
      </thead>
      <tbody>
        {camps.map((c, i) => {
          const picked = shortlist.has(c.catalogId);
          return (
            <tr key={`${c.catalogId}-${i}`}>
              <td className="no-print">
                <button
                  className={`star ${picked ? "on" : ""}`}
                  title={picked ? "Remove from shortlist" : "Add to shortlist"}
                  aria-label={picked ? "Remove from shortlist" : "Add to shortlist"}
                  aria-pressed={picked}
                  onClick={() => onToggleShortlist(c.catalogId)}
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
  );
}
