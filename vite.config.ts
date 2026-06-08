/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the built site works under any GitHub Pages subpath
  // (e.g. https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: "./",
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
