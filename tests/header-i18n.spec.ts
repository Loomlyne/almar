import { expect, test, type Page } from "@playwright/test";

// Plan 02-05 (addendum 2026-10-11): a public-page pick is offered to her account (POST /api/preferences, fire-and-forget)
// without changing what 3.3 shipped: the language pick goes to the same page in the other language, the currency pick
// keeps the URL and the language. Signed out, the server answers 204 and writes nothing. A failed request never blocks
// the navigation. The sign-in's handoff cookie copies her saved currency into the browser choice.

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page: Page, path: string) {
  await page.goto(path);
  // A bare network-idle wait can hit 30 s on a cold dev server (00-common-rules): cap it.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

test("picking العربية on / goes to /ar/ with dir=rtl, sets almar-locale and offers the pick to the account", async ({ page }) => {
  await open(page, "/");
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/preferences") && r.method() === "POST");
  await page.getByRole("combobox", { name: /^Language:/ }).first().click();
  await page.getByRole("option", { name: "العربية" }).click();

  const request = await posted;
  expect(request.postDataJSON()).toEqual({ locale: "ar" });
  expect(request.headers()["content-type"]).toBe("application/json");
  const response = await request.response();
  expect(response?.status()).toBe(204);

  await page.waitForURL((url) => url.pathname === "/ar/" || url.pathname === "/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "almar-locale")?.value).toBe("ar");
});

test("the language pick still navigates when the preferences request fails (offline)", async ({ page }) => {
  await open(page, "/");
  await page.route("**/api/preferences", (route) => route.abort("internetdisconnected"));
  await page.getByRole("combobox", { name: /^Language:/ }).first().click();
  await page.getByRole("option", { name: "Español" }).click();
  await page.waitForURL((url) => url.pathname === "/es/" || url.pathname === "/es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("a currency pick keeps the URL and almar-locale, and is offered to the account", async ({ page, context }) => {
  await context.addCookies([{ name: "almar-locale", value: "ar", url: "http://127.0.0.1" }]);
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
