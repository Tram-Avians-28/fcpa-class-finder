import type { GeocodeResult } from "../lib/types";

interface Props {
  orsKey: string;
  onOrsKey: (v: string) => void;
  address: string;
  onAddress: (v: string) => void;
  onCompute: () => void;
  computing: boolean;
  home: GeocodeResult | null;
  driveError: string;
  maxDriveMinutes: number | undefined;
  onMaxDrive: (v: number | undefined) => void;
  onForgetKey: () => void;
}

export function DrivePanel({
  orsKey,
  onOrsKey,
  address,
  onAddress,
  onCompute,
  computing,
  home,
  driveError,
  maxDriveMinutes,
  onMaxDrive,
  onForgetKey,
}: Props) {
  const canCompute = orsKey.trim() !== "" && address.trim() !== "" && !computing;
  const keySaved = orsKey.trim() !== "";
  return (
    <div className="drive-panel">
      <h2>Drive time</h2>
      <div className="field">
        <label>
          OpenRouteService API key{" "}
          <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noreferrer">
            (free)
          </a>
        </label>
        <input
          type="password"
          placeholder="paste your ORS key"
          value={orsKey}
          onChange={(e) => onOrsKey(e.target.value)}
          autoComplete="off"
        />
        {keySaved ? (
          <div className="key-saved">
            ✓ Saved in this browser
            <button className="clear-link" onClick={onForgetKey}>
              forget
            </button>
          </div>
        ) : null}
      </div>
      <div className="field">
        <label>Home address</label>
        <input
          type="text"
          placeholder="123 Main St, Vienna, VA"
          value={address}
          onChange={(e) => onAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCompute) onCompute();
          }}
        />
      </div>
      <button className="tab compute-btn" disabled={!canCompute} onClick={onCompute}>
        {computing ? "Calculating…" : "Calculate drive times"}
      </button>
      {driveError ? (
        <div className="error drive-error" role="alert">
          {driveError}
        </div>
      ) : null}
      {home ? <div className="home-label">📍 {home.label}</div> : null}

      <div className="field" style={{ marginTop: 10 }}>
        <label>
          Max drive time (min){maxDriveMinutes != null ? `: ${maxDriveMinutes}` : ""}
        </label>
        <input
          type="number"
          min={5}
          max={120}
          step={5}
          placeholder={home ? "any" : "calculate first"}
          disabled={!home}
          value={maxDriveMinutes ?? ""}
          onChange={(e) => onMaxDrive(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </div>
    </div>
  );
}
