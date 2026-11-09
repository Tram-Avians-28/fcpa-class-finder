import { useEffect, useState } from "react";
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
  const [searchText, setSearchText] = useState(criteria.searchText ?? "");
  useEffect(() => setSearchText(criteria.searchText ?? ""), [criteria.searchText]);
  const selectedCategories = criteria.categories ?? categories;
  const allCategoriesSelected = categories.every((cat) => selectedCategories.includes(cat));
  const [venueSearch, setVenueSearch] = useState("");
  const selectedVenues = criteria.venues ?? [];
  const search = venueSearch.trim().toLowerCase();
  const shownVenues = venues.filter(
    (v) => !search || v.toLowerCase().includes(search),
  );
  return (
    <>
      <h2>Search activities</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onChange({ searchText: searchText.trim() || undefined });
        }}
      >
        <div className="field">
          <label htmlFor="activity-search">Title or description</label>
          <input
            id="activity-search"
            type="search"
            placeholder={'e.g. "water exercise" -advanced'}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-describedby="activity-search-hint"
          />
        </div>
        <div className="filter-actions">
          <button className="tab" type="submit">Search</button>
          {searchText || criteria.searchText ? (
            <button
              className="clear-link"
              type="button"
              onClick={() => {
                setSearchText("");
                onChange({ searchText: undefined });
              }}
            >
              Clear search
            </button>
          ) : null}
        </div>
        <div className="hint" id="activity-search-hint">
          Matches any word or quoted phrase in the title or description, ignoring case.
          Use -word or -"exact phrase" to exclude matches. Press Enter or Search to apply.
        </div>
      </form>

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
      <button
        className="clear-link category-toggle"
        type="button"
        disabled={categories.length === 0}
        onClick={() => onChange({ categories: allCategoriesSelected ? [] : undefined })}
      >
        {allCategoriesSelected ? "Uncheck all categories" : "Check all categories"}
      </button>
      <div className="checklist" role="group" aria-label="Categories">
        {categories.map((cat) => (
          <label key={cat}>
            <input
              type="checkbox"
              checked={selectedCategories.includes(cat)}
              onChange={() => onChange({ categories: toggle(selectedCategories, cat) })}
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
            checked={criteria.includeVirtual ?? false}
            onChange={(e) => onChange({ includeVirtual: e.target.checked })}
          />{" "}
          Include virtual activities
        </label>
      </div>

      <button
        className="tab"
        style={{ marginTop: 12 }}
        onClick={() => {
          setSearchText("");
          onReset();
        }}
      >
        Reset filters
      </button>
    </>
  );
}
