/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function git(cmd: string, fallback: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const GIT_HASH = git("git rev-parse --short HEAD", "dev");
// Commit date of the bundled spreadsheet = when the camp data was last imported.
const DATA_DATE = git("git log -1 --format=%cI -- public/fcpa-camp-spreadsheet.xlsx", "");

export default defineConfig({
  // Relative base so the built site works under any GitHub Pages subpath
  // (e.g. https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(GIT_HASH),
    __DATA_DATE__: JSON.stringify(DATA_DATE),
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // App integration tests render ~2k table rows in jsdom; CI runners are slow.
    testTimeout: 20000,
  },
});
