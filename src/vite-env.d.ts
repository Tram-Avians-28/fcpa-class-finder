/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional local-dev ORS key from .env.local (never set in CI). */
  readonly VITE_ORS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected at build time by vite.config.ts `define`.
declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;
declare const __DATA_DATE__: string;
