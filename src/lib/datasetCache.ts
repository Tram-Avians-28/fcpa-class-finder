import { safeGet, safeRemove } from "./storage";

/**
 * Cache an uploaded activity catalog or legacy camp spreadsheet (raw bytes) in
 * IndexedDB so it can be restored on the next visit. The generated catalog is
 * too large for localStorage once base64-encoded.
 */
const DB_NAME = "fcpa-activity-finder";
const DB_VERSION = 1;
const STORE_NAME = "datasets";
const CURRENT_DATASET = "current";

// A short-lived version of the catalog migration used these localStorage keys.
// Read them once so users on browsers with a larger quota retain their upload,
// then remove them after migrating to IndexedDB.
const LEGACY_DATA_KEYS = ["activity_data_v1_b64", "activity_data_v1_name", "activity_data_v1_at"] as const;

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

interface StoredDataset extends CachedDataset {
  id: string;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the dataset cache."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Dataset cache transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Dataset cache transaction was aborted."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Dataset cache request failed."));
  });
}

function clearLegacyDataset(): void {
  for (const key of LEGACY_DATA_KEYS) safeRemove(key);
}

function loadLegacyDataset(): CachedDataset | null {
  const b64 = safeGet(LEGACY_DATA_KEYS[0]);
  if (!b64) return null;
  try {
    return {
      bytes: base64ToBytes(b64),
      fileName: safeGet(LEGACY_DATA_KEYS[1]) || "cached activity data",
      savedAt: Number(safeGet(LEGACY_DATA_KEYS[2])) || 0,
    };
  } catch {
    clearLegacyDataset();
    return null;
  }
}

/** Returns the saved-at timestamp, or null if persistent browser storage is unavailable. */
export async function saveDataset(buf: ArrayBuffer, fileName: string): Promise<number | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) return null;
    const savedAt = Date.now();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).put({
      id: CURRENT_DATASET,
      bytes: buf,
      fileName,
      savedAt,
    } satisfies StoredDataset);
    await done;
    clearLegacyDataset();
    return savedAt;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function loadDataset(): Promise<CachedDataset | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (db) {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const done = transactionDone(transaction);
      const stored = await requestResult(
        transaction.objectStore(STORE_NAME).get(CURRENT_DATASET) as IDBRequest<StoredDataset | undefined>,
      );
      await done;
      if (stored) {
        return { bytes: stored.bytes, fileName: stored.fileName, savedAt: stored.savedAt };
      }
    }
  } catch {
    // A disabled or unavailable IndexedDB cache should not prevent app startup.
  } finally {
    db?.close();
  }

  const legacy = loadLegacyDataset();
  if (!legacy) return null;
  const migratedAt = await saveDataset(legacy.bytes, legacy.fileName);
  if (migratedAt != null) clearLegacyDataset();
  return legacy;
}

export async function clearDataset(): Promise<void> {
  clearLegacyDataset();
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) return;
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).delete(CURRENT_DATASET);
    await done;
  } catch {
    // Storage may be disabled or unavailable; there is nothing else to clear.
  } finally {
    db?.close();
  }
}
