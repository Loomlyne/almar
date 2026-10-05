import { test } from "@playwright/test";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open } from "./_helpers";

// PortraitCard options (plan 03.3-13, S2-21 case B) in the dev harness, at 390, 834 and 1440 in EN and AR.

for (const viewport of WIDTHS) {
  for (const locale of LOCALES.filter((l) => l !== "es")) {
    test(`PortraitCard options ${locale} ${VIEWPORTS[viewport].width}`, async ({ page }) => {
      await open(page, "portrait-card-options", "options", locale, viewport);
      const card = page.getByTestId("option-card").locator("article");
      await expect(card).toHaveCount(1);
      await expect(page.getByTestId("option-card").locator("a")).toHaveCount(0);
      const box = (await card.boundingBox())!;
      if (VIEWPORTS[viewport].width >= 768) {
        expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(2);
      } else {
        expect(Math.abs(box.height / box.width - 12 / 7) / (12 / 7)).toBeLessThanOrEqual(0.01);
      }
      const title = card.locator("span.font-display");
      await expect(title).toHaveCSS("text-transform", locale === "ar" ? "none" : "uppercase");
      // Job 11's default card is still one link with a 2:3 photo.
      const link = page.getByTestId("default-card").locator("a");
      await expect(link).toHaveCount(1);
      const def = (await link.boundingBox())!;
      expect(Math.abs(def.height / def.width - 3 / 2)).toBeLessThanOrEqual(0.02);
    });
  }
}
