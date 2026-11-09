import { useState } from "react";
import { parseAges } from "../lib/ages";
import type { FilterCriteria } from "../lib/types";

interface Props {
  criteria: FilterCriteria;
  onChange: (patch: Partial<FilterCriteria>) => void;
  onReset: () => void;
  categories: string[];
  weekLabels: string[];
  venues: string[];
  feeBounds: { min: number; max: number; known: number; total: number };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toggle<T>(list: T[] | undefined, value: T): T[] {
  const set = new Set(list ?? []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}

export function Filters({ criteria, onChange, onReset, categories, weekLabels, venues, feeBounds }: Props) {
  const [venueSearch, setVenueSearch] = useState("");
  const selectedVenues = criteria.venues ?? [];
  const search = venueSearch.trim().toLowerCase();
  const shownVenues = venues.filter(
    (v) => !search || v.toLowerCase().includes(search),
  );
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

      <h2>
        Days of week
        {criteria.weekdays?.length ? <span className="count-pill">{criteria.weekdays.length}</span> : null}
      </h2>
      <div className="weekday-picker">
        {WEEKDAYS.map((day, index) => (
          <label key={day}>
            <input
              type="checkbox"
              checked={(criteria.weekdays ?? []).includes(index)}
              onChange={() => onChange({ weekdays: toggle(criteria.weekdays, index) })}
            />
            {day}
          </label>
        ))}
      </div>
      <div className="hint">Matches any checked day; leave all unchecked to show every day.</div>

      <h2>{feeBounds.known ? "Cost & age" : "Age"}</h2>
      {feeBounds.known ? (
        <div className="field">
          <label>
            Max fee ($){criteria.maxFee != null ? `: ${criteria.maxFee}` : ""}
            {feeBounds.known < feeBounds.total ? " · excludes unknown fees" : ""}
          </label>
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
      ) : null}
      <div className="field">
        <label>Child age(s)</label>
        <input
          type="text"
          placeholder="any — e.g. 7, 9 or 6-10"
          value={criteria.ageText ?? ""}
          onChange={(e) => onChange({ ageText: e.target.value || undefined })}
        />
        {criteria.ageText ? (
          <div className="hint">
            matching ages: {parseAges(criteria.ageText).join(", ") || "—"}
          </div>
        ) : null}
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

      {weekLabels.length ? (
        <>
          <h2>Camp week</h2>
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
        </>
      ) : null}

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
          Include virtual activities
        </label>
      </div>

      <button className="tab" style={{ marginTop: 12 }} onClick={onReset}>
        Reset filters
      </button>
    </>
  );
}
