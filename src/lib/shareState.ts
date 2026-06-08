import type { FilterCriteria } from "./types";

/**
 * Encodes the explorable view (filters, active tab, selected venue, shortlist)
 * into a URL hash so a link reproduces what someone sees. Deliberately excludes
 * the home address (PII) — recipients use their own address for drive times.
 */
export interface SharedView {
  c: FilterCriteria;
  t: string; // active tab
  sv: string | null; // selected venue
  sl: string[]; // shortlist catalog IDs
}

function b64encode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}
function b64decode(s: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0)));
}

export function encodeView(v: SharedView): string {
  return b64encode(JSON.stringify(v));
}

export function decodeView(s: string): SharedView | null {
  try {
    const o = JSON.parse(b64decode(s));
    if (!o || typeof o !== "object" || typeof o.c !== "object") return null;
    return { c: o.c, t: typeof o.t === "string" ? o.t : "calendar", sv: o.sv ?? null, sl: Array.isArray(o.sl) ? o.sl : [] };
  } catch {
    return null;
  }
}

/** Read a shared view from the current location hash (#share=...), if present. */
export function readSharedFromHash(): SharedView | null {
  if (typeof location === "undefined") return null;
  const m = location.hash.match(/[#&]share=([^&]+)/);
  return m ? decodeView(decodeURIComponent(m[1])) : null;
}

/** Build a full shareable URL for the given view. */
export function shareUrl(v: SharedView): string {
  const base = location.origin + location.pathname;
  return `${base}#share=${encodeURIComponent(encodeView(v))}`;
}
