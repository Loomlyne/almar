import { expect, test, type Page } from "@playwright/test";
import { OPS_BOOKINGS_COPY } from "../lib/copy/ops-bookings";
import { DESTINATION_ID, makeBooking, mockBookingsApi, REF, toItem } from "./helpers/ops-bookings-api";

// Plan 04-09 Task 2: the bookings list, detail and dialogs are presentational components. The picture scenes and the
// shoot were replaced by the signed HTML page (owner, 2026-10-25: no test, no shoot), so this spec holds the copy walk
// and (Task 7) the list behaviour against contract-shaped mocks. Written and not run in this job.

type Walk = Record<string, unknown>;

function leaves(value: unknown, path: string, out: [string, unknown][]): void {
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Walk)) leaves(child, path ? `${path}.${key}` : key, out);
  } else {
    out.push([path, value]);
  }
}

function keysOf(value: unknown): string[] {
  const out: [string, unknown][] = [];
  leaves(value, "", out);
  return out.map(([path]) => path).sort();
}

test("copy: same keys in en, ar and es at every depth, every leaf a non-empty string", () => {
  const keys = keysOf(OPS_BOOKINGS_COPY.en);
  for (const locale of ["en", "ar", "es"] as const) {
    expect(keysOf(OPS_BOOKINGS_COPY[locale]), `${locale} keys`).toEqual(keys);
    const out: [string, unknown][] = [];
    leaves(OPS_BOOKINGS_COPY[locale], "", out);
    for (const [path, value] of out) {
      expect(typeof value, `${locale}.${path}`).toBe("string");
      expect((value as string).trim(), `${locale}.${path} empty`).not.toBe("");
      expect(value as string, `${locale}.${path}`).not.toMatch(/\[object|undefined|NaN/);
    }
  }
});

test("copy: the signature's added detail strings exist in all three languages", () => {
  for (const locale of ["en", "ar", "es"] as const) {
    const detail = OPS_BOOKINGS_COPY[locale].detail;
    for (const key of ["adults", "children", "infants", "language", "quantity"] as const) {
      expect(detail[key].trim(), `${locale}.detail.${key}`).not.toBe("");
    }
    expect(Object.keys(detail.travellerKinds).sort()).toEqual(["adult", "child", "infant"]);
    expect(Object.keys(detail.lineUnit).sort()).toEqual(["night", "person", "trip"]);
  }
});

// ------------------------------------------------------------------------------------------------------------
// Behaviour (Task 7): /dashboard/bookings in the preview shell, every /api/ops/* answered by mockBookingsApi.
// ------------------------------------------------------------------------------------------------------------

type Locale = "en" | "ar" | "es";

async function openList(page: Page, locale: Locale, search = "", bookings = [makeBooking()], override?: Parameters<typeof mockBookingsApi>[2]) {
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: page.url() === "about:blank" ? "http://127.0.0.1" : page.url() }]);
  const api = await mockBookingsApi(page, bookings, override);
  await page.goto(`/dashboard/bookings${search}`);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.locator("[data-bookings-list]")).toBeVisible({ timeout: 30_000 });
  return api;
}

test.describe.configure({ mode: "parallel" });

for (const [locale, width] of [["en", 390], ["en", 1440], ["ar", 390], ["ar", 1440], ["es", 834]] as const) {
  test(`the list shows the awaiting request, TEST and no sideways scroll: ${locale} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openList(page, locale);
    const copy = OPS_BOOKINGS_COPY[locale];
    const list = page.locator("[data-bookings-list]");
    await expect(list.getByText(REF).first()).toBeVisible();
    await expect(list.getByText(copy.flags.test).first()).toBeVisible();
    await expect(list.getByText(copy.statuses.awaiting_payment).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    if (width === 390) await expect(list.locator("table")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}

test("typing in search sends one GET with q after 300 ms of quiet, and the URL keeps it", async ({ page }) => {
  const copy = OPS_BOOKINGS_COPY.en;
  const api = await openList(page, "en");
  const before = api.to("/api/ops/bookings").length;
  await page.getByLabel(copy.list.search).pressSequentially("guest", { delay: 40 });
  await expect.poll(() => api.to("/api/ops/bookings").length).toBe(before + 1);
  expect(api.to("/api/ops/bookings").at(-1)?.query.q).toBe("guest");
  await expect(page).toHaveURL(/[?&]q=guest/);
});

test("status, destination and dates each send their query key; a reload restores them from the URL", async ({ page }) => {
  const api = await openList(page, "en", `?status=deposit_paid&destination=${DESTINATION_ID}&from=2026-12-01&to=2026-12-31`);
  const first = api.to("/api/ops/bookings")[0];
  expect(first.query).toMatchObject({ status: "deposit_paid", destination: DESTINATION_ID, from: "2026-12-01", to: "2026-12-31" });
  await page.reload();
  await expect(page.locator("[data-bookings-list]")).toBeVisible();
  expect(api.to("/api/ops/bookings").at(-1)?.query).toMatchObject({ status: "deposit_paid", destination: DESTINATION_ID });
  await expect(page).toHaveURL(/status=deposit_paid/);
});

test("a slow older answer never replaces a newer one", async ({ page }) => {
  const copy = OPS_BOOKINGS_COPY.en;
  const other = makeBooking({ id: "00000000-0000-4000-8000-0000000000b2", ref: "ALMAR-ZZ2ZZZ" });
  await openList(page, "en", "", [makeBooking(), other], async (call) => {
    if (call.path === "/api/ops/bookings" && call.query.q === "alm") await new Promise((resolve) => setTimeout(resolve, 1500));
    return undefined;
  });
  const search = page.getByLabel(copy.list.search);
  await search.fill("alm");
  await page.waitForTimeout(400);
  await search.fill("zz2");
  const list = page.locator("[data-bookings-list]");
  await expect(list.getByText("ALMAR-ZZ2ZZZ").first()).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(list.getByText(REF)).toHaveCount(0);
});

test("Show more sends after=<next> and appends", async ({ page }) => {
  const copy = OPS_BOOKINGS_COPY.en;
  const second = makeBooking({ id: "00000000-0000-4000-8000-0000000000b2", ref: "ALMAR-ZZ2ZZZ" });
  const api = await openList(page, "en", "", [makeBooking()], (call) => {
    if (call.path !== "/api/ops/bookings") return undefined;
    if (call.query.after === "30") return { status: 200, body: { ok: true, items: [toItem(second)], next: null } };
    return { status: 200, body: { ok: true, items: [toItem(makeBooking())], next: "30" } };
  });
  await page.getByRole("button", { name: copy.list.showMore }).click();
  expect(api.to("/api/ops/bookings").at(-1)?.query.after).toBe("30");
  const list = page.locator("[data-bookings-list]");
  await expect(list.getByText("ALMAR-ZZ2ZZZ").first()).toBeVisible();
  await expect(list.getByText(REF).first()).toBeVisible();
});

test("a failed GET shows the error line and no stale rows", async ({ page }) => {
  const copy = OPS_BOOKINGS_COPY.en;
  await openList(page, "en", "", [makeBooking()], (call) => (call.path === "/api/ops/bookings" && call.query.q === "boom" ? { status: 503, body: { ok: false, error: { code: "unavailable", field: null, locale: null, detail: null } } } : undefined));
  await page.getByLabel(copy.list.search).fill("boom");
  await expect(page.locator("[data-bookings-list]").getByRole("alert")).toBeVisible();
  await expect(page.locator("[data-bookings-list]").getByText(REF)).toHaveCount(0);
});

test("a part-paid request past its pay-by date says so in words on its row", async ({ page }) => {
  const copy = OPS_BOOKINGS_COPY.en;
  const partPaid = makeBooking({ paid_fils: 100_000, deadline_passed: true, attention_reason: "deadline_passed_part_paid" });
  await openList(page, "en", "", [partPaid]);
  await expect(page.locator("[data-bookings-list]").getByText(copy.flags.deadlinePassedPartPaid).first()).toBeVisible();
});

test("opening a row goes to the detail with only the reference in the URL; New booking never exists", async ({ page }) => {
  await openList(page, "en");
  await expect(page.getByRole("button", { name: /New booking/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /New booking/ })).toHaveCount(0);
  await page.locator("[data-bookings-list]").getByText(REF).first().click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bookings/detail\\?ref=${REF}$`));
});
