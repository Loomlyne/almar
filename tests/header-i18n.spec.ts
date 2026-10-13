import { expect, test, type Page } from "@playwright/test";

// Plan 02-05 (addendum 2026-10-11): a public-page pick is offered to her account (POST /api/preferences, fire-and-forget)
// without changing what 3.3 shipped: the language pick goes to the same page in the other language, the currency pick
// keeps the URL and the language. Signed out, the server answers 204 and writes nothing. A failed request never blocks
// the navigation. The sign-in's handoff cookie copies her saved currency into the browser choice.

test.use({ viewport: { width: 1440, height: 900 } });
// Each language pick makes next dev compile another locale tree; under load that alone can take 20-30 s.
test.setTimeout(90_000);

async function open(page: Page, path: string) {
  await page.goto(path);
  // A bare network-idle wait can hit 30 s on a cold dev server (00-common-rules): cap it.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

const HINT = { name: "almar-signed-in", value: "1", url: "http://127.0.0.1" };

test("signed out (no hint): a language pick sends no request and logs no error", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const posts: string[] = [];
  page.on("request", (r) => r.url().includes("/api/preferences") && posts.push(r.method()));
  await open(page, "/");
  await page.getByRole("combobox", { name: /^Language:/ }).first().click();
  await page.getByRole("option", { name: "Español" }).click();
  await page.waitForURL((url) => url.pathname === "/es/" || url.pathname === "/es");
  await open(page, "/es/");
  expect(posts).toEqual([]);
  expect(errors.filter((e) => e.includes("/api/preferences") || e.includes("403"))).toEqual([]);
});

test("sign-out clears the hint (Max-Age=0), whatever the session state", async ({ request }) => {
  const res = await request.post("/auth/sign-out", { headers: { cookie: "almar-signed-in=1" }, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  const cleared = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie" && h.value.startsWith("almar-signed-in="));
  expect(cleared).toHaveLength(1);
  expect(cleared[0].value).toMatch(/^almar-signed-in=;/);
  expect(cleared[0].value).toMatch(/Max-Age=0/i);
  expect(cleared[0].value).toMatch(/SameSite=lax/i);
  expect(cleared[0].value).not.toMatch(/HttpOnly/i);
});

test("signed in (hint set): picking العربية on / goes to /ar/ with dir=rtl, sets almar-locale and offers the pick to the account", async ({ page, context }) => {
  await context.addCookies([HINT]);
  await open(page, "/");
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/preferences") && r.method() === "POST");
  await page.getByRole("combobox", { name: /^Language:/ }).first().click();
  await page.getByRole("option", { name: "العربية" }).click();

  const request = await posted;
  expect(request.postDataJSON()).toEqual({ locale: "ar" });
  expect(request.headers()["content-type"]).toBe("application/json");
  // Not request.response(): the page navigates while this keepalive request is in flight, and Playwright may never
  // report its response. The endpoint's 204 is pinned by the request-API test at the end of this file.

  await page.waitForURL((url) => url.pathname === "/ar/" || url.pathname === "/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "almar-locale")?.value).toBe("ar");
});

test("the language pick still navigates when the preferences request fails (offline)", async ({ page, context }) => {
  await context.addCookies([HINT]);
  await open(page, "/");
  await page.route("**/api/preferences", (route) => route.abort("internetdisconnected"));
  await page.getByRole("combobox", { name: /^Language:/ }).first().click();
  await page.getByRole("option", { name: "Español" }).click();
  await page.waitForURL((url) => url.pathname === "/es/" || url.pathname === "/es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("a currency pick keeps the URL and almar-locale, and is offered to the account", async ({ page, context }) => {
  await context.addCookies([{ name: "almar-locale", value: "ar", url: "http://127.0.0.1" }, HINT]);
  await open(page, "/ar/");
  const currency = page.getByRole("combobox", { name: /^(Currency|العملة)/ }).first();
  test.skip((await currency.count()) === 0, "this build has no exchange rates, so the home page shows no currency control");

  const posted = page.waitForRequest((r) => r.url().endsWith("/api/preferences") && r.method() === "POST");
  await currency.click();
  await page.getByRole("option", { name: "USD" }).click();
  const request = await posted;
  expect(request.postDataJSON()).toEqual({ currency: "USD" });
  expect((await request.response())?.status()).toBe(204);

  expect(new URL(page.url()).pathname).toMatch(/^\/ar\/?$/);
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "almar-locale")?.value).toBe("ar");
  expect(await page.evaluate(() => window.localStorage.getItem("almar-currency"))).toBe("USD");
});

test("the sign-in handoff cookie puts her saved currency in the browser choice once, then is cleared", async ({ page, context }) => {
  await context.addCookies([{ name: "almar-prefs-sync", value: "EUR", url: "http://127.0.0.1" }]);
  await open(page, "/private-stays");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("almar-currency"))).toBe("EUR");
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "almar-prefs-sync")).toBeUndefined();
});

test("a tampered handoff cookie is ignored and cleared", async ({ page, context }) => {
  await context.addCookies([{ name: "almar-prefs-sync", value: "GBP", url: "http://127.0.0.1" }]);
  await open(page, "/about");
  await expect.poll(async () => (await context.cookies()).some((c) => c.name === "almar-prefs-sync")).toBe(false);
  expect(await page.evaluate(() => window.localStorage.getItem("almar-currency"))).toBeNull();
});

// Fix-up 02-05b (review of PR #6, finding 1): the footer's language row (plain links, the crawlable no-JS row) offers
// the pick to her account like the header picker does, and still navigates as a plain link.
const footerLanguages = (page: Page) => page.getByRole("contentinfo").getByRole("navigation", { name: "Language" });

test("footer, signed in (hint set): the Español link offers the pick to the account and still navigates", async ({ page, context }) => {
  await context.addCookies([HINT]);
  await open(page, "/about");
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/preferences") && r.method() === "POST");
  await footerLanguages(page).getByRole("link", { name: "Español" }).click();
  const request = await posted;
  expect(request.postDataJSON()).toEqual({ locale: "es" });
  expect(request.headers()["content-type"]).toBe("application/json");
  await page.waitForURL((url) => /^\/es\/about\/?$/.test(url.pathname));
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("footer, signed out (no hint): the العربية link sends no request and still navigates", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (r) => r.url().includes("/api/preferences") && posts.push(r.method()));
  await open(page, "/about");
  await footerLanguages(page).getByRole("link", { name: "العربية" }).click();
  await page.waitForURL((url) => /^\/ar\/about\/?$/.test(url.pathname));
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(posts).toEqual([]);
});

test("footer, signed in: the current language's link is no change and sends nothing", async ({ page, context }) => {
  await context.addCookies([HINT]);
  await open(page, "/about");
  const posts: string[] = [];
  page.on("request", (r) => r.url().includes("/api/preferences") && posts.push(r.method()));
  const english = footerLanguages(page).getByRole("link", { name: "English" });
  await expect(english).toHaveAttribute("aria-current", "true");
  await english.click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(500);
  expect(posts).toEqual([]);
});

test("the endpoint refuses a cross-origin POST and answers a same-origin signed-out POST with 204", async ({ request, baseURL }) => {
  const cross = await request.post("/api/preferences", {
    data: { locale: "ar" },
    headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
  });
  expect(cross.status()).toBe(403);
  expect(await cross.text()).not.toContain('"ar"');

  const same = await request.post("/api/preferences", { data: { locale: "ar" }, headers: { origin: baseURL! } });
  expect(same.status()).toBe(204);

  const bad = await request.post("/api/preferences", { data: { locale: "fr" }, headers: { origin: baseURL! } });
  expect(bad.status()).toBe(400);
});
