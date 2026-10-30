import { readFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { HONEYPOT_FIELDS } from "../lib/contact-inquiry";
import { HOME_PAGE_COPY } from "../lib/copy/home-page";
import { PACKAGE_PAGE_COPY } from "../lib/copy/package-page";
import { PACKAGE_REQUEST_FIELD as F } from "../lib/site-requests/package";

// Plan 06-06 Task 4: the package page on fixtures, with /api/requests answered here. No database, no mail. Fixtures have no legs and
// no add-ons, so the route, the Included panel and the city boxes are not on these pages: those are in tests/package-view-render.test.mjs
// and tests/package-request.test.mjs. Written, NOT run (owner rule 2026-10-21).

const SLUG = "the-explorer";
const PATH = `/en/journeys/${SLUG}`;
const copy = PACKAGE_PAGE_COPY.en;

type TierText = { tier_id: string; locale: string; name: string; price_label: string };
const fixtures = (name: string) => JSON.parse(readFileSync(`lib/data/fixtures/${name}.json`, "utf8"));
const tierId = (fixtures("home").tiers as { id: string; slug: string }[]).find((tier) => tier.slug === SLUG)!.id;
const textOf = (locale: string) => (fixtures("home-translations").tiers as TierText[]).find((row) => row.tier_id === tierId && row.locale === locale)!;

const reply = (route: Route, status: number, json: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
const form = (page: Page) => page.getByRole("form", { name: copy.reqHeading });
const fieldOf = (page: Page, label: string) => form(page).getByLabel(label, { exact: false }).first();

async function fillContact(page: Page) {
  await fieldOf(page, copy.name).fill("Ana");
  await fieldOf(page, copy.email).fill("ana@example.com");
}

test.describe("Package page", () => {
  test("the name and the owner's price line, as written; one request form; nothing to pay or a card to fill", async ({ page }) => {
    await page.goto(PATH);
    const text = textOf("en");
    await expect(page.getByRole("heading", { level: 1, name: text.name })).toBeVisible();
    await expect(page.locator(`[data-price="${SLUG}"]`)).toHaveText(text.price_label);
    await expect(page.getByRole("heading", { level: 2, name: copy.reqHeading })).toBeVisible();
    await expect(page.getByRole("button", { name: copy.send, exact: true })).toBeVisible();
    await expect(page.locator('input[autocomplete^="cc-"]')).toHaveCount(0);
    await expect(page.locator("main").getByRole("button", { name: /pay|checkout|card/i })).toHaveCount(0);
    await expect(page.locator("main").getByRole("link", { name: /pay|checkout/i })).toHaveCount(0);
  });

  test("Arabic is right to left, and Spanish and Arabic carry their own words and the 06-05 phone label", async ({ page }) => {
    await page.goto(`/ar/journeys/${SLUG}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: textOf("ar").name })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: PACKAGE_PAGE_COPY.ar.reqHeading })).toBeVisible();
    await expect(page.getByRole("form", { name: PACKAGE_PAGE_COPY.ar.reqHeading }).getByLabel(PACKAGE_PAGE_COPY.ar.phone, { exact: false }).first()).toBeVisible();
    await page.goto(`/es/journeys/${SLUG}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 2, name: PACKAGE_PAGE_COPY.es.reqHeading })).toBeVisible();
  });

  test("an unknown package is a 404", async ({ page }) => {
    const response = await page.goto("/en/journeys/no-such-package");
    expect(response?.status()).toBe(404);
  });

  test("sent: the post carries Kind, Locale, the package and the traps; the line replaces the form and takes focus", async ({ page }) => {
    let sent = "";
    await page.route("**/api/requests", (route) => {
      sent = route.request().postData() ?? "";
      return reply(route, 200, { ok: true, emailed: true });
    });
    await page.goto(PATH);
    await fillContact(page);
    await fieldOf(page, copy.arrive).fill("2026-12-05");
    await fieldOf(page, copy.leave).fill("2026-12-12");
    await fieldOf(page, copy.guests).fill("2");
    await fieldOf(page, copy.notes).fill("Two of us");
    await page.getByRole("button", { name: copy.send, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: copy.sent })).toBeFocused();
    await expect(page.getByRole("button", { name: copy.send, exact: true })).toHaveCount(0);
    const body = new URLSearchParams(sent);
    expect(body.get(F.kind)).toBe("package");
    expect(body.get(F.locale)).toBe("en");
    expect(body.get(F.tier)).toBe(SLUG);
    expect(body.get(F.from)).toBe("2026-12-05");
    expect(body.get(F.to)).toBe("2026-12-12");
    expect(body.get(F.guests)).toBe("2");
    expect(body.get(F.notes)).toBe("Two of us");
    expect(body.get(F.name)).toBe("Ana");
    for (const trap of HONEYPOT_FIELDS) expect(body.get(trap), trap).toBe("");
  });

  test("errors: the browser's check puts each on its field, the first takes focus, nothing is posted", async ({ page }) => {
    let posts = 0;
    await page.route("**/api/requests", (route) => {
      posts += 1;
      return reply(route, 200, { ok: true });
    });
    await page.goto(PATH);
    await fieldOf(page, copy.arrive).fill("2026-12-12");
    await fieldOf(page, copy.leave).fill("2026-12-05");
    await fieldOf(page, copy.guests).fill("0");
    await fieldOf(page, copy.email).fill("guest@");
    await page.getByRole("button", { name: copy.send, exact: true }).click();
    await expect(page.getByText(copy.err.dates)).toBeVisible();
    await expect(page.getByText(copy.err.guests)).toBeVisible();
    await expect(page.getByText(copy.err.required)).toBeVisible();
    await expect(page.getByText(copy.err.email)).toBeVisible();
    await expect(fieldOf(page, copy.arrive)).toBeFocused();
    expect(posts).toBe(0);
  });

  test("a server refusal on a field lands on that field; what was typed stays", async ({ page }) => {
    await page.route("**/api/requests", (route) => reply(route, 400, { ok: false, errors: { email: "invalid" } }));
    await page.goto(PATH);
    await fillContact(page);
    await page.getByRole("button", { name: copy.send, exact: true }).click();
    await expect(page.getByText(copy.err.email)).toBeVisible();
    await expect(fieldOf(page, copy.email)).toBeFocused();
    await expect(fieldOf(page, copy.name)).toHaveValue("Ana");
  });

  test("429: the limited line, and no received line; the words stay", async ({ page }) => {
    await page.route("**/api/requests", (route) => reply(route, 429, { ok: false }));
    await page.goto(PATH);
    await fillContact(page);
    await page.getByRole("button", { name: copy.send, exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: copy.limited })).toBeVisible();
    await expect(page.getByText(copy.sent)).toHaveCount(0);
    await expect(fieldOf(page, copy.name)).toHaveValue("Ana");
  });

  for (const [what, answer] of [
    ["a 500", (route: Route) => reply(route, 500, { ok: false })],
    ["a refusal on no field of the form (a city the page no longer has)", (route: Route) => reply(route, 400, { ok: false, errors: { cities: "invalid" } })],
    ["no answer", (route: Route) => route.abort()],
  ] as const) {
    test(`${what}: the failed line, and no received line; the words stay`, async ({ page }) => {
      await page.route("**/api/requests", answer);
      await page.goto(PATH);
      await fillContact(page);
      await page.getByRole("button", { name: copy.send, exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: copy.failed })).toBeVisible();
      await expect(page.getByText(copy.sent)).toHaveCount(0);
      await expect(fieldOf(page, copy.email)).toHaveValue("ana@example.com");
    });
  }

  test("the WhatsApp line is a text link with the name and the page's own address", async ({ page }) => {
    await page.goto(PATH);
    const link = page.getByRole("link", { name: copy.wa });
    await expect(link).toHaveAttribute("target", "_blank");
    const href = (await link.getAttribute("href")) ?? "";
    expect(href.startsWith("https://wa.me/971563883302?text=")).toBe(true);
    const message = decodeURIComponent(href.slice(href.indexOf("=") + 1));
    expect(message).toContain(textOf("en").name);
    expect(message).toContain(PATH);
    expect(message).not.toMatch(/\$|USD|AED/);
  });
});

test.describe("Home card", () => {
  test("the heading and See this journey open the package page; See this journey is for a pointer only", async ({ page }) => {
    await page.goto("/en");
    const href = PATH;
    await expect(page.getByRole("link", { name: textOf("en").name, exact: true }).first()).toHaveAttribute("href", href);
    const open = page.locator('a[aria-hidden="true"][tabindex="-1"]', { hasText: HOME_PAGE_COPY.en.journeys.open }).first();
    await expect(open).toHaveAttribute("href", href);
  });
});
