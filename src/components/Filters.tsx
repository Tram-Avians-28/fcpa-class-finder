import { useState } from "react";
import type { FilterCriteria } from "../lib/types";

interface Props {
  criteria: FilterCriteria;
  onChange: (patch: Partial<FilterCriteria>) => void;
  onReset: () => void;
  categories: string[];
  weekLabels: string[];
  venues: string[];
  feeBounds: { min: number; max: number };
}

function toggle(list: string[] | undefined, value: string): string[] {
  const set = new Set(list ?? []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}

export function Filters({ criteria, onChange, onReset, categories, weekLabels, venues, feeBounds }: Props) {
  const [venueSearch, setVenueSearch] = useState("");
  const shownVenues = venueSearch.trim()
    ? venues.filter((v) => v.toLowerCase().includes(venueSearch.trim().toLowerCase()))
    : venues;
  const selectedVenues = criteria.venues ?? [];
  return (
    <>
      <h2>Dates</h2>
      <div className="field">
        <label>From</label>
        <input
          type="date"
          value={criteria.startDate ?? ""}
          onChange={(e) => onChange({ startDate: e.target.value || undefined })}
        />
      </div>
      <div className="field">
        <label>To</label>
        <input
          type="date"
          value={criteria.endDate ?? ""}
          onChange={(e) => onChange({ endDate: e.target.value || undefined })}
        />
      </div>

      <h2>Cost &amp; age</h2>
      <div className="field">
        <label>Max fee ($){criteria.maxFee != null ? `: ${criteria.maxFee}` : ""}</label>
        <input
          type="number"
          min={feeBounds.min}
          max={feeBounds.max}
          placeholder={`up to ${feeBounds.max}`}
          value={criteria.maxFee ?? ""}
          onChange={(e) =>
            onChange({ maxFee: e.target.value === "" ? undefined : Number(e.target.value) })
          }
        />
      </div>
      <div className="field">
        <label>Child age (years)</label>
        <input
          type="number"
          min={0}
          max={18}
          placeholder="any"
          value={criteria.childAge ?? ""}
          onChange={(e) =>
            onChange({ childAge: e.target.value === "" ? undefined : Number(e.target.value) })
          }
        />
      </div>

      <h2>Category</h2>
      <div className="checklist">
        {categories.map((cat) => (
          <label key={cat}>
            <input
              type="checkbox"
              checked={(criteria.categories ?? []).includes(cat)}
              onChange={() => onChange({ categories: toggle(criteria.categories, cat) })}
            />
            {cat}
          </label>
        ))}
      </div>

      <h2>Week</h2>
      <div className="checklist">
        {weekLabels.map((wk) => (
          <label key={wk}>
            <input
              type="checkbox"
              checked={(criteria.weekLabels ?? []).includes(wk)}
              onChange={() => onChange({ weekLabels: toggle(criteria.weekLabels, wk) })}
            />
            {wk}
          </label>
        ))}
      </div>

      <h2>
        Location
        {selectedVenues.length ? <span className="count-pill">{selectedVenues.length}</span> : null}
      </h2>
      <input
        type="text"
        className="venue-search"
        placeholder="search locations…"
        value={venueSearch}
        onChange={(e) => setVenueSearch(e.target.value)}
      />
      <div className="checklist">
        {shownVenues.map((v) => (
          <label key={v}>
            <input
              type="checkbox"
              checked={selectedVenues.includes(v)}
              onChange={() => onChange({ venues: toggle(criteria.venues, v) })}
            />
            {v}
          </label>
        ))}
        {shownVenues.length === 0 ? <div className="hint">no matching locations</div> : null}
      </div>

      <h2>Other</h2>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={criteria.includeVirtual ?? true}
            onChange={(e) => onChange({ includeVirtual: e.target.checked })}
          />{" "}
          Include virtual camps
        </label>
      </div>

      <button className="tab" style={{ marginTop: 12 }} onClick={onReset}>
        Reset filters
      </button>
    </>
  );
}
