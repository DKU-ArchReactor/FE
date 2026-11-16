import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT || 4174);
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  use: {
    baseURL: origin,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${origin}/tests/browser/harness.html`,
    env: {
      VITE_API_URL: origin,
      VITE_S3_BUCKET_URL: origin,
    },
    reuseExistingServer: false,
  },
});
