import { useEffect } from "react";
import { timeLabel } from "../lib/calendar";
import type { Camp } from "../lib/types";

function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtAges(camp: Camp): string {
  const f = (n: number | null) => (n == null ? "?" : Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (camp.ageMin == null && camp.ageMax == null) return "—";
  if (camp.ageMin != null && camp.ageMax == null) return `${f(camp.ageMin)}+ yrs`;
  if (camp.ageMin === camp.ageMax) return `${f(camp.ageMin)} yrs`;
  return `${f(camp.ageMin)}–${f(camp.ageMax)} yrs`;
}

interface Props {
  camp: Camp;
  onClose: () => void;
  inShortlist: boolean;
  onToggleShortlist: (id: string) => void;
}

export function CampDetail({ camp, onClose, inShortlist, onToggleShortlist }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dates =
    camp.endDate && camp.endDate !== camp.startDate
      ? `${fmtDate(camp.startDate)} – ${fmtDate(camp.endDate)}`
      : fmtDate(camp.startDate);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{camp.title}</h2>
        <dl className="modal-grid">
          <dt>Catalog&nbsp;ID</dt>
          <dd>
            <code>{camp.catalogId}</code>
          </dd>
          <dt>Category</dt>
          <dd>{camp.category}</dd>
          <dt>Location</dt>
          <dd>
            {camp.isVirtual ? "Virtual" : camp.venue}
            {!camp.isVirtual && camp.community ? `, ${camp.community}` : ""}
          </dd>
          <dt>Dates</dt>
          <dd>
            {dates}
            {camp.weekLabel ? ` · ${camp.weekLabel}` : ""}
          </dd>
          <dt>Time</dt>
          <dd>{timeLabel(camp) || "—"}</dd>
          {camp.meetingDays?.length ? (
            <>
              <dt>Days</dt>
              <dd>{camp.meetingDays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ")}</dd>
            </>
          ) : null}
          <dt>Ages</dt>
          <dd>{fmtAges(camp)}</dd>
          <dt>Fee</dt>
          <dd>{camp.fee == null ? "See registration details" : `$${camp.fee}`}</dd>
          {camp.driveMinutes != null ? (
            <>
              <dt>Drive</dt>
              <dd>~{camp.driveMinutes} min</dd>
            </>
          ) : null}
          {camp.seatsAvailable != null ? (
            <>
              <dt>Seats</dt>
              <dd>{camp.seatsAvailable}</dd>
            </>
          ) : null}
          {camp.status ? (
            <>
              <dt>Status</dt>
              <dd>{camp.status}</dd>
            </>
          ) : null}
        </dl>
        {camp.description ? <p>{camp.description}</p> : null}
        <div className="modal-actions">
          <button
            className={`shortlist-btn ${inShortlist ? "on" : ""}`}
            onClick={() => onToggleShortlist(camp.catalogId)}
          >
            {inShortlist ? "★ Remove from shortlist" : "☆ Add to shortlist"}
          </button>
          {camp.detailUrl ? (
            <a className="shortlist-btn" href={camp.detailUrl} target="_blank" rel="noreferrer">
              Registration details
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
