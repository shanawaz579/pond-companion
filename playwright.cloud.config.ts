import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/cloud-ui",
  use: {
    baseURL: "http://localhost:8092",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 390, height: 844 },
  },
  reporter: "list",
  webServer: {
    command: "npm run web -- --port 8092",
    url: "http://localhost:8092",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
