import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4174",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174/tests/browser/harness.html",
    env: {
      VITE_API_URL: "http://127.0.0.1:4174",
      VITE_S3_BUCKET_URL: "http://127.0.0.1:4174",
    },
    reuseExistingServer: false,
  },
});
