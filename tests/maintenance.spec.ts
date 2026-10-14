import { expect, test } from "@playwright/test";
import { renderMaintenancePage, MAINTENANCE_COPY } from "../lib/maintenance-document";

// Plan 02-06: the closed page every public address shows while maintenance is saved on. Rendered by the same function
// the assembler and the public Worker use, loaded into a real browser at the three widths, in EN, AR and ES.

test.describe.configure({ mode: "parallel" });

for (const locale of ["en", "ar", "es"] as const) {
  for (const width of [390, 834, 1440]) {
    test(`closed page: ${locale} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(renderMaintenancePage(locale, { logoSrc: "/brand/wordmark.svg" }));
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(MAINTENANCE_COPY[locale].line);
      await expect(page.getByRole("link", { name: "+971 56 388 3302" })).toHaveAttribute("href", "tel:+971563883302");
      await expect(page.getByRole("link", { name: "inquiries@almarprivatejourney.com" })).toHaveAttribute(
        "href",
        "mailto:inquiries@almarprivatejourney.com",
      );
      await expect(page.locator("form, button, input, script")).toHaveCount(0);
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toHaveText(MAINTENANCE_COPY[locale].skip);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      for (const box of await page.getByRole("link").all()) {
        if ((await box.textContent()) === MAINTENANCE_COPY[locale].skip) continue;
        expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
}
