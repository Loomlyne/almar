import { expect, test, type Page } from "@playwright/test";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import { localePath, type Locale } from "../../../lib/locale-path";
import { routeMedia } from "../../helpers/media-route";

// 3.3 integration fixes, item d: what the shared PublicFrame does in a browser on the assembled site.
//  1. the logo goes to this language's home ("/", "/ar/", "/es/"), never to the page's own address
//  2. the footer prints the phone as designed and dials the digits
//  3. the currency select is controlled by the page's own saved choice (the home), and absent where a page has no amount
//  4. the WhatsApp float is not drawn on a stay page (plan 45: the request button is the one WhatsApp control) and sits at the corner elsewhere
//  5. (item f) the footer reads one table: the home, the list and a stay page print the same footer text in a language

const LOCALES: Locale[] = ["en", "ar", "es"];
const SIZES = [
  { width: 390, height: 844 },
  { width: 834, height: 1194 },
  { width: 1440, height: 900 },
] as const;
const STAY = "/private-stays/getsemani-colonial-house";
const HOMES: Record<Locale, string> = { en: "/", ar: "/ar/", es: "/es/" };

const logo = (page: Page) => page.getByRole("link", { name: "ALMAR Private Journeys home" });
const nameOfCurrency = (locale: Locale, value: string) => JOURNEY_COPY[locale].locale.currency.replace("{code}", value);

async function openMenuIfCollapsed(page: Page, locale: Locale) {
  const menu = page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true });
  if (await menu.isVisible()) await menu.click();
}

for (const locale of LOCALES) {
  for (const size of SIZES) {
    const where = `${locale} @${size.width}`;
    test.describe(`PublicFrame ${where}`, () => {
      test.use({ viewport: size });

      for (const [name, path] of [["list page", "/private-stays"], ["stay page", STAY]] as const) {
        test(`1 the logo on the ${name} goes to the language's home, with no redirect (${where})`, async ({ page }) => {
          const media = await routeMedia(page);
          const redirects: string[] = [];
          page.on("response", (response) => {
            if (response.request().isNavigationRequest() && response.status() >= 300 && response.status() < 400) {
              redirects.push(`${response.status()} ${response.url()}`);
            }
          });
          const here = localePath(locale, path);
          await page.goto(here);
          const link = logo(page);
          await expect(link).toHaveCount(1);
          await expect(link).toHaveAttribute("href", HOMES[locale]);
          await link.click();
          await page.waitForURL((url) => url.pathname === HOMES[locale]);
          expect(new URL(page.url()).pathname).toBe(HOMES[locale]);
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          expect(redirects, "the click and the landing cost no redirect").toEqual([]);
          expect(media.missing).toEqual([]);
        });
      }

      for (const [name, path] of [["home", HOMES[locale]], ["list page", localePath(locale, "/private-stays")], ["stay page", localePath(locale, STAY)]] as const) {
        test(`2 the footer on the ${name} shows +971 56 388 3302 and dials +971563883302 (${where})`, async ({ page }) => {
          await routeMedia(page);
          await page.goto(path);
          const phone = page.locator('footer a[href^="tel:"]');
          await expect(phone).toHaveCount(1);
          await expect(phone).toHaveAttribute("href", "tel:+971563883302");
          await expect(phone).toHaveText("+971 56 388 3302");
          // The number reads left to right in every language: "+" is left of the final "2" (plan 41; in Arabic it was backwards).
          const order = await phone.evaluate((node) => {
            const text = node.firstChild as Text;
            const rect = (index: number) => {
              const range = document.createRange();
              range.setStart(text, index);
              range.setEnd(text, index + 1);
              return range.getBoundingClientRect().left;
            };
            return { plus: rect(0), last: rect(text.length - 1), dir: getComputedStyle(node).direction };
          });
          expect(order.dir).toBe("ltr");
          expect(order.plus).toBeLessThan(order.last);
        });
      }

      test(`3 the list and stay pages have no currency select; the home's is bound to its saved choice (${where})`, async ({ page }) => {
        await routeMedia(page);
        for (const path of [localePath(locale, "/private-stays"), localePath(locale, STAY)]) {
          await page.goto(path);
          await openMenuIfCollapsed(page, locale);
          // The only listbox control in the header is the language select.
          await expect(page.locator('header [role="combobox"]')).toHaveCount(1);
          await expect(page.getByRole("combobox", { name: nameOfCurrency(locale, HOME_COPY[locale].nav.currency) })).toHaveCount(0);
        }

        await page.goto(HOMES[locale]);
        const rates = page.locator("#journeys");
        if ((await rates.getAttribute("data-fx-date")) === null) {
          test.info().annotations.push({ type: "currency", description: "rates unavailable at build" });
          return;
        }
        await openMenuIfCollapsed(page, locale);
        const none = page.getByRole("combobox", { name: nameOfCurrency(locale, HOME_COPY[locale].nav.currency) });
        await expect(none).toBeVisible();
        await none.click();
        // The published prices are in USD, so EUR is a change the prices must show.
        await page.getByRole("option", { name: "EUR", exact: true }).click();
        // Value: the select now reads EUR. onChange: the same choice was saved and the prices use it.
        await expect(page.getByRole("combobox", { name: nameOfCurrency(locale, "EUR") })).toBeVisible();
        expect(await page.evaluate(() => window.localStorage.getItem("almar-currency"))).toBe("EUR");
        const prices = await page.locator("[data-price]").evaluateAll((nodes) => nodes.map((n) => n.textContent ?? ""));
        expect(prices).toHaveLength(3);
        for (const text of prices) expect(text).toContain("EUR");
        // A reload starts from the saved choice: the select is controlled by it, not by a private state.
        await page.reload();
        await openMenuIfCollapsed(page, locale);
        await expect(page.getByRole("combobox", { name: nameOfCurrency(locale, "EUR") })).toBeVisible();
      });

      test(`5 the footer text is the one table's on the home, the list page and a stay page (${where})`, async ({ page }) => {
        await routeMedia(page);
        const texts: string[] = [];
        for (const path of [HOMES[locale], localePath(locale, "/private-stays"), localePath(locale, STAY)]) {
          await page.goto(path);
          const footer = page.locator("footer");
          await expect(footer).toHaveCount(1);
          const copy = SITE_FOOTER_COPY[locale];
          await expect(footer).toContainText(copy.copyright);
          await expect(footer.getByRole("navigation", { name: copy.pages })).toBeVisible();
          await expect(footer.getByRole("navigation", { name: copy.language })).toBeVisible();
          await expect(footer.getByRole("link", { name: `${copy.instagram} ${copy.newTab}` })).toHaveCount(1);
          await expect(footer.locator("address")).toContainText(copy.contact);
          await expect(footer.getByRole("img", { name: copy.brand })).toHaveCount(1);
          await expect(footer).toContainText(copy.madeBy);
          await expect(footer).toContainText("Koussay");
          texts.push(await footer.innerText());
        }
        expect(texts[1], "list page footer text equals the home's").toBe(texts[0]);
        expect(texts[2], "stay page footer text equals the home's").toBe(texts[0]);
      });

      test(`6 Made by Koussay opens https://koussay.com in a new tab (${where})`, async ({ page }) => {
        await routeMedia(page);
        // Nothing leaves this Mac: the one external request is answered here.
        const external: string[] = [];
        await page.context().route("https://koussay.com/**", async (route) => {
          external.push(route.request().url());
          await route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" });
        });
        for (const path of [HOMES[locale], localePath(locale, "/private-stays"), localePath(locale, STAY)]) {
          await page.goto(path);
          const copy = SITE_FOOTER_COPY[locale];
          const link = page.locator("footer").getByRole("link", { name: `Koussay ${copy.newTab}` });
          await expect(link).toHaveCount(1);
          await expect(link).toHaveAttribute("href", "https://koussay.com");
          await expect(link).toHaveAttribute("target", "_blank");
          await expect(link).toHaveAttribute("rel", /noopener/);
          const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
          await popup.waitForLoadState("domcontentloaded");
          expect(popup.url()).toMatch(/^https:\/\/koussay\.com\/?$/);
          await popup.close();
        }
        expect(external.length).toBe(3);
      });

      test(`7 the footer is light: ivory ground, the diamond is a gold outline and never a fill (${where})`, async ({ page }) => {
        await routeMedia(page);
        for (const path of [HOMES[locale], localePath(locale, "/private-stays"), localePath(locale, STAY)]) {
          await page.goto(path);
          const footer = page.locator("footer");
          const look = await footer.evaluate((node) => {
            const diamond = node.querySelector('[aria-hidden="true"] > span.rotate-45') as HTMLElement;
            const style = getComputedStyle(diamond);
            return {
              ground: getComputedStyle(node).backgroundColor,
              diamondBorder: style.borderTopColor,
              diamondWidth: style.borderTopWidth,
              diamondFill: style.backgroundColor,
              line: getComputedStyle(diamond.previousElementSibling as HTMLElement).backgroundColor,
            };
          });
          expect(look.ground, "ivory token").toBe("rgb(255, 250, 240)");
          expect(look.diamondBorder, "gold token").toBe("rgb(212, 186, 138)");
          expect(look.diamondWidth).toBe("1px");
          expect(look.diamondFill, "ivory centre, never gold").toBe("rgb(255, 250, 240)");
          expect(look.line, "teal-tint token").toBe("rgb(209, 223, 224)");
        }
      });

      test(`4 the WhatsApp float: none on a stay page (the request button is the one), at the corner on the list page (${where})`, async ({ page }) => {
        await routeMedia(page);
        await page.goto(localePath(locale, STAY));
        // 11-DESIGN section 1: one WhatsApp button on a stay page. The green float is not drawn; the request link is.
        await expect(page.locator('a[aria-label="WhatsApp"]')).toHaveCount(0);
        await expect(page.locator('a[href^="https://wa.me/971563883302?text="]').first()).toBeAttached();

        await page.goto(localePath(locale, "/private-stays"));
        const corner = page.getByRole("link", { name: "WhatsApp" });
        await expect(corner).toHaveCount(1);
        await expect(corner).not.toHaveClass(/\bbottom-dock\b/);
        expect(await corner.evaluate((node) => parseFloat(getComputedStyle(node).bottom))).toBe(16);
      });
    });
  }
}
