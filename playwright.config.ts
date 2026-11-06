import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "test",
  testMatch: "ui.spec.ts",
  use: { baseURL: "http://127.0.0.1:5179", headless: true },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --config test/vite.config.ts --host 127.0.0.1 --port 5179",
    url: "http://127.0.0.1:5179/test/fixture.html",
    reuseExistingServer: false,
  },
  workers: 1,
});
