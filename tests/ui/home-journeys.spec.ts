import { test, type Page } from "@playwright/test";
import { HOME_COPY } from "../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../lib/copy/home-page";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { formatDate } from "../../lib/format";
import { rewriteHomeAmounts, type SelectedCurrency } from "../../lib/fx/rates";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open, type Locale, type Viewport } from "./_helpers";

// Plan 03.3-04 Task 3: the priced tiers and the header currency control as components, with deterministic
// rates (the same numbers as tests/journey/scenes/home-journeys.tsx). Every expected text is computed by
// rewriteHomeAmounts from lib/fx/rates.ts; the published labels are read from lib/copy/home.ts.

const RATES = { aed: 3.6725, eur: 0.92, date: "2026-10-01" };
const LABELS = HOME_COPY.en.journeys.map((tier) => tier.price);
const CODES: SelectedCurrency[] = ["USD", "EUR", "AED"];

const nameOf = (locale: Locale, code: string) => JOURNEY_COPY[locale].locale.currency.replace("{code}", code);
const nothingChosen = (locale: Locale) => nameOf(locale, HOME_COPY[locale].nav.currency);

/** The currency control, opening the header menu first where the nav is collapsed (390 and 834). */
async function pick(page: Page, locale: Locale, from: string, to: SelectedCurrency) {
  const control = page.getByRole("combobox", { name: from });
  if (!(await control.isVisible())) {
    await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
  }
  await control.click();
  await page.getByRole("option", { name: to, exact: true }).click();
  await expect(page.getByRole("combobox", { name: nameOf(locale, to) })).toBeVisible();
}

const prices = (page: Page) => page.locator("[data-price]");
const priceTexts = (page: Page) => prices(page).evaluateAll((nodes) => nodes.map((node) => node.textContent));
const rest = (page: Page) =>
  page.locator("#journeys").evaluate((root) => {
    const copy = root.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("[data-price], [data-testid=rates-line]").forEach((node) => node.remove());
    return copy.textContent;
  });

for (const viewport of WIDTHS as Viewport[]) {
  for (const locale of LOCALES) {
    const where = `${locale} ${VIEWPORTS[viewport].width}`;

    test.describe(`Home journeys ${where}`, () => {
      test("with rates: before any choice the three prices are the published text, byte for byte", async ({ page }) => {
        await open(page, "home-journeys", "rates", locale, viewport);
        await expect(prices(page)).toHaveCount(3);
        expect(await priceTexts(page)).toEqual(LABELS);
        await expect(page.getByTestId("rates-line")).toHaveCount(0);
        const root = page.locator("#journeys");
        await expect(root).toHaveAttribute("data-fx-date", RATES.date);
        await expect(root).toHaveAttribute("data-fx-aed", String(RATES.aed));
        await expect(root).toHaveAttribute("data-fx-eur", String(RATES.eur));
      });

      test("USD, then EUR, then AED: each choice sets exactly the three prices; nothing else on the section moves", async ({
        page,
      }) => {
        await open(page, "home-journeys", "rates", locale, viewport);
        const before = await rest(page);
        let current = nothingChosen(locale);
        for (const code of CODES) {
          await pick(page, locale, current, code);
          current = nameOf(locale, code);
          expect(await priceTexts(page), `${code} (${where})`).toEqual(
            LABELS.map((label) => rewriteHomeAmounts(label, code, RATES, locale)),
          );
          expect(await rest(page), `rest of the section after ${code}`).toBe(before);
          await expect(page.getByTestId("rates-line")).toHaveText(
            HOME_PAGE_COPY[locale].journeys.ratesOf.replace("{date}", formatDate(1, 10, 2026)),
          );
        }
        if (locale === "ar") {
          for (const text of await priceTexts(page)) expect(text).not.toMatch(/[٠-٩]/);
        }
      });

      test("picking AED as the very first choice is a real change: all three prices move", async ({ page }) => {
        await open(page, "home-journeys", "rates", locale, viewport);
        await pick(page, locale, nothingChosen(locale), "AED");
        const moved = await priceTexts(page);
        expect(moved).toEqual(LABELS.map((label) => rewriteHomeAmounts(label, "AED", RATES, locale)));
        expect(moved).not.toEqual(LABELS);
        await expect(page.getByTestId("rates-line")).toBeVisible();
      });

      test("the last choice survives a reload", async ({ page }) => {
        await open(page, "home-journeys", "rates", locale, viewport);
        await pick(page, locale, nothingChosen(locale), "EUR");
        await page.reload();
        await expect(prices(page).first()).toHaveText(rewriteHomeAmounts(LABELS[0], "EUR", RATES, locale));
        expect(await priceTexts(page)).toEqual(LABELS.map((label) => rewriteHomeAmounts(label, "EUR", RATES, locale)));
        await expect(page.getByTestId("rates-line")).toBeVisible();
        expect(await page.evaluate(() => window.localStorage.getItem("almar-currency"))).toBe("EUR");
      });

      test("a tampered saved value is ignored: the published text stays", async ({ page }) => {
        await open(page, "home-journeys", "rates", locale, viewport);
        await page.evaluate(() => window.localStorage.setItem("almar-currency", "<img src=x onerror=alert(1)>"));
        await page.reload();
        await expect(prices(page)).toHaveCount(3);
        expect(await priceTexts(page)).toEqual(LABELS);
        await expect(page.getByTestId("rates-line")).toHaveCount(0);
      });

      test("with no rates there is no currency control and the labels are untouched", async ({ page }) => {
        await open(page, "home-journeys", "no-rates", locale, viewport);
        await expect(prices(page)).toHaveCount(3);
        expect(await priceTexts(page)).toEqual(LABELS);
        if (viewport !== "desktop") {
          await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
        }
        await expect(page.getByRole("combobox", { name: nothingChosen(locale) })).toHaveCount(0);
        // The language control is still there: only the currency control is absent.
        await expect(page.getByRole("combobox")).toHaveCount(1);
        const root = page.locator("#journeys");
        for (const name of ["data-fx-date", "data-fx-aed", "data-fx-eur"]) {
          await expect(root).not.toHaveAttribute(name, /.*/);
        }
        await expect(page.getByTestId("rates-line")).toHaveCount(0);
      });
    });
  }
}
