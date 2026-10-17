import type { Page } from "@playwright/test";
import { LOCALES, VIEWPORTS, WIDTHS, expect, open, style, token } from "./_helpers";
import { test } from "@playwright/test";
import { NEWSLETTER_HONEYPOT_FIELDS } from "../../lib/newsletter";

// Plan 03.3-27 Task 2 (dev config, harness): the light footer's newsletter column. The scenes are
// tests/journey/scenes/site-footer.tsx `newsletter-light` (resolves after ~300 ms), `newsletter-fails` (rejects after
// ~300 ms) and `newsletter-honeypot` (records the honeypot object it received). Strings are the scene's bracketed ones.

const footer = (page: Page) => page.locator("footer");
const box = (page: Page) => page.locator("#footer-newsletter-email");
const button = (page: Page) => footer(page).locator('button[type="submit"]');
/** The toast card, inside the fixed region, not its sr-only live line. */
const card = (page: Page) => page.locator("div.fixed > div.pointer-events-auto");

for (const locale of LOCALES) {
  for (const viewport of WIDTHS) {
    const where = `${locale} ${VIEWPORTS[viewport].width}`;

    test.describe(`footer newsletter ${where}`, () => {
      test("the served HTML carries no newsletter; after load the column shows its title, line, label and button", async ({ page, request }) => {
        const served = await (await request.get(`/__harness?c=site-footer&s=newsletter-light&l=${locale}`)).text();
        expect(served.includes('id="footer-newsletter-email"')).toBe(false);
        expect(served.includes("<form")).toBe(false);
        await open(page, "site-footer", "newsletter-light", locale, viewport);
        await expect(footer(page).getByText("[Newsletter]", { exact: true })).toBeVisible();
        await expect(footer(page).getByText("[Newsletter line]")).toBeVisible();
        await expect(footer(page).getByRole("textbox", { name: "[Email]" })).toBeVisible();
        await expect(footer(page).getByRole("button", { name: "[Subscribe]" })).toBeVisible();
        await expect(footer(page).locator("form")).toHaveCount(1);
      });

      test("the newsletter is the end column from 834, below the contact column at 390; square box, gold only as the button's line", async ({ page }) => {
        await open(page, "site-footer", "newsletter-light", locale, viewport);
        const contact = (await footer(page).locator("address").boundingBox())!;
        const news = (await footer(page).locator("form").boundingBox())!;
        if (viewport === "phone") {
          expect(news.y).toBeGreaterThan(contact.y + contact.height - 1);
        } else if (locale === "ar") {
          // Right to left: the end column is the leftmost.
          expect(news.x + news.width).toBeLessThan(contact.x + 1);
        } else {
          expect(news.x).toBeGreaterThan(contact.x + contact.width - 1);
        }
        expect(await style(box(page), "border-top-left-radius")).toBe("0px");
        expect(await style(button(page), "border-top-left-radius")).toBe("0px");
        const gold = await token(page, "gold");
        expect(await style(button(page), "border-top-color")).toBe(gold);
        expect(await style(button(page), "background-color")).not.toBe(gold);
        expect(await style(button(page), "color")).not.toBe(gold);
        const scroll = await footer(page).evaluate((el) => el.scrollWidth <= el.clientWidth);
        expect(scroll).toBe(true);
      });

      test("invalid: the invalid line as an alert, focus to the box, no handler call", async ({ page }) => {
        await open(page, "site-footer", "newsletter-light", locale, viewport);
        await button(page).click();
        await expect(footer(page).getByRole("alert")).toHaveText("[Enter a valid email]");
        await expect(box(page)).toBeFocused();
        await expect(box(page)).toHaveAttribute("aria-invalid", "true");
        await box(page).fill("guest@example");
        await button(page).click();
        await expect(footer(page).getByRole("alert")).toHaveText("[Enter a valid email]");
        // Review fix: the server's own rule (lib/email-address.ts). The browser's type=email check lets these through
        // (it allows any dots in the local part), the shared rule does not.
        for (const bad of [".guest@example.com", "guest.@example.com", "gu..est@example.com"]) {
          await box(page).fill(bad);
          await button(page).click();
          await expect(footer(page).getByRole("alert"), bad).toHaveText("[Enter a valid email]");
        }
        await page.waitForTimeout(500);
        await expect(page.getByTestId("subscribed")).toHaveText("");
      });

      test("valid: busy with the sending label, then the success toast (named close), the box emptied, no alert", async ({ page }) => {
        await open(page, "site-footer", "newsletter-light", locale, viewport);
        await box(page).fill("  guest@example.com ");
        await button(page).click();
        await expect(button(page)).toHaveAttribute("aria-busy", "true");
        await expect(button(page)).toBeDisabled();
        await expect(button(page)).toHaveText("[Sending]");
        await expect(card(page)).toHaveCount(1);
        await expect(card(page)).toContainText("[Subscribed]");
        await expect(card(page).getByRole("button", { name: "[Close]" })).toBeVisible();
        await expect(page.getByTestId("subscribed")).toHaveText("guest@example.com");
        await expect(box(page)).toHaveValue("");
        await expect(footer(page).getByRole("alert")).toHaveCount(0);
        await expect(button(page)).toHaveText("[Subscribe]");
        await expect(button(page)).not.toHaveAttribute("aria-busy", /.*/);
        await card(page).getByRole("button", { name: "[Close]" }).click();
        await expect(card(page)).toHaveCount(0);
      });

      test("a second submit while busy is ignored", async ({ page }) => {
        await open(page, "site-footer", "newsletter-honeypot", locale, viewport);
        await box(page).fill("guest@example.com");
        await button(page).click();
        await box(page).press("Enter");
        await expect(card(page)).toHaveCount(1);
        await page.waitForTimeout(700);
        await expect(card(page)).toHaveCount(1);
      });

      test("the handler rejects: busy, then the failed line as an alert, the address kept, no toast", async ({ page }) => {
        await open(page, "site-footer", "newsletter-fails", locale, viewport);
        await box(page).fill("guest@example.com");
        await button(page).click();
        await expect(button(page)).toHaveAttribute("aria-busy", "true");
        await expect(footer(page).getByRole("alert")).toHaveText("[Not added]");
        await expect(box(page)).toHaveValue("guest@example.com");
        await expect(card(page)).toHaveCount(0);
        await expect(page.getByText("[Subscribed]")).toHaveCount(0);
        await expect(page.getByText("[handler failed]")).toHaveCount(0);
        // The next submit clears the line first.
        await button(page).click();
        await expect(footer(page).getByRole("alert")).toHaveCount(0);
        await expect(footer(page).getByRole("alert")).toHaveText("[Not added]");
      });

      test("honeypots: 11 named inputs out of the accessibility tree and the Tab order; the handler gets all 11, empty", async ({ page }) => {
        await open(page, "site-footer", "newsletter-honeypot", locale, viewport);
        for (const name of NEWSLETTER_HONEYPOT_FIELDS) {
          await expect(footer(page).locator(`input[name="${name}"]`)).toHaveCount(1);
          await expect(footer(page).locator(`input[name="${name}"]`)).toHaveAttribute("tabindex", "-1");
          // Review fix: the contact form's anti-autofill attributes (autofill must never fill a trap).
          const trap = footer(page).locator(`input[name="${name}"]`);
          await expect(trap).toHaveAttribute("autocomplete", "one-time-code");
          await expect(trap).toHaveAttribute("data-1p-ignore", "");
          await expect(trap).toHaveAttribute("data-lpignore", "true");
          await expect(trap).toHaveAttribute("data-bwignore", "true");
          await expect(trap).toHaveAttribute("data-form-type", "other");
        }
        await expect(footer(page).locator('[aria-hidden="true"] input')).toHaveCount(11);
        await expect(footer(page).getByRole("textbox")).toHaveCount(1);
        await box(page).focus();
        await page.keyboard.press("Tab");
        await expect(button(page)).toBeFocused();
        await box(page).fill("guest@example.com");
        await button(page).click();
        await expect(page.getByTestId("subscribed")).not.toHaveText("");
        const got = JSON.parse((await page.getByTestId("subscribed").textContent()) ?? "{}");
        expect(Object.keys(got)).toEqual([...NEWSLETTER_HONEYPOT_FIELDS]);
        for (const value of Object.values(got)) expect(value).toBe("");
      });

      test("a filled honeypot reaches the handler untouched", async ({ page }) => {
        await open(page, "site-footer", "newsletter-honeypot", locale, viewport);
        await footer(page).locator('input[name="website"]').fill("x", { force: true });
        await box(page).fill("guest@example.com");
        await button(page).click();
        await expect(page.getByTestId("subscribed")).not.toHaveText("");
        const got = JSON.parse((await page.getByTestId("subscribed").textContent()) ?? "{}");
        expect(got.website).toBe("x");
      });
    });
  }
}
