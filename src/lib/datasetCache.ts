import { safeGet, safeRemove } from "./storage";

/**
 * Cache the uploaded camp spreadsheet (raw bytes) in localStorage so it can be
 * restored on the next visit, and track how old it is for a staleness reminder.
 * The file is small (~250 KB); we store it base64-encoded.
 */
const K_DATA = "camp_xlsx_b64";
const K_NAME = "camp_xlsx_name";
const K_AT = "camp_xlsx_at";

export const STALE_DAYS = 30;
const DAY_MS = 86_400_000;

export function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000; // avoid arg-count limits on fromCharCode
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

export function daysSince(savedAt: number, now: number): number {
  return Math.floor((now - savedAt) / DAY_MS);
}

export function isStale(savedAt: number, now: number, maxDays: number = STALE_DAYS): boolean {
  return daysSince(savedAt, now) >= maxDays;
}

export interface CachedDataset {
  bytes: ArrayBuffer;
  fileName: string;
  savedAt: number;
}

/** Returns the saved-at timestamp, or null if caching failed (e.g. over quota). */
export function saveDataset(buf: ArrayBuffer, fileName: string): number | null {
  const ls = globalThis.localStorage;
  if (!ls) return null;
  const savedAt = Date.now();
  try {
    ls.setItem(K_DATA, bytesToBase64(buf));
    ls.setItem(K_NAME, fileName);
    ls.setItem(K_AT, String(savedAt));
    return savedAt;
  } catch {
    clearDataset(); // don't leave a half-written/truncated file
    return null;
  }
}

export function loadDataset(): CachedDataset | null {
  const b64 = safeGet(K_DATA);
  if (!b64) return null;
  try {
    return {
      bytes: base64ToBytes(b64),
      fileName: safeGet(K_NAME) || "cached spreadsheet",
      savedAt: Number(safeGet(K_AT)) || 0,
    };
  } catch {
    return null;
  }
}

export function clearDataset(): void {
  safeRemove(K_DATA);
  safeRemove(K_NAME);
  safeRemove(K_AT);
}
