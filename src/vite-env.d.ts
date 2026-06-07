/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional local-dev ORS key from .env.local (never set in CI). */
  readonly VITE_ORS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
