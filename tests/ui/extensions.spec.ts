import { test, type Page } from "@playwright/test";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { fill, formatGuestSummary } from "../../lib/journey-format";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open, style } from "./_helpers";

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

    test.describe(`JourneyBar ${where}`, () => {
      const copy = JOURNEY_COPY[locale];
      const seg = (page: Page, i: number) => page.getByRole("group", { name: copy.bar.label }).locator("button").nth(i);
      const day = (page: Page, dmy: string) => page.locator(`button[aria-label^="${dmy}"]`);

      // R-6: below the md breakpoint the phone entry and sheet replace the bar, so the bar is
      // proven at 834 and 1440.
      if (viewport !== "phone") {
        test("no onSearch: no submit control of any kind; the wrapper is a group, not a search form", async ({ page }) => {
          await open(page, "journey-bar-ext", "no-search", locale, viewport);
          await expect(page.getByRole("button", { name: copy.bar.search })).toHaveCount(0);
          await expect(page.locator("form")).toHaveCount(0);
          await expect(page.getByRole("search")).toHaveCount(0);
          await expect(page.locator("button[type=submit]")).toHaveCount(0);
          const group = page.getByRole("group", { name: copy.bar.label });
          await expect(group).toHaveCount(1);
          await expect(group.locator("button")).toHaveCount(3);
        });

        test("no onSearch: Where auto-advances to When; the bar fills in; onChange fires", async ({ page }) => {
          await open(page, "journey-bar-ext", "no-search", locale, viewport);
          await seg(page, 0).click();
          await page.getByRole("option", { name: /Cartagena/ }).click();
          await expect(page.getByRole("group", { name: copy.dates.label })).toBeVisible();
          await expect(seg(page, 0)).toContainText("Cartagena");
          if (viewport === "desktop") {
            await day(page, "12/10/2026").click();
            await day(page, "17/10/2026").click();
            await page.getByRole("button", { name: copy.done }).click();
            await expect(seg(page, 1)).toContainText("12/10/2026 – 17/10/2026");
            const g = copy.guests;
            await page.getByRole("button", { name: fill(g.add, { group: g.group.adult }) }).click();
            await expect(seg(page, 2)).toContainText(
              formatGuestSummary({ adults: 2, children: 0, infants: 0 }, locale, g.summary),
            );
            await page.getByRole("button", { name: copy.done }).click();
            await expect(page.getByRole("button", { name: copy.bar.search })).toHaveCount(0);
          }
          expect(Number(await page.getByTestId("changes").textContent())).toBeGreaterThan(0);
        });

        test("with onSearch: today's search form and Search button", async ({ page }) => {
          await open(page, "journey-bar-ext", "with-search", locale, viewport);
          await expect(page.getByRole("search", { name: copy.bar.label })).toHaveCount(1);
          await expect(page.getByRole("button", { name: copy.bar.search })).toHaveCount(1);
          await expect(page.locator("button[type=submit]")).toHaveCount(1);
        });

        test("lockStay: four segments at 1 / 1.3 / 1.3 / 1; Destination and Stay show the lock and open nothing", async ({ page }) => {
          await open(page, "journey-bar-ext", "stay-locked", locale, viewport);
          const group = page.getByRole("group", { name: copy.bar.label });
          await expect(group.getByText("[Stay]", { exact: true })).toBeVisible();
          await expect(group.getByText("[Stay name]")).toBeVisible();
          const stay = group.locator('[data-bar-segment="stay"]');
          expect(await stay.locator("svg").count()).toBe(1);
          expect(await seg(page, 0).locator("svg").count()).toBe(1);
          const widths = [
            (await seg(page, 0).locator("xpath=..").boundingBox())!.width,
            (await stay.locator("xpath=..").boundingBox())!.width,
            (await seg(page, 1).locator("xpath=..").boundingBox())!.width,
            (await seg(page, 2).locator("xpath=..").boundingBox())!.width,
          ];
          expect(widths[1] / widths[0]).toBeCloseTo(1.3, 1);
          expect(widths[2] / widths[0]).toBeCloseTo(1.3, 1);
          expect(widths[3] / widths[0]).toBeCloseTo(1, 1);
          await expect(group.locator("button[type=submit]")).toHaveCount(0);
          // Click and Enter open nothing.
          await seg(page, 0).click({ force: true });
          await stay.click({ force: true });
          await seg(page, 0).focus();
          await page.keyboard.press("Enter");
          await expect(page.getByRole("listbox")).toHaveCount(0);
          await expect(page.getByRole("group", { name: copy.dates.label })).toHaveCount(0);
          await expect(seg(page, 0)).toHaveAttribute("aria-disabled", "true");
        });

        test("lockStay: a blocked date is aria-disabled with a line through it and cannot be picked", async ({ page }) => {
          await open(page, "journey-bar-ext", "stay-locked", locale, viewport);
          await seg(page, 1).click();
          const blocked = day(page, "20/10/2026");
          if (!(await blocked.isVisible())) {
            await page.getByRole("button", { name: copy.dates.nextMonth }).click();
          }
          await expect(blocked).toHaveAttribute("aria-disabled", "true");
          expect(await style(blocked, "text-decoration-line")).toContain("line-through");
          await day(page, "18/10/2026").click();
          await blocked.click({ force: true });
          await expect(day(page, "18/10/2026")).toHaveAttribute("aria-label", /./);
          await expect(blocked).not.toHaveAttribute("aria-label", new RegExp(copy.dates.day.departure));
        });
      }
    });

    test.describe(`JourneySheet ${where}`, () => {
      const copy = JOURNEY_COPY[locale];
      // R-6: the sheet is the phone's journey; the bar replaces it from the md breakpoint.
      if (viewport === "phone") {
        const entry = (page: Page) => page.getByRole("button", { name: new RegExp(copy.entry.title) });
        const dialog = (page: Page) => page.getByRole("dialog", { name: copy.sheet.label });

        test("no onSearch: Where, When, Who; the last step ends in Done, no Search; Done closes and keeps the value", async ({ page }) => {
          await open(page, "journey-sheet-ext", "no-search", locale, viewport);
          await entry(page).click();
          await page.getByRole("option", { name: /Cartagena/ }).click();
          await page.getByRole("button", { name: copy.dates.nextMonth }).click();
          await page.locator('button[aria-label^="12/10/2026"]').click();
          await page.locator('button[aria-label^="17/10/2026"]').click();
          await page.getByRole("button", { name: copy.sheet.next, exact: true }).click();
          const g = copy.guests;
          await page.getByRole("button", { name: fill(g.add, { group: g.group.adult }) }).click();
          await expect(dialog(page).getByRole("button", { name: copy.done, exact: true })).toBeVisible();
          await expect(dialog(page).getByRole("button", { name: copy.bar.search })).toHaveCount(0);
          await dialog(page).getByRole("button", { name: copy.done, exact: true }).click();
          await expect(dialog(page)).toHaveCount(0);
          const row = page.locator("[data-testid=harness-sheet] > div button").first();
          await expect(row).toContainText("Cartagena");
          await expect(row).toContainText("12/10/2026 – 17/10/2026");
          await expect(row).toContainText(formatGuestSummary({ adults: 2, children: 0, infants: 0 }, locale, g.summary));
        });

        test("with onSearch: the last step still ends in Search", async ({ page }) => {
          await open(page, "journey-sheet-ext", "with-search", locale, viewport);
          await entry(page).click();
          await page.getByRole("option", { name: /Cartagena/ }).click();
          await page.getByRole("button", { name: copy.dates.nextMonth }).click();
          await page.locator('button[aria-label^="12/10/2026"]').click();
          await page.locator('button[aria-label^="17/10/2026"]').click();
          await page.getByRole("button", { name: copy.sheet.next, exact: true }).click();
          await expect(dialog(page).getByRole("button", { name: copy.bar.search })).toBeVisible();
          await expect(dialog(page).getByRole("button", { name: copy.done, exact: true })).toHaveCount(0);
        });

        test("stay entry: magnifier, stay line over dates and guests, a 44x44 arrow; the row opens the sheet at When", async ({ page }) => {
          await open(page, "journey-sheet-ext", "entry-stay", locale, viewport);
          const row = page.locator("[data-testid=harness-sheet] > div button").first();
          await expect(row).toContainText("[Cartagena, Stay name]");
          await expect(row).toContainText(
            `${copy.bar.dates.empty} · ${formatGuestSummary({ adults: 1, children: 0, infants: 0 }, locale, copy.guests.summary)}`,
          );
          expect(await row.locator("> svg").count()).toBe(1);
          const arrow = (await row.locator("span[aria-hidden=true]").boundingBox())!;
          expect([Math.round(arrow.width), Math.round(arrow.height)]).toEqual([44, 44]);
          await row.click();
          await expect(dialog(page).getByRole("heading", { name: copy.sheet.when })).toBeVisible();
        });
      }
    });
  }
}
