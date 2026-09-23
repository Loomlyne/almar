import { defineConfig } from "@playwright/test";

const port = 3010;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests",
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  use: {
    baseURL,
  },
  webServer: {
    command: `npm run dev -- -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
