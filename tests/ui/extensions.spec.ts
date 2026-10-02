import { test, type Page } from "@playwright/test";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open } from "./_helpers";

// Seven extensions to existing components, proven in the browser at 390, 834 and 1440 in EN, AR and ES.

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    const where = `${locale} ${VIEWPORTS[viewport].width}`;

    test.describe(`LocaleSelect ${where}`, () => {
      test("with hrefs, choosing the Arabic row navigates to hrefs.ar and remembers it in the cookie", async ({ page }) => {
        await open(page, "locale-select", "hrefs", locale, viewport);
        await page.getByRole("combobox", { name: /^Language:/ }).click();
        await page.getByRole("option", { name: "العربية" }).click();
        await page.waitForURL(/c=_smoke.*l=ar/);
        const cookies = await page.context().cookies();
        expect(cookies.find((c) => c.name === "almar-locale")?.value).toBe("ar");
      });

      test("with hrefs, choosing Spanish goes to hrefs.es", async ({ page }) => {
        await open(page, "locale-select", "hrefs", locale, viewport);
        await page.getByRole("combobox", { name: /^Language:/ }).click();
        await page.getByRole("option", { name: "Español" }).click();
        await page.waitForURL(/c=_smoke.*l=es/);
      });

      test("without hrefs the URL does not change and the page language switches in place", async ({ page }) => {
        await open(page, "locale-select", "no-hrefs", locale, viewport);
        const before = page.url();
        await page.getByRole("combobox", { name: /^Language:/ }).click();
        await page.getByRole("option", { name: "العربية" }).click();
        await expect(page.locator("html")).toHaveAttribute("lang", "ar");
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        expect(page.url()).toBe(before);
        await expect(page.getByTestId("language-value")).toHaveText("ar");
      });

      test("an off-site or protocol-relative href is ignored (T-3.3-04)", async ({ page }) => {
        await open(page, "locale-select", "bad-hrefs", locale, viewport);
        const before = page.url();
        await page.getByRole("combobox", { name: /^Language:/ }).click();
        await page.getByRole("option", { name: "العربية" }).click();
        await page.getByRole("combobox", { name: /^Language:/ }).click();
        await page.getByRole("option", { name: "Español" }).click();
        expect(page.url()).toBe(before);
      });

      test("currency with no choice yet shows the placeholder; choosing AED is a real change", async ({ page }) => {
        await open(page, "locale-select", "currency-none", locale, viewport);
        const trigger = page.getByRole("combobox", { name: /^Currency:/ });
        await expect(trigger).toContainText("[Currency]");
        await trigger.click();
        await expect(page.getByRole("listbox").locator("svg")).toHaveCount(0);
        await page.getByRole("option", { name: "AED" }).click();
        await expect(page.getByTestId("currency-value")).toHaveText("AED");
        await expect(page.getByTestId("currency-calls")).toHaveText("1");
      });

      test("a chosen currency re-chosen is not a change", async ({ page }) => {
        await open(page, "locale-select", "currency-aed", locale, viewport);
        await page.getByRole("combobox").click();
        await page.getByRole("option", { name: "AED" }).click();
        await expect(page.getByTestId("currency-calls")).toHaveText("0");
      });
    });

    test.describe(`SiteNav ${where}`, () => {
      const menu = async (page: Page) => {
        if (viewport !== "desktop") await page.getByRole("button", { name: "Menu" }).click();
      };

      test("defaults: today's anchors, first link current, Login and both selects present", async ({ page }) => {
        await open(page, "site-nav", "defaults", locale, viewport);
        await expect(page.locator('header a[aria-current="page"]')).toHaveCount(1);
        await expect(page.locator('nav[aria-label="Primary"] a').first()).toHaveAttribute("href", "#destinations");
        await expect(page.locator("header a", { hasText: "Login" })).toHaveCount(1);
        await expect(page.locator("header [role=combobox]")).toHaveCount(2);
      });

      test("each link goes to its href; exactly one is current when the path matches", async ({ page }) => {
        await open(page, "site-nav", "page", locale, viewport);
        await expect(page.locator('header a[aria-current="page"]')).toHaveCount(1);
        for (const name of ["destinations", "experiences", "about", "contact"]) {
          await open(page, "site-nav", "page", locale, viewport);
          await menu(page);
          await page.getByRole("link", { name: `[${name}]` }).click();
          await expect(page).toHaveURL(new RegExp(`s=nav-${name}`));
        }
      });

      test("the wordmark goes to homeHref", async ({ page }) => {
        await open(page, "site-nav", "page", locale, viewport);
        await page.getByRole("link", { name: "ALMAR Private Journeys home" }).click();
        await expect(page).toHaveURL(/s=home/);
      });

      test("a page that is not in the nav marks nothing current", async ({ page }) => {
        await open(page, "site-nav", "not-in-nav", locale, viewport);
        await expect(page.locator('header a[aria-current="page"]')).toHaveCount(0);
      });

      test("login={false} has no Login link and currency={false} has no currency select", async ({ page }) => {
        await open(page, "site-nav", "page", locale, viewport);
        await expect(page.locator("header a", { hasText: "Login" })).toHaveCount(0);
        await expect(page.locator("header [role=combobox]")).toHaveCount(1);
        await expect(page.locator("header [role=combobox][aria-label*=Currency], header [role=combobox][aria-label*=العملة], header [role=combobox][aria-label*=Moneda]")).toHaveCount(0);
      });

      test("currency with no choice yet shows a placeholder, keeps Login, and choosing AED works", async ({ page }) => {
        await open(page, "site-nav", "currency-none", locale, viewport);
        await menu(page);
        const currency = page.locator("header [role=combobox]").first();
        await expect(currency).toContainText("Currency");
        await currency.click();
        await expect(page.getByRole("listbox").locator("svg")).toHaveCount(0);
        await page.getByRole("option", { name: "AED" }).click();
        await expect(page.locator("header [role=combobox]").first()).toContainText("AED");
        await expect(page.locator("header a", { hasText: "Login" })).toHaveCount(1);
      });

      test("choosing another language in the select navigates to localeHrefs for it", async ({ page }) => {
        await open(page, "site-nav", "page", locale, viewport);
        await menu(page);
        // Choosing the language the page is already in is not a change.
        const target = locale === "ar" ? { name: "Español", code: "es" } : { name: "العربية", code: "ar" };
        await page.getByRole("combobox", { name: /^(Language|اللغة|Idioma):/ }).click();
        await page.getByRole("option", { name: target.name }).click();
        await page.waitForURL(new RegExp(`c=_smoke.*l=${target.code}`));
      });

      if (viewport === "phone") {
        test("the phone Menu opens, traps Tab, closes on Escape and returns focus", async ({ page }) => {
          await open(page, "site-nav", "page", locale, viewport);
          const button = page.getByRole("button", { name: "Menu" });
          await button.click();
          await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
          for (let i = 0; i < 12; i += 1) {
            await page.keyboard.press("Tab");
            expect(await page.evaluate(() => !!document.activeElement?.closest("header"))).toBe(true);
          }
          await page.keyboard.press("Escape");
          await expect(page.getByRole("button", { name: "Close menu" })).toBeHidden();
          await expect(button).toBeFocused();
        });
      }
    });

    test.describe(`SiteFooter ${where}`, () => {
      test("no newsletter form, no textbox, no Subscribe button by default", async ({ page }) => {
        await open(page, "site-footer", "default", locale, viewport);
        await expect(page.locator("footer form")).toHaveCount(0);
        await expect(page.getByRole("textbox")).toHaveCount(0);
        await expect(page.getByRole("button", { name: /subscribe/i })).toHaveCount(0);
        await expect(page.getByRole("status")).toHaveCount(0);
      });

      test("three plain language links with href, hreflang and lang; the current one is marked", async ({ page }) => {
        await open(page, "site-footer", "default", locale, viewport);
        const row = page.getByRole("navigation", { name: "[Language]" });
        const expected = { en: "English", ar: "العربية", es: "Español" } as const;
        for (const [code, name] of Object.entries(expected)) {
          const link = row.getByRole("link", { name });
          await expect(link).toHaveAttribute("href", new RegExp(`l=${code}$`));
          await expect(link).toHaveAttribute("hreflang", code);
          await expect(link).toHaveAttribute("lang", code);
          if (code === locale) await expect(link).toHaveAttribute("aria-current", "true");
          else await expect(link).not.toHaveAttribute("aria-current", /.*/);
        }
        await row.getByRole("link", { name: expected.ar }).click();
        await page.waitForURL(/c=_smoke.*l=ar/);
      });

      test("the owner's contact details are real mailto and tel links", async ({ page }) => {
        await open(page, "site-footer", "default", locale, viewport);
        await expect(page.locator('footer a[href^="mailto:"]')).toHaveAttribute("href", "mailto:inquiries@almarprivatejourney.com");
        await expect(page.locator('footer a[href^="tel:"]')).toHaveAttribute("href", "tel:+971563883302");
        const insta = page.getByRole("link", { name: /\[Instagram\]/ });
        await expect(insta).toHaveAttribute("target", "_blank");
        await expect(insta).toHaveAttribute("rel", /noopener/);
      });

      test("List with us renders nothing until it has an href", async ({ page }) => {
        await open(page, "site-footer", "list-with-us-held", locale, viewport);
        await expect(page.getByText("[List with us]")).toHaveCount(0);
      });

      test("newsletter={true} needs a handler: without one there is still no form", async ({ page }) => {
        await open(page, "site-footer", "newsletter-no-handler", locale, viewport);
        await expect(page.locator("footer form")).toHaveCount(0);
      });

      test("newsletter={true} with a handler: invalid shows the copy line, valid calls the handler", async ({ page }) => {
        await open(page, "site-footer", "newsletter-on", locale, viewport);
        await page.getByRole("button", { name: "[Subscribe]" }).click();
        await expect(page.getByText("[Enter a valid email]")).toBeVisible();
        await page.getByRole("textbox").fill("guest@example.com");
        await page.getByRole("button", { name: "[Subscribe]" }).click();
        await expect(page.getByTestId("subscribed")).toHaveText("guest@example.com");
      });
    });

    test.describe(`Field ${where}`, () => {
      test("default wrapper stays at 384; className max-w-none lets it fill the column", async ({ page }) => {
        await open(page, "field", "default", locale, viewport);
        const narrow = (await page.locator(".field").boundingBox())!.width;
        expect(Math.round(narrow)).toBeLessThanOrEqual(384);
        await open(page, "field", "wide", locale, viewport);
        const wide = (await page.locator(".field").boundingBox())!.width;
        const column = (await page.getByTestId("harness-field").boundingBox())!.width - 32;
        expect(Math.abs(wide - column)).toBeLessThan(2);
      });

      test("the coupon button says Apply by default and takes its label from a prop", async ({ page }) => {
        await open(page, "field", "coupon-default", locale, viewport);
        await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeVisible();
        await open(page, "field", "coupon-label", locale, viewport);
        await expect(page.getByRole("button", { name: "[Apply code]" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
      });
    });

    test.describe(`Chip ${where}`, () => {
      test("the toggle chip is a pressed button", async ({ page }) => {
        await open(page, "chip", "toggle", locale, viewport);
        const chip = page.getByRole("button", { name: "[Toggle]" });
        await expect(chip).toHaveAttribute("aria-pressed", "true");
        expect(Math.round((await chip.boundingBox())!.height)).toBe(40);
      });

      test("a non-interactive chip is plain text: no role, no pressed state, skipped by Tab", async ({ page }) => {
        await open(page, "chip", "static", locale, viewport);
        const chip = page.getByText("[Most Popular]");
        expect(await chip.evaluate((el) => el.tagName)).toBe("SPAN");
        await expect(chip).not.toHaveAttribute("aria-pressed", /.*/);
        await expect(chip).not.toHaveAttribute("tabindex", /.*/);
        await expect(page.getByTestId("harness-chip").getByRole("button")).toHaveCount(2);
        await page.getByRole("button", { name: "[before]" }).focus();
        await page.keyboard.press("Tab");
        await expect(page.getByRole("button", { name: "[after]" })).toBeFocused();
      });

      test("dense is 24px high, static or toggle", async ({ page }) => {
        await open(page, "chip", "dense", locale, viewport);
        expect(Math.round((await page.getByText("[Up to 10 Guests]").boundingBox())!.height)).toBe(24);
        await open(page, "chip", "dense-toggle", locale, viewport);
        expect(Math.round((await page.getByRole("button", { name: "[Dense toggle]" }).boundingBox())!.height)).toBe(24);
      });
    });
  }
}
