import { readFileSync, existsSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Plan 02-06: maintenance on the BUILT public Worker (local `wrangler dev`, never --remote), against this worktree's
// local Supabase stack. The static pages close at the publish rebuild (tests/site-settings.test.mjs, applySiteSettings);
// /login, /account and /bookings are no files in out/: wrangler.toml's run_worker_first sends them to the Worker, whose
// middleware reads the saved flag. This spec saves maintenance on in the local database and proves all three answer
// with the closed page, while a static page is still served from out/ and the API still answers.
// Setup and command: tests/build/make-public-stack-config.mjs; a plain build-config run (another PW_WRANGLER_CONFIG)
// skips this file. Bodies are never printed.

const CONFIG = process.env.PW_WRANGLER_CONFIG ?? "";
const STACK_RUN = /(^|\/)\.tmp\/public-stack\/wrangler\.test\.toml$/.test(CONFIG);
test.skip(!STACK_RUN, "needs the local-stack public config: run tests/build/make-public-stack-config.mjs (see the header)");

const VARS = ".tmp/public-stack/.dev.vars";
const NAV = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", accept: "text/html" };
const LINE = "ALMAR Private Journey is closed for a short time.";
const SAVED_TEAL = "#7a1f3b";

function devVars(): Record<string, string> {
  if (!existsSync(VARS)) throw new Error(`${VARS} is missing: run tests/build/make-public-stack-config.mjs`);
  return Object.fromEntries(
    readFileSync(VARS, "utf8")
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}

async function saveSettings(request: APIRequestContext, body: Record<string, unknown>) {
  const vars = devVars();
  const url = vars.NEXT_PUBLIC_SUPABASE_URL;
  const key = vars.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.startsWith("http://127.0.0.1:") || !key) throw new Error("the stack copy does not point at a local stack");
  const res = await request.patch(`${url}/rest/v1/site_settings?id=eq.1`, {
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=minimal" },
    data: body,
  });
  expect(res.status(), "the local settings row was written").toBe(204);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext();
  await saveSettings(request, { maintenance: true, teal: SAVED_TEAL });
  await request.dispose();
});

test.afterAll(async ({ playwright }) => {
  const request = await playwright.request.newContext();
  await saveSettings(request, { maintenance: false, teal: null });
  await request.dispose();
});

test("/login, /account and /bookings answer 503 with the closed page, in the saved colours", async ({ request }) => {
  for (const path of ["/login", "/account", "/bookings"]) {
    for (const headers of [NAV, {}]) {
      const res = await request.get(path, { headers, maxRedirects: 0 });
      expect(res.status(), path).toBe(503);
      expect(res.headers()["content-type"], path).toMatch(/^text\/html/);
      expect(res.headers()["cache-control"], path).toBe("no-store");
      expect(res.headers()["x-robots-tag"], path).toBe("noindex");
      const html = await res.text();
      expect(html.includes(LINE), path).toBe(true);
      expect(html.includes('href="tel:+971563883302"'), path).toBe(true);
      expect(html.includes(`--color-teal:${SAVED_TEAL}`), path).toBe(true);
      expect(/<form|<script|sign-in-email/i.test(html), path).toBe(false);
    }
  }
});

test("the closed page follows the language cookie", async ({ request }) => {
  const res = await request.get("/login", { headers: { ...NAV, cookie: "almar-locale=es" }, maxRedirects: 0 });
  expect(res.status()).toBe(503);
  const html = await res.text();
  expect(html.includes('lang="es"')).toBe(true);
  expect(html.includes("está cerrado por un momento")).toBe(true);
});

test("a static page is still the file in out/ (the rebuild closes it); the API still answers", async ({ request }) => {
  const about = await request.get("/about", { headers: NAV, maxRedirects: 0 });
  expect(about.status()).toBe(200);
  expect(about.headers()["x-opennext"]).toBeUndefined();
  expect((await about.text()).includes(LINE)).toBe(false);
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
});

test("the flag is read on every request (PR #14 review): saved off opens /login at once, saved on closes it at once", async ({ request }) => {
  await saveSettings(request, { maintenance: false });
  expect((await request.get("/login", { headers: NAV, maxRedirects: 0 })).status()).toBe(200);
  await saveSettings(request, { maintenance: true });
  expect((await request.get("/login", { headers: NAV, maxRedirects: 0 })).status()).toBe(503);
});
