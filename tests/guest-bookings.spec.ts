import { expect, test, type Page } from "@playwright/test";
import { GUEST_BOOKINGS_COPY } from "../lib/copy/guest-bookings";
import { GUEST_COPY } from "../lib/copy/guest";
import { JOURNEY_COPY } from "../lib/copy/journey";
import { VIEWPORTS, settle, type Viewport } from "./journey/matrix";

// Plan 04-06 (Tasks 1b and 4): the signed-in guest's /<locale>/bookings list on its harness scene
// (tests/journey/scenes/guest-bookings.tsx, symbolic cards), plus the real page's signed-out redirect on next dev.
// Signed by the owner 2026-10-27 from one HTML page (pictures/04-06/index.html): P6-07 option 1 (a Paid line on cards
// with a payment), P6-09 option 1 (a trip under way stays Upcoming until its departure day).
//
// No pictures block: owner rule (2026-10-27) "no pictures shoot", the signed HTML page is the record.
// Owner rule (2026-10-21, "No test. Direct, no test."): written, not run by the executor.

type Locale = "en" | "ar" | "es";
const LOCALES: Locale[] = ["en", "ar", "es"];

const harnessUrl = (state: string, locale: Locale) => `/__harness?c=guest-bookings&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, locale: Locale, viewport: Viewport = "desktop") {
  await page.setViewportSize(VIEWPORTS[viewport]);
  // The dev server can answer 500 once while webpack rewrites a manifest: load the scene again.
  const first = await page.goto(harnessUrl(state, locale));
  if (!first || first.status() >= 500) await page.goto(harnessUrl(state, locale));
  await settle(page);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

const tablist = (page: Page) => page.getByRole("tablist");
const tab = (page: Page, locale: Locale, key: "upcoming" | "past" | "cancelled") =>
  page.getByRole("tab", { name: GUEST_BOOKINGS_COPY[locale][key], exact: true });
const panel = (page: Page) => page.getByRole("tabpanel");
const cards = (page: Page) => panel(page).locator("article");

// ---- copy ---------------------------------------------------------------------------------------------------------

test("copy: every list label is a non-empty string in en, ar and es, with no status or payBy key", () => {
  const keys = Object.keys(GUEST_BOOKINGS_COPY.en).sort();
  for (const locale of LOCALES) {
    expect(Object.keys(GUEST_BOOKINGS_COPY[locale]).sort(), `${locale} keys`).toEqual(keys);
    for (const [key, value] of Object.entries(GUEST_BOOKINGS_COPY[locale])) {
      expect(typeof value, `${locale}.${key}`).toBe("string");
      expect((value as string).trim(), `${locale}.${key} empty`).not.toBe("");
      expect(value as string, `${locale}.${key}`).not.toMatch(/\[object|undefined|NaN/);
    }
    expect(Object.hasOwn(GUEST_BOOKINGS_COPY[locale], "status"), locale).toBe(false);
    expect(Object.hasOwn(GUEST_BOOKINGS_COPY[locale], "payBy"), locale).toBe(false);
  }
});

// ---- behaviour on the harness scene -------------------------------------------------------------------------------

test.describe("behaviour", () => {
  test("empty: today's empty state, no tabs, Start a trip goes home in the page's language", async ({ page }) => {
    for (const locale of LOCALES) {
      await openScene(page, "empty", locale);
      await expect(page.getByRole("heading", { level: 1, name: GUEST_COPY[locale].bookings })).toBeVisible();
      await expect(page.getByText(GUEST_COPY[locale].noBookingsYet, { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: GUEST_COPY[locale].startATrip, exact: true })).toHaveAttribute("href", `/${locale}/`);
      await expect(tablist(page)).toHaveCount(0);
    }
  });

  test("tabs: Upcoming open first; click and arrow keys switch the one panel; aria-selected follows", async ({ page }) => {
    await openScene(page, "upcoming", "en");
    await expect(tablist(page)).toHaveAttribute("aria-label", GUEST_BOOKINGS_COPY.en.tabsLabel);
    await expect(page.getByRole("tab")).toHaveCount(3);
    await expect(panel(page)).toHaveCount(1);
    await expect(tab(page, "en", "upcoming")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "en", "past")).toHaveAttribute("aria-selected", "false");
    await expect(cards(page)).toHaveCount(5);
    for (const key of ["upcoming", "past", "cancelled"] as const) {
      await expect(tab(page, "en", key)).toHaveAttribute("aria-controls", "bookings-panel");
    }

    await tab(page, "en", "past").click();
    await expect(tab(page, "en", "past")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "en", "upcoming")).toHaveAttribute("aria-selected", "false");
    await expect(panel(page)).toHaveAttribute("aria-labelledby", "bookings-tab-past");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText(JOURNEY_COPY.en.bookingStatus.completed);

    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "en", "cancelled")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "en", "cancelled")).toBeFocused();
    await expect(cards(page)).toHaveCount(2);
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "en", "upcoming")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "en", "cancelled")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tab(page, "en", "upcoming")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tab(page, "en", "cancelled")).toHaveAttribute("aria-selected", "true");
    // Only the selected tab is a Tab stop.
    await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  });

  test("tabs in Arabic: dir=rtl and the arrow keys follow the reading direction", async ({ page }) => {
    await openScene(page, "upcoming", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await tab(page, "ar", "upcoming").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "ar", "past")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "ar", "upcoming")).toHaveAttribute("aria-selected", "true");
  });

  test("cards: chip words are JOURNEY_COPY.bookingStatus; a lapsed request sits in Cancelled (P6-08)", async ({ page }) => {
    for (const locale of LOCALES) {
      await openScene(page, "cancelled", locale);
      await tab(page, locale, "cancelled").click();
      await expect(cards(page)).toHaveCount(2);
      await expect(cards(page).nth(0)).toContainText(JOURNEY_COPY[locale].bookingStatus.cancelled);
      await expect(cards(page).nth(1)).toContainText(JOURNEY_COPY[locale].bookingStatus.expired);
    }
    await openScene(page, "upcoming", "en");
    const words = JOURNEY_COPY.en.bookingStatus;
    const expected = [words.awaiting_payment, words.awaiting_payment, words.deposit_paid, words.paid_in_full, words.confirmed];
    for (const [i, word] of expected.entries()) await expect(cards(page).nth(i)).toContainText(word);
  });

  test("cards: every View trip link is /<locale>/bookings/trip?ref=<ref> with no token", async ({ page }) => {
    for (const locale of LOCALES) {
      await openScene(page, "upcoming-with-paid", locale);
      for (const key of ["upcoming", "past", "cancelled"] as const) {
        await tab(page, locale, key).click();
        const hrefs = await panel(page)
          .getByRole("link", { name: GUEST_BOOKINGS_COPY[locale].viewTrip, exact: true })
          .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
        expect(hrefs.length, `${locale} ${key}`).toBeGreaterThan(0);
        for (const href of hrefs) {
          expect(href).toMatch(new RegExp(`^/${locale}/bookings/trip\\?ref=ALMAR-[0-9A-Z]{6}$`));
          expect(href).not.toMatch(/[?&]t=/);
        }
      }
    }
  });

  test("cards: Paid only on cards with a payment (P6-07 option 1); Still due or Nothing left to pay; Pay by while awaiting", async ({ page }) => {
    const c = GUEST_BOOKINGS_COPY.en;
    const payBy = JOURNEY_COPY.en.bookingStatus.payBy.split("{date}")[0].trim();
    await openScene(page, "upcoming-with-paid", "en");
    await expect(cards(page)).toHaveCount(5);
    // awaiting (nothing paid), awaiting (part paid), deposit paid, paid in full, confirmed
    const shows = async (i: number, label: string) => (await cards(page).nth(i).getByText(label, { exact: true }).count()) > 0;
    const row = async (label: string) => Promise.all([0, 1, 2, 3, 4].map((i) => shows(i, label)));
    expect(await row(c.paid)).toEqual([false, true, true, true, true]);
    expect(await row(c.stillDue)).toEqual([true, true, true, false, false]);
    expect(await row(c.nothingDue)).toEqual([false, false, false, true, true]);
    expect(await row(c.total)).toEqual([true, true, true, true, true]);
    const texts = await cards(page).allInnerTexts();
    expect(texts.map((t) => t.includes(payBy))).toEqual([true, true, false, false, false]);

    await openScene(page, "upcoming", "en");
    await expect(cards(page).getByText(c.paid, { exact: true })).toHaveCount(0);
  });

  test("cards: amounts, dates, references and the pay-by day and time sit in <bdi dir=ltr>", async ({ page }) => {
    await openScene(page, "upcoming-with-paid", "ar");
    const first = cards(page).first();
    const bdi = await first.locator('bdi[dir="ltr"]').allInnerTexts();
    expect(bdi).toEqual(expect.arrayContaining(["ALMAR-7K3QH9", "[DD/MM/YYYY] – [DD/MM/YYYY]", "AED [AMOUNT]", "[DD/MM/YYYY]", "[HH:MM]"]));
    // The reference has a visually hidden label.
    await expect(first.locator(".sr-only")).toContainText(GUEST_BOOKINGS_COPY.ar.reference);
  });

  test("cards: a card without a photo draws the teal-tint block and no image", async ({ page }) => {
    await openScene(page, "upcoming", "en");
    const confirmed = cards(page).nth(4);
    await expect(confirmed.locator("img")).toHaveCount(0);
    await expect(confirmed.locator(".bg-teal-tint")).toHaveCount(1);
    await expect(cards(page).first().locator("img")).toHaveCount(1);
  });

  test("a trip under way stays under Upcoming (P6-09 option 1)", async ({ page }) => {
    await openScene(page, "upcoming-in-progress", "en");
    await expect(cards(page)).toHaveCount(6);
    await expect(cards(page).last()).toContainText("[started DD/MM/YYYY] – [ends DD/MM/YYYY]");
    await tab(page, "en", "past").click();
    await expect(panel(page)).not.toContainText("[started DD/MM/YYYY]");
  });

  test("tab-empty: a tab with nothing in it shows its one line", async ({ page }) => {
    for (const locale of LOCALES) {
      await openScene(page, "tab-empty", locale);
      await expect(tab(page, locale, "upcoming")).toHaveAttribute("aria-selected", "true");
      await expect(cards(page)).toHaveCount(0);
      await expect(panel(page)).toHaveText(GUEST_BOOKINGS_COPY[locale].emptyUpcoming);
      await tab(page, locale, "cancelled").click();
      await expect(panel(page)).toHaveText(GUEST_BOOKINGS_COPY[locale].emptyCancelled);
      await tab(page, locale, "past").click();
      await expect(cards(page)).toHaveCount(1);
    }
  });

  test("error: the line and a secondary Try again that refreshes the page from the server", async ({ page }) => {
    await openScene(page, "error", "en");
    await expect(page.getByText(GUEST_BOOKINGS_COPY.en.loadFailed, { exact: true })).toBeVisible();
    await expect(tablist(page)).toHaveCount(0);
    const refresh = page.waitForRequest((request) => request.headers()["rsc"] === "1");
    await page.getByRole("button", { name: GUEST_BOOKINGS_COPY.en.tryAgain, exact: true }).click();
    await refresh;
  });

  test("nobody is charged on the list: no Pay button and no payment frame", async ({ page }) => {
    await openScene(page, "upcoming-with-paid", "en");
    await expect(page.getByRole("button", { name: /^Pay/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Pay/ })).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("390, 834 and 1440 have no horizontal scroll in en, ar and es", async ({ page }) => {
    for (const viewport of ["phone", "tablet", "desktop"] as const) {
      for (const locale of LOCALES) {
        await openScene(page, "upcoming-in-progress", locale, viewport);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${viewport} ${locale}`).toBeLessThanOrEqual(0);
      }
    }
  });
});

// ---- the real page on next dev ------------------------------------------------------------------------------------

test.describe("signed out", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/bookings signed out redirects to /${locale}/login?return=bookings`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(`/${locale}/bookings`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?return=bookings$`));
    });
  }
});
