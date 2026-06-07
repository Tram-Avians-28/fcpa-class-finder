import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Camp, GeocodeResult } from "../lib/types";
import type { VenueStyle } from "../lib/venueStyle";

interface VenueGroup {
  venue: string;
  lat: number;
  lng: number;
  count: number;
  minutes: number | null;
}

function groupByVenue(camps: Camp[]): VenueGroup[] {
  const m = new Map<string, VenueGroup>();
  for (const c of camps) {
    if (c.isVirtual || c.lat == null || c.lng == null) continue;
    const g = m.get(c.venue);
    if (g) g.count += 1;
    else m.set(c.venue, { venue: c.venue, lat: c.lat, lng: c.lng, count: 1, minutes: c.driveMinutes ?? null });
  }
  return [...m.values()];
}

function pinIcon(style: VenueStyle | undefined, selected: boolean): L.DivIcon {
  const color = style?.color ?? "#9aa3ad";
  const pattern = style?.pattern ?? "solid";
  const size = selected ? 28 : 20;
  return L.divIcon({
    className: "pin-wrap",
    html: `<div class="pin pat-${pattern}${selected ? " sel" : ""}" style="background-color:${color};width:${size}px;height:${size}px"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Fit the map to the markers whenever they change. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points).pad(0.2), { animate: false });
  }, [points, map]);
  return null;
}

interface LegendProps {
  groups: VenueGroup[];
  venueStyles: Map<string, VenueStyle>;
  selectedVenue: string | null;
  onSelectVenue: (venue: string | null) => void;
}

function VenueLegend({ groups, venueStyles, selectedVenue, onSelectVenue }: LegendProps) {
  if (groups.length === 0) return null;
  const sorted = [...groups].sort(
    (a, b) => (venueStyles.get(a.venue)?.index ?? 0) - (venueStyles.get(b.venue)?.index ?? 0),
  );
  return (
    <div className="legend">
      {sorted.map((g) => {
        const st = venueStyles.get(g.venue);
        const selected = g.venue === selectedVenue;
        return (
          <button
            key={g.venue}
            className={`legend-item ${selected ? "sel" : ""}`}
            title={g.venue}
            onClick={() => onSelectVenue(selected ? null : g.venue)}
          >
            <span className={`swatch pat-${st?.pattern ?? "solid"}`} style={{ backgroundColor: st?.color ?? "#9aa3ad" }} />
            <span className="legend-name">{g.venue}</span>
            {g.minutes != null ? <span className="legend-min">~{g.minutes}m</span> : null}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  camps: Camp[];
  home: GeocodeResult | null;
  selectedVenue: string | null;
  onSelectVenue: (venue: string | null) => void;
  venueStyles: Map<string, VenueStyle>;
}

export function MapPanel({ camps, home, selectedVenue, onSelectVenue, venueStyles }: Props) {
  const groups = useMemo(() => groupByVenue(camps), [camps]);
  const points = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = groups.map((g) => [g.lat, g.lng]);
    if (home) pts.push([home.lat, home.lng]);
    return pts;
  }, [groups, home]);

  return (
    <div>
      <div className="map-wrap">
        <MapContainer center={[38.85, -77.27]} zoom={10} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />

          {home ? (
            <CircleMarker
              center={[home.lat, home.lng]}
              radius={9}
              pathOptions={{ color: "#1c2128", weight: 3, fillColor: "#ffffff", fillOpacity: 1 }}
            >
              <Tooltip permanent direction="top">Home</Tooltip>
            </CircleMarker>
          ) : null}

          {groups.map((g) => {
            const selected = g.venue === selectedVenue;
            return (
              <Marker
                key={g.venue}
                position={[g.lat, g.lng]}
                icon={pinIcon(venueStyles.get(g.venue), selected)}
                eventHandlers={{ click: () => onSelectVenue(selected ? null : g.venue) }}
              >
                <Popup>
                  <strong>{g.venue}</strong>
                  <br />
                  {g.count} camp{g.count === 1 ? "" : "s"}
                  {g.minutes != null ? (
                    <>
                      <br />~{g.minutes} min drive
                    </>
                  ) : null}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
      <VenueLegend
        groups={groups}
        venueStyles={venueStyles}
        selectedVenue={selectedVenue}
        onSelectVenue={onSelectVenue}
      />
    </div>
  );
}
