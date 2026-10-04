import { readFileSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { pointerOff } from "../helpers/pointer-off";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open } from "./_helpers";

// Slider layout "hero" (plan 03.3-13, S2-17 case B) in the dev harness, at 390, 834 and 1440 in EN and AR. Slider hygiene per
// S2-24 and S2-26: pointerOff runs right after every open and after every click on Pause, Play or a dot, before any wait.

const AUTOPLAY_MS = Number(/export const AUTOPLAY_MS = (\d+)/.exec(readFileSync("components/ui/slider.tsx", "utf8"))![1]);
const WAIT = AUTOPLAY_MS + 1000;
const REGION = '[aria-roledescription="carousel"]';

/** The 1-based number of the dot marked current. */
const shown = (page: Page) =>
  page.evaluate((region) => {
    const dots = Array.from(document.querySelectorAll(`${region} button[aria-label^="[Go to photo"]`));
    return dots.findIndex((d) => d.getAttribute("aria-current") === "true") + 1;
  }, REGION);

async function ready(page: Page, locale: (typeof LOCALES)[number], viewport: (typeof WIDTHS)[number]) {
  await open(page, "slider-hero", "three", locale, viewport);
  await pointerOff(page);
  await expect(page.locator(`${REGION} button[aria-label^="[Go to photo"]`)).toHaveCount(3);
}

for (const viewport of WIDTHS) {
  for (const locale of LOCALES.filter((l) => l !== "es")) {
    const where = `${locale} ${VIEWPORTS[viewport].width}`;

    test.describe(`Slider hero ${where}`, () => {
      test("three photos, one dot each, Pause and no previous or next button; the heading sits over the photo", async ({ page }) => {
        await ready(page, locale, viewport);
        await expect(page.locator(`${REGION} img`)).toHaveCount(3);
        await expect(page.getByRole("button", { name: "[Previous]" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "[Next]" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "[Pause]" })).toHaveCount(1);
        const slider = (await page.locator(REGION).boundingBox())!;
        expect(Math.round(slider.width)).toBe(VIEWPORTS[viewport].width);
        const heading = (await page.getByTestId("hero-heading").boundingBox())!;
        expect(heading.y).toBeGreaterThanOrEqual(slider.y);
        expect(heading.y + heading.height).toBeLessThanOrEqual(slider.y + slider.height);
        await expect(page.getByTestId("hero-heading")).toBeVisible();
        await expect(page.locator(REGION)).toHaveCSS("direction", locale === "ar" ? "rtl" : "ltr");
      });

      test("Pause holds the slide; Play runs it again", async ({ page }) => {
        await ready(page, locale, viewport);
        await page.getByRole("button", { name: "[Pause]" }).click();
        await pointerOff(page);
        const held = await shown(page);
        await page.waitForTimeout(WAIT);
        expect(await shown(page)).toBe(held);
        await page.getByRole("button", { name: "[Play]" }).click();
        await pointerOff(page);
        await expect.poll(() => shown(page), { timeout: WAIT }).not.toBe(held);
      });

      test("hovering holds it; moving the pointer off runs it again", async ({ page }) => {
        await ready(page, locale, viewport);
        await page.locator(REGION).hover();
        const held = await shown(page);
        await page.waitForTimeout(WAIT);
        expect(await shown(page)).toBe(held);
        await pointerOff(page);
        await expect.poll(() => shown(page), { timeout: WAIT }).not.toBe(held);
      });

      test("keyboard focus on a dot holds it; blur runs it again", async ({ page }) => {
        await ready(page, locale, viewport);
        // A keyboard focus: tab onto the first control inside the region (focus-visible), without clicking.
        await page.locator(`${REGION} button`).first().focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        const held = await shown(page);
        await page.waitForTimeout(WAIT);
        expect(await shown(page)).toBe(held);
        await pointerOff(page);
        await expect.poll(() => shown(page), { timeout: WAIT }).not.toBe(held);
      });

      test("a dot shows that photo and stops it for good", async ({ page }) => {
        await ready(page, locale, viewport);
        await page.getByRole("button", { name: "[Go to photo 2]" }).click();
        await pointerOff(page);
        expect(await shown(page)).toBe(2);
        await page.waitForTimeout(WAIT);
        expect(await shown(page)).toBe(2);
      });

      test("with reduced motion nothing advances and no Pause button is drawn", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await ready(page, locale, viewport);
        await expect(page.getByRole("button", { name: "[Pause]" })).toHaveCount(0);
        const first = await shown(page);
        await page.waitForTimeout(WAIT);
        expect(await shown(page)).toBe(first);
      });
    });
  }
}
