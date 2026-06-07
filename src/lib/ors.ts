import type { GeocodeResult, LatLng } from "./types";

/**
 * Minimal OpenRouteService client. Runs entirely client-side; the API key is
 * supplied by the user and never leaves their browser except in calls to ORS.
 */
const BASE = "https://api.openrouteservice.org";

// Bias geocoding toward Fairfax County.
const FOCUS = { lon: -77.27, lat: 38.85 };

/** Fetch from ORS, turning HTTP/network failures into clear, user-facing messages. */
async function orsFetch(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Couldn't reach OpenRouteService — check your internet connection.");
  }
  if (res.ok) return res;
  if (res.status === 401 || res.status === 403) {
    throw new Error("Your OpenRouteService API key looks invalid or unauthorized. Double-check it and try again.");
  }
  if (res.status === 429) {
    throw new Error("OpenRouteService rate limit reached — wait a minute and try again.");
  }
  throw new Error(`OpenRouteService request failed (HTTP ${res.status}).`);
}

export async function geocodeAddress(apiKey: string, text: string): Promise<GeocodeResult> {
  if (!apiKey.trim()) throw new Error("Enter your OpenRouteService API key first.");
  const params = new URLSearchParams({
    api_key: apiKey,
    text,
    "boundary.country": "US",
    "focus.point.lon": String(FOCUS.lon),
    "focus.point.lat": String(FOCUS.lat),
    size: "1",
  });
  const res = await orsFetch(`${BASE}/geocode/search?${params.toString()}`);
  const data = await res.json();
  const feature = data?.features?.[0];
  if (!feature) throw new Error(`No location found for "${text}". Try a more specific address.`);
  const [lng, lat] = feature.geometry.coordinates as [number, number];
  return { lat, lng, label: feature.properties?.label ?? text };
}

/** Max destinations per matrix request (kept well under ORS limits). */
export const MATRIX_CHUNK = 80;

/**
 * Drive time in minutes from one origin to each destination, in order.
 * null entries mean ORS could not route to that destination.
 */
export async function driveMatrixMinutes(
  apiKey: string,
  origin: LatLng,
  destinations: LatLng[],
): Promise<(number | null)[]> {
  const out: (number | null)[] = [];
  for (let i = 0; i < destinations.length; i += MATRIX_CHUNK) {
    const chunk = destinations.slice(i, i + MATRIX_CHUNK);
    const locations = [
      [origin.lng, origin.lat],
      ...chunk.map((d) => [d.lng, d.lat]),
    ];
    const body = {
      locations,
      sources: [0],
      destinations: chunk.map((_, k) => k + 1),
      metrics: ["duration"],
    };
    const res = await orsFetch(`${BASE}/v2/matrix/driving-car`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const row: (number | null)[] = data?.durations?.[0] ?? [];
    for (let k = 0; k < chunk.length; k++) {
      const seconds = row[k];
      out.push(seconds == null ? null : Math.round(seconds / 60));
    }
  }
  return out;
}
