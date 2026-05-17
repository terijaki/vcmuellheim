import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.WEBAPP_URL ?? "http://localhost:3080";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: "test-results",
  reporter: process.env.GITHUB_ACTIONS ? [["github"], ["list"]] : undefined,
  use: { baseURL },
  webServer: !process.env.WEBAPP_URL
    ? {
        command: "vp dev",
        url: baseURL,
        reuseExistingServer: true,
      }
    : undefined,
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
