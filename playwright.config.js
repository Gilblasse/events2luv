import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://localhost:4400",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/qa-server.mjs",
    url: "http://localhost:4400/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
