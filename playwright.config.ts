import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  use: {
    baseURL: "http://localhost:8093",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command:
      "EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run export:web -- --output-dir .test-web && python3 -m http.server 8093 --directory .test-web",
    url: "http://localhost:8093",
    reuseExistingServer: true,
    timeout: 120000,
  },
  reporter: "list",
});
