import { defineConfig } from "@playwright/test";

// Browser tests against the ASSEMBLED out/ folder, served by local `wrangler dev` (workerd, never --remote),
// so the Cloudflare static-assets rules in wrangler.toml apply: html_handling = "auto-trailing-slash" and
// not_found_handling = "404-page". It serves the existing out/ and never builds: run
// `node scripts/assemble-cloudflare.mjs` first. The only build runner (3.3 reconcile R-4); build specs live
// under tests/build/. The default playwright.config.ts (next dev) ignores that folder.
// Job 10: PW_WRANGLER_CONFIG picks the Worker file (default wrangler.toml; wrangler.preview.toml serves out-preview/,
// built with --target=preview). Since job 10 `wrangler dev` also runs worker/almar.mjs, which imports the
// .open-next/ bundle the assembler writes, so assemble before running.
const port = Number(process.env.PW_PORT ?? 8787);
const wranglerConfig = process.env.PW_WRANGLER_CONFIG ?? "wrangler.toml";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/build",
  testMatch: /.*\.spec\.ts$/,
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
    command: `./node_modules/.bin/wrangler dev --config ${wranglerConfig} --ip 127.0.0.1 --port ${port} --show-interactive-dev-session=false`,
    url: `${baseURL}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: "false" },
  },
});
