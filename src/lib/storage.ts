/**
 * localStorage access that can't crash the app: storage may be absent (SSR/tests)
 * or throw (Safari private mode, disabled cookies). All access goes through here.
 */
export function safeGet(key: string): string {
  try {
    return globalThis.localStorage?.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function safeSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* ignore quota / unavailable */
  }
}

export function safeRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
