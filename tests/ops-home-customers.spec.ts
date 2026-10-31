import { expect, test, type Page, type Route } from "@playwright/test";
import { DASHBOARD_COPY } from "../lib/copy/dashboard";
import { OPS_HOME_COPY } from "../lib/copy/ops-home";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";
import { REF, SITE_STATUS, makeBooking, mockBookingsApi, toItem } from "./helpers/ops-bookings-api";
import { VIEWPORTS, type Viewport } from "./journey/matrix";

// Plan 05-04 Task 3: Home, Customers and Profile on the real pages with every /api/ops/* call answered here, shaped like
// lib/ops/home-api.ts. The queries are asserted. Amounts are symbolic fils, not prices. Written, NOT run (owner rule).

type Locale = "en" | "ar" | "es";
const LOCALES: Locale[] = ["en", "ar", "es"];
const SIZES: Viewport[] = ["phone", "tablet", "desktop"];
const EMAIL = "guest.one@example.com";

const NUMBERS = { from: "2026-10-01", to: "2026-10-31", bookings: 3, received_fils: 500_000, refunded_fils: 100_000, recorded_fils: 400_000, outstanding_fils: 250_000, outstanding_count: 2 };
const ZERO = { ...NUMBERS, bookings: 0, received_fils: 0, refunded_fils: 0, recorded_fils: 0, outstanding_fils: 0, outstanding_count: 0 };

const CUSTOMER = (n: number) => ({ email: n === 1 ? EMAIL : `guest.${n}@example.com`, name: `Guest ${n}`, phone: `+000 000 ${n}`, bookings: n, last_arrive: "2026-11-02" });

const reply = (route: Route, json: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });

async function answerShell(page: Page) {
  await page.route("**/api/ops/site-status", (route) => reply(route, { ok: true, site: SITE_STATUS }));
}

/** Answers /api/ops/home from `numbers`; `queries` collects the search strings. */
async function mockHome(page: Page, numbers: Record<string, unknown> = NUMBERS) {
  const queries: string[] = [];
  await answerShell(page);
  await page.route("**/api/ops/home**", (route) => {
    queries.push(new URL(route.request().url()).search);
    return reply(route, { ok: true, ...numbers });
  });
  return queries;
}

async function mockCustomers(page: Page) {
  const queries: URLSearchParams[] = [];
  await answerShell(page);
  await page.route("**/api/ops/customers**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    if (params.get("after")) return reply(route, { ok: true, items: [CUSTOMER(3)], next: null });
    return reply(route, { ok: true, items: [CUSTOMER(1), CUSTOMER(2)], next: "2" });
  });
  return queries;
}

const underlinedCount = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll("main *")].filter((el) => getComputedStyle(el).textDecorationLine.includes("underline")).length);

test.describe("Home", () => {
  test.setTimeout(120_000);

  test("three numbers and none of Cost, Occupancy, Charts or Reminders; ranges send their query", async ({ page, baseURL }) => {
    const queries = await mockHome(page);
    const c = OPS_HOME_COPY.en.home;
    await openDashboard(page, "/dashboard/home", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.home);
    for (const label of [c.bookings, c.recorded, c.outstanding]) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    for (const word of ["Cost", "Occupancy", "Charts", "Reminders"]) await expect(page.getByText(word, { exact: true })).toHaveCount(0);
    expect(queries.at(-1)).toContain("range=month");
    await page.getByRole("button", { name: DASHBOARD_COPY.en.last30, exact: true }).click();
    await expect.poll(() => queries.at(-1)).toContain("range=30d");
    // Custom sends nothing until two days are picked.
    const before = queries.length;
    await page.getByRole("button", { name: DASHBOARD_COPY.en.custom, exact: true }).click();
    await expect(page.getByText(c.pickDates)).toBeVisible();
    expect(queries.length).toBe(before);
    await expect(page.locator('input[type="radio"]')).toHaveCount(0);
  });

  test("Custom: two days send from and to", async ({ page, baseURL }) => {
    const queries = await mockHome(page);
    await openDashboard(page, "/dashboard/home", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.home);
    await page.getByRole("button", { name: DASHBOARD_COPY.en.custom, exact: true }).click();
    await page.locator("#home-range").click();
    const days = page.getByRole("gridcell").filter({ hasText: /^(10|12)$/ });
    await days.first().click();
    await days.last().click();
    await expect.poll(() => queries.at(-1)).toMatch(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  });

  test("a negative Recorded money shows -AED and does not crash", async ({ page, baseURL }) => {
    await mockHome(page, { ...NUMBERS, received_fils: 0, refunded_fils: 5_000, recorded_fils: -5_000 });
    await openDashboard(page, "/dashboard/home", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.home);
    await expect(page.getByText("-AED 50.00")).toBeVisible();
  });

  test("zero numbers have no link; filled numbers link to Bookings", async ({ page, baseURL }) => {
    await mockHome(page, ZERO);
    await openDashboard(page, "/dashboard/home", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.home);
    await expect(page.locator("main a[href*='bookings']")).toHaveCount(0);
  });

  test("filled numbers are links to the plain Bookings list", async ({ page, baseURL }) => {
    await mockHome(page);
    await openDashboard(page, "/dashboard/home", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.home);
    await expect(page.locator("main a[href*='bookings']")).toHaveCount(3);
    const href = await page.locator("main a[href*='bookings']").first().getAttribute("href");
    expect(href).not.toContain("?");
  });

  test("no element on the page has an underline", async ({ page, baseURL }) => {
    await mockHome(page);
    await openDashboard(page, "/dashboard/home", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.home);
    const underlined = await page.evaluate(() =>
      [...document.querySelectorAll("main *")].filter((el) => getComputedStyle(el).textDecorationLine.includes("underline")).length,
    );
    expect(underlined).toBe(0);
  });


  test("a range over the cap says so in the field, not as a load failure", async ({ page, baseURL }) => {
    const queries = await mockHome(page);
    await openDashboard(page, "/dashboard/home", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.home);
    await page.getByRole("button", { name: DASHBOARD_COPY.en.custom, exact: true }).click();
    await page.locator("#home-range").click();
    // The calendar's first selectable day is 2020-01-01; the last day is far past 3,661 days from it.
    const before = queries.length;
    await page.getByRole("gridcell").filter({ hasText: /^1$/ }).first().click();
    for (let i = 0; i < 130; i += 1) await page.getByRole("button", { name: /next/i }).first().click();
    await page.getByRole("gridcell").filter({ hasText: /^1$/ }).first().click();
    await expect(page.getByText(OPS_HOME_COPY.en.home.rangeTooLong)).toBeVisible();
    await expect(page.getByText(OPS_HOME_COPY.en.home.failed)).toHaveCount(0);
    expect(queries.length).toBe(before);
  });

  test("a failed read shows the sentence and no numbers", async ({ page, baseURL }) => {
    await answerShell(page);
    await page.route("**/api/ops/home**", (route) => reply(route, { ok: false, error: { code: "unavailable", field: null, locale: null, detail: null } }, 503));
    await openDashboard(page, "/dashboard/home", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.home);
    await expect(page.getByRole("alert").filter({ hasText: OPS_HOME_COPY.en.home.failed })).toBeVisible();
    await expect(page.getByText(OPS_HOME_COPY.en.home.recorded, { exact: true })).toHaveCount(0);
  });

  test("no underline on a hovered linked card", async ({ page, baseURL }) => {
    await mockHome(page);
    await openDashboard(page, "/dashboard/home", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.home);
    await page.locator("main a[href*='bookings']").first().hover();
    expect(await underlinedCount(page)).toBe(0);
  });

  for (const locale of LOCALES) {
    for (const size of SIZES) {
      test(`Home in ${locale} at ${VIEWPORTS[size].width}: numbers keep ltr, the page reads ${locale === "ar" ? "rtl" : "ltr"}, no overflow`, async ({ page, baseURL }) => {
        await mockHome(page);
        await openDashboard(page, "/dashboard/home", size, locale, baseURL, DASHBOARD_COPY[locale].rail.home);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await expect(page.getByText(OPS_HOME_COPY[locale].home.recorded, { exact: true }).first()).toBeVisible();
        await expect(page.locator("main bdi[dir='ltr']").first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});

test.describe("Customers", () => {
  test.setTimeout(120_000);

  test("rows, search sends q, Show more sends after, no New customer", async ({ page, baseURL }) => {
    const queries = await mockCustomers(page);
    const c = OPS_HOME_COPY.en.customers;
    await openDashboard(page, "/dashboard/customers", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.customers);
    await expect(openRow(page, "Guest 1")).toBeVisible();
    await expect(page.getByRole("button", { name: /new customer/i })).toHaveCount(0);
    await page.getByLabel(c.search).fill("guest");
    await expect.poll(() => queries.at(-1)?.get("q")).toBe("guest");
    await page.getByRole("button", { name: c.showMore, exact: true }).click();
    await expect.poll(() => queries.at(-1)?.get("after")).toBe("2");
    await expect(openRow(page, "Guest 3")).toBeVisible();
    expect(page.url()).not.toContain("q=");
  });

  test("a row opens Bookings searched by the email, with the email out of the address, and Back keeps it", async ({ page, baseURL }) => {
    await mockCustomers(page);
    const booking = makeBooking({ ref: REF });
    const api = await mockBookingsApi(page, [booking], (call) =>
      call.path === "/api/ops/bookings" && call.query.q === EMAIL ? { status: 200, body: { ok: true, items: [toItem(booking)], next: null } } : undefined,
    );
    await openDashboard(page, "/dashboard/customers", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.customers);
    await openRow(page, "Guest 1").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/./);
    await expect(page.locator("#bookings-search")).toHaveValue(EMAIL);
    await expect.poll(() => api.to("/api/ops/bookings").some((call) => call.query.q === EMAIL)).toBe(true);
    expect(page.url()).not.toContain(EMAIL);
    expect(page.url()).not.toContain("q=");
    // Open a booking and press Back: the guest's bookings come back.
    await page.getByText(REF).first().click();
    await expect(page).toHaveURL(/detail/);
    await page.goBack();
    await expect(page.locator("#bookings-search")).toHaveValue(EMAIL);
    expect(page.url()).not.toContain(EMAIL);
  });

  test("a failed read shows the sentence and not the empty line", async ({ page, baseURL }) => {
    await answerShell(page);
    await page.route("**/api/ops/customers**", (route) => reply(route, { ok: false, error: { code: "unavailable", field: null, locale: null, detail: null } }, 503));
    await openDashboard(page, "/dashboard/customers", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.customers);
    await expect(page.getByRole("alert").filter({ hasText: OPS_HOME_COPY.en.customers.failed })).toBeVisible();
    await expect(page.getByText(DASHBOARD_COPY.en.noCustomersYet)).toHaveCount(0);
  });

  test("no underline on Customers, at rest or on a hovered row", async ({ page, baseURL }) => {
    await mockCustomers(page);
    await openDashboard(page, "/dashboard/customers", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.customers);
    expect(await underlinedCount(page)).toBe(0);
    await openRow(page, "Guest 1").hover();
    expect(await underlinedCount(page)).toBe(0);
  });

  test("a handed email is not kept: Customers row, a booking, Home, Bookings card gives an empty search box", async ({ page, baseURL }) => {
    await mockCustomers(page);
    await mockHome(page);
    const booking = makeBooking({ ref: REF });
    await mockBookingsApi(page, [booking], (call) =>
      call.path === "/api/ops/bookings" && call.query.q === EMAIL ? { status: 200, body: { ok: true, items: [toItem(booking)], next: null } } : undefined,
    );
    await openDashboard(page, "/dashboard/customers", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.customers);
    await openRow(page, "Guest 1").click();
    await expect(page.locator("#bookings-search")).toHaveValue(EMAIL);
    await page.getByText(REF).first().click();
    await expect(page).toHaveURL(/detail/);
    // The rail takes the owner to Home (a pathname that is not Bookings clears the handoff), then a card opens Bookings.
    await page.getByRole("link", { name: DASHBOARD_COPY.en.rail.home, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: DASHBOARD_COPY.en.rail.home })).toBeVisible();
    await page.locator("main a[href*='bookings']").first().click();
    await expect(page.locator("#bookings-search")).toHaveValue("");
  });

  for (const locale of LOCALES) {
    for (const size of SIZES) {
      test(`Customers in ${locale} at ${VIEWPORTS[size].width}: words, direction, no overflow`, async ({ page, baseURL }) => {
        await mockCustomers(page);
        await openDashboard(page, "/dashboard/customers", size, locale, baseURL, DASHBOARD_COPY[locale].rail.customers);
        await expect(page.getByLabel(OPS_HOME_COPY[locale].customers.search)).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});

test.describe("Profile", () => {
  test.setTimeout(120_000);

  async function mockProfile(page: Page) {
    await answerShell(page);
    await page.route("**/api/ops/profile", (route) => reply(route, { ok: true, name: "Owner Example", email: "owner@example.com" }));
  }

  test("name and email read-only; no Sign out inside main", async ({ page, baseURL }) => {
    await mockProfile(page);
    await openDashboard(page, "/dashboard/profile", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.profile);
    await expect(page.locator("#profile-name")).toHaveValue("Owner Example");
    await expect(page.locator("#profile-email")).toHaveValue("owner@example.com");
    await expect(page.locator("#profile-name")).not.toBeEditable();
    await expect(page.locator("#profile-email")).not.toBeEditable();
    await expect(page.locator("main#content").getByRole("button", { name: /sign out|logout/i })).toHaveCount(0);
  });

  test("a name-less account shows the placeholder in the name field", async ({ page, baseURL }) => {
    await answerShell(page);
    await page.route("**/api/ops/profile", (route) => reply(route, { ok: true, name: null, email: "owner@example.com" }));
    await openDashboard(page, "/dashboard/profile", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.profile);
    await expect(page.locator("#profile-name")).toHaveValue("");
    await expect(page.locator("#profile-name")).toHaveAttribute("placeholder", OPS_HOME_COPY.en.profile.noName);
  });

  test("a failed read shows the sentence and no empty fields", async ({ page, baseURL }) => {
    await answerShell(page);
    await page.route("**/api/ops/profile", (route) => reply(route, { ok: false, error: { code: "unavailable", field: null, locale: null, detail: null } }, 503));
    await openDashboard(page, "/dashboard/profile", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.profile);
    await expect(page.getByRole("alert").filter({ hasText: OPS_HOME_COPY.en.profile.failed })).toBeVisible();
    await expect(page.locator("#profile-name")).toHaveCount(0);
    await expect(page.locator("#profile-email")).toHaveCount(0);
  });

  test("no underline on Profile, at rest or on hover", async ({ page, baseURL }) => {
    await mockProfile(page);
    await openDashboard(page, "/dashboard/profile", "desktop", "en", baseURL, DASHBOARD_COPY.en.rail.profile);
    expect(await underlinedCount(page)).toBe(0);
    await page.locator("#profile-email").hover();
    expect(await underlinedCount(page)).toBe(0);
  });

  for (const locale of LOCALES) {
    for (const size of SIZES) {
      test(`Profile in ${locale} at ${VIEWPORTS[size].width}: labels, direction, no overflow`, async ({ page, baseURL }) => {
        await mockProfile(page);
        await openDashboard(page, "/dashboard/profile", size, locale, baseURL, DASHBOARD_COPY[locale].rail.profile);
        await expect(page.getByLabel(OPS_HOME_COPY[locale].profile.name)).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});
