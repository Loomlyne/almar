import { defineConfig } from "@playwright/test";

const port = Number(process.env.PW_PORT ?? 3010);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests",
  // Browser specs only. Without this, Playwright's default pattern also loads tests/*.test.mjs (the node:test files, run
  // with `node --test`) as browser tests: they fail on relative paths and bundling, and a bare `npx playwright test` ran nothing.
  testMatch: /.*\.spec\.ts$/,
  // The build-suite runs against the assembled out/ with playwright.build.config.ts, not against next dev.
  testIgnore: ["build/**"],
  snapshotPathTemplate: "{testDir}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0,
    },
  },
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
    env: { ALMAR_HARNESS: "1" },
  },
});
