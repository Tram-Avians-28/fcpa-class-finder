import type { Camp, GeocodeResult } from "../lib/types";
import { CampTable } from "./CampTable";

interface Props {
  camps: Camp[];
  home: GeocodeResult | null;
  onToggleShortlist: (id: string) => void;
  onSelectCamp?: (camp: Camp) => void;
}

export function ShortlistView({ camps, home, onToggleShortlist, onSelectCamp }: Props) {
  if (camps.length === 0) {
    return (
      <div className="empty">
        <div className="card">
          <h2>Your shortlist is empty</h2>
          <p>
            Add camps with the ★ button in the List view, then come back here to print a clean sheet
            of catalog/registration codes to register with.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="shortlist printable">
      <div className="shortlist-head">
        <div>
          <h2>My FCPA Camp Shortlist</h2>
          <div className="hint">
            {camps.length} camp{camps.length === 1 ? "" : "s"}
            {home ? ` · drive times from ${home.label}` : ""}
          </div>
        </div>
        <button className="upload-btn no-print" style={{ background: "var(--accent)" }} onClick={() => window.print()}>
          Print this list
        </button>
      </div>
      <CampTable
        camps={camps}
        shortlist={new Set(camps.map((c) => c.catalogId))}
        onToggleShortlist={onToggleShortlist}
        showDrive={home != null}
        onSelectCamp={onSelectCamp}
      />
    </div>
  );
}
