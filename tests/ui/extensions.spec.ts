import { test } from "@playwright/test";
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
  }
}
