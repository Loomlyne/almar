import { expect, test, type Page } from "@playwright/test";
import { CONTACT_PAGE_COPY } from "../../../lib/copy/contact-page";
import { HOME_COPY } from "../../../lib/copy/home";
import { expectFooterNewsletter } from "../newsletter/_footer";
import { HOME_PAGE_COPY } from "../../../lib/copy/home-page";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { getTeam } from "../../../lib/data/team";
import { localePath, type Locale } from "../../../lib/locale-path";
import { LOCALES, WIDTHS, open, openMenu, watch } from "../slice3-pages";

// Plan 03.3-25 Task 3: every control the Contact page holds back is absent, in all three languages at 390, 834 and 1440,
// after hydration and again with the Menu open. 27 contexts.
//   PW_PORT=<free 3041-3049> npx playwright test -c playwright.build.config.ts tests/build/contact/contact-held.spec.ts --workers=1
//
// A held control is asserted absent only while it is held. The held list is ONE constant:
//   plan 26 (the form, `Start Your Inquiry`, `#inquiry`, and the move of Travel With Confidence below) revised this file
//   first: with JavaScript on, the form, field and submit entries now count only OUTSIDE `#inquiry` (the form box is
//   tests/build/contact-form/'s), and with JavaScript off the form box, `#inquiry` and Start Your Inquiry are absent
//   (FORM_SELECTORS, a JavaScript-off context per page);
//   plan 27 (the newsletter) then narrows what is left of the form, input and submit entries to "outside the footer"
//   and changes the newsletter entries (S3-7, S3-8).
// The <select>s are the header's language select and, inside `#inquiry`, the Journey Type's: hidden native twins of
// the Select component. Both are rendered and tested elsewhere, so the select entry counts only outside them.

const HELD_SELECTORS = ["main select", "[role=search]", "video"] as const;

/** Held with JavaScript off (the form box exists only after hydration); with JavaScript on, held outside #inquiry. */
const FORM_SELECTORS = ["form", "input", "textarea", "select", 'button[type="submit"]', "#inquiry", 'a[href="#inquiry"]'] as const;

// "Start Your Inquiry": plan 26's copy key, plus the forms the earlier pictures drew. Absent with JavaScript off.
const START_YOUR_INQUIRY = /start your inquiry|ابدأ استفسارك|ابدؤوا استفساركم|ابدأوا استفساركم|inicia tu consulta|comienza tu consulta/i;
const CART = /\bcart\b|carrito|عربة|سلة/i;
const PACKAGES = /packages|paquetes|الباقات|باقات/i;
const LIST_WITH_US = /list with us/i;

async function assertHeld(page: Page, locale: Locale, where: string) {
  const heldSelectors = HELD_SELECTORS.map((s) => (s === "main select" ? "main select:not(#inquiry select)" : s));
  for (const selector of heldSelectors) await expect(page.locator(selector), `${where}: ${selector}`).toHaveCount(0);
  const strays = await page.locator("select").evaluateAll((els) => els.filter((el) => !el.closest("header") && !el.closest("#inquiry")).length);
  expect(strays, `${where}: select outside the header and the form box`).toBe(0);
  // Plan 26: the form's controls exist only inside #inquiry (the box itself and Start Your Inquiry are checked in
  // tests/build/contact-form/). design 11.2 (plan 27): the newsletter is live in the footer, so the footer's own form,
  // box, traps and submit are not counted here; expectFooterNewsletter checks them below.
  await expectFooterNewsletter(page, locale, where);
  const outside = await page.evaluate(
    (selectors) =>
      selectors.flatMap((s) => [...document.querySelectorAll(s)].filter((el) => !el.closest("#inquiry") && !el.closest("footer")).map(() => s)),
    FORM_SELECTORS.filter((s) => s !== "#inquiry" && s !== 'a[href="#inquiry"]' && s !== "select"),
  );
  expect(outside, `${where}: a form control outside #inquiry`).toEqual([]);
  await expect(page.getByRole("group", { name: HOME_PAGE_COPY[locale].hero.barLabel }), where).toHaveCount(0);
  await expect(page.getByRole("button", { name: JOURNEY_COPY[locale].bar.search }), where).toHaveCount(0);
  // Job 21 (owner, 2026-10-21, decision #5): Login is live (the header's last item), so it is no longer asserted absent.
  for (const name of [HOME_COPY[locale].subscribe, HOME_COPY[locale].listTitle]) {
    await expect(page.getByRole("link", { name, exact: true }), `${where}: ${name}`).toHaveCount(0);
    await expect(page.getByRole("button", { name, exact: true }), `${where}: ${name}`).toHaveCount(0);
  }
  // design 11.2: the newsletter is live in the footer: its Email box is the one textbox outside #inquiry.
  await expect(page.locator("footer").getByRole("textbox"), `${where}: the footer textbox (newsletter Email)`).toHaveCount(1);
  expect(await page.getByRole("textbox").count(), `${where}: a textbox outside #inquiry and the footer`).toBe(
    (await page.locator("#inquiry").getByRole("textbox").count()) + 1,
  );
  await expect(page.getByRole("link", { name: CART }), where).toHaveCount(0);
  await expect(page.getByRole("button", { name: CART }), where).toHaveCount(0);
  await expect(page.getByRole("link", { name: PACKAGES }), where).toHaveCount(0);
  await expect(page.getByText(LIST_WITH_US), where).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^(Currency|العملة|Moneda)/ }), where).toHaveCount(0);
  expect(await page.locator("body").innerText(), `${where}: partnerships@`).not.toContain("partnerships@");
  // getTeam is [] today: no team heading, no member name.
  expect(await getTeam(locale)).toEqual([]);
}

test.setTimeout(90_000);

for (const locale of LOCALES) {
  for (const { width, height } of WIDTHS) {
    const where = `${locale} ${width}`;
    test(`Contact holds back its held controls (${where})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const watched = await watch(page);
      await open(page, localePath(locale, "/contact"));
      await assertHeld(page, locale, `${where} loaded`);
      await openMenu(page, locale, width);
      await assertHeld(page, locale, `${where} menu open`);
      expect(watched.problems).toEqual([]);
    });

    test(`Contact with JavaScript off shows no form and no Start Your Inquiry (${where})`, async ({ browser }) => {
      const off = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height } });
      try {
        const page = await off.newPage();
        const res = await page.goto(localePath(locale, "/contact"), { waitUntil: "load" });
        expect(res?.status()).toBe(200);
        for (const selector of FORM_SELECTORS) {
          const count = await page.locator(selector).evaluateAll((els) => els.filter((el) => !el.closest("header")).length);
          expect(count, `${where} JavaScript off: ${selector}`).toBe(0);
        }
        await expect(page.getByText(CONTACT_PAGE_COPY[locale].startInquiry, { exact: true })).toHaveCount(0);
        await expect(page.getByText(START_YOUR_INQUIRY)).toHaveCount(0);
        await expect(page.getByText(CONTACT_PAGE_COPY[locale].form.submit, { exact: true })).toHaveCount(0);
      } finally {
        await off.close();
      }
    });
  }
}
