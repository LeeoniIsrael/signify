import { defineConfig, devices } from "@playwright/test";
const preview = !!process.env.PLAYWRIGHT_PREVIEW;
const baseURL = preview ? "http://localhost:4173" : "http://localhost:5173";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL,
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: preview ? "npm run preview" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
