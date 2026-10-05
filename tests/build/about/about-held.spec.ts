import { expect, test, type Page } from "@playwright/test";
import { HOME_COPY } from "../../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../../lib/copy/home-page";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { localePath, type Locale } from "../../../lib/locale-path";
import { LOCALES, WIDTHS, open, openMenu, watch } from "../slice3-pages";

// Plan 03.3-25 Task 2: every control the About page holds back is absent, in all three languages at 390, 834 and 1440,
// after hydration and again with the Menu open. 27 contexts.
//   PW_PORT=<free 3041-3049> npx playwright test -c playwright.build.config.ts tests/build/about/about-held.spec.ts --workers=1
//
// The held list is ONE constant, so the plans that switch a control on revise one place:
//   plan 27 (newsletter) narrows the form, input and submit entries to "outside the footer" and changes the
//   newsletter entries (S3-7). Nothing here is deleted for it: an entry is asserted only while its control is held.
// The only <select> is the header's language select: a hidden native twin of the Select component, inside <header>.
// It is the language control that is rendered and tested (about.spec.ts), so the select entry is scoped to main and
// to the page outside the header.

const HELD_SELECTORS = [
  "form",
  "input",
  "textarea",
  "main select",
  'button[type="submit"]',
  "[role=search]",
  "video",
] as const;

const CART = /\bcart\b|carrito|عربة|سلة/i;
const PACKAGES = /packages|paquetes|الباقات|باقات/i;

async function assertHeld(page: Page, locale: Locale, where: string) {
  const nav = HOME_COPY[locale].nav;
  for (const selector of HELD_SELECTORS) await expect(page.locator(selector), `${where}: ${selector}`).toHaveCount(0);
  const strays = await page.locator("select").evaluateAll((els) => els.filter((el) => !el.closest("header")).length);
  expect(strays, `${where}: select outside the header`).toBe(0);
  await expect(page.getByRole("group", { name: HOME_PAGE_COPY[locale].hero.barLabel }), where).toHaveCount(0);
  await expect(page.getByRole("button", { name: JOURNEY_COPY[locale].bar.search }), where).toHaveCount(0);
  for (const name of [nav.login, HOME_COPY[locale].subscribe, HOME_COPY[locale].listTitle]) {
    await expect(page.getByRole("link", { name, exact: true }), `${where}: ${name}`).toHaveCount(0);
    await expect(page.getByRole("button", { name, exact: true }), `${where}: ${name}`).toHaveCount(0);
  }
  await expect(page.getByRole("link", { name: CART }), where).toHaveCount(0);
  await expect(page.getByRole("button", { name: CART }), where).toHaveCount(0);
  await expect(page.getByRole("link", { name: PACKAGES }), where).toHaveCount(0);
  await expect(page.getByRole("textbox"), `${where}: any textbox (newsletter Email)`).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^(Currency|العملة|Moneda)/ }), where).toHaveCount(0);
  expect(await page.locator("body").innerText(), `${where}: partnerships@`).not.toContain("partnerships@");
  // One photo, no slideshow dots: the hero holds one img and no button.
  const hero = page.locator("main > section").first();
  await expect(hero.locator("img"), where).toHaveCount(1);
  await expect(hero.locator("button"), where).toHaveCount(0);
}

test.setTimeout(90_000);

for (const locale of LOCALES) {
  for (const { width, height } of WIDTHS) {
    const where = `${locale} ${width}`;
    test(`About holds back its held controls (${where})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const watched = await watch(page);
      await open(page, localePath(locale, "/about"));
      await assertHeld(page, locale, `${where} loaded`);
      await openMenu(page, locale, width);
      await assertHeld(page, locale, `${where} menu open`);
      expect(watched.problems).toEqual([]);
    });
  }
}
