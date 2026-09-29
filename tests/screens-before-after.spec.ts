import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// SCREENS_MODE=before writes baselines (run with --update-snapshots).
// Default "after" compares against tests/screens/before as a gross-break guard.
const MODE = process.env.SCREENS_MODE === "before" ? "before" : "after";

const ROUTES = [
  { path: "/dashboard", slug: "dashboard", ownLanguageControl: false },
  { path: "/account", slug: "account", ownLanguageControl: true },
  { path: "/login", slug: "login", ownLanguageControl: true },
  { path: "/booking/trip", slug: "booking-trip", ownLanguageControl: true },
] as const;

const LOCALES = ["en", "ar"] as const;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 834, height: 1194 },
  { width: 1440, height: 900 },
] as const;

/**
 * Switches the page to Arabic through the visible language control.
 * Plan 12 drives LocaleSelect (Radix combobox) and edits only this helper.
 * Method per route:
 *  - /account, /login, /booking/trip: SiteNav Language control, option AR (native name العربية).
 *  - /dashboard: static "Sign in" placeholder with no language control and no
 *    copy; the almar-locale cookie is set and html lang/dir applied directly.
 */
async function chooseArabic(page: Page, ownLanguageControl: boolean) {
  if (!ownLanguageControl) {
    await page.context().addCookies([
      { name: "almar-locale", value: "ar", url: page.url() },
    ]);
    await page.evaluate(() => {
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
    });
  } else {
    // Below 1088px the language control sits inside the Menu panel.
    const menu = page.getByRole("button", { name: /^(Menu|القائمة)$/ });
    const trigger = page.getByRole("combobox", { name: /Language|اللغة/ }).first();
    // Retry the Menu click: an early click can land before hydration.
    await expect(async () => {
      if (!(await trigger.isVisible()) && (await menu.isVisible())) await menu.click();
      await expect(trigger).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await trigger.click();
    await page.getByRole("option", { name: /^(AR|العربية)$/ }).click();
    // Return to the resting layout: close the list, then the phone menu.
    await page.keyboard.press("Escape");
    const close = page.getByRole("button", { name: /Close menu|إغلاق/ });
    if (await close.isVisible()) await close.click();
    await page.mouse.move(0, 0);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  }
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
}

for (const route of ROUTES) {
  for (const locale of LOCALES) {
    for (const vp of VIEWPORTS) {
      const name = `${route.slug}-${locale}-${vp.width}.png`;
      test(`${MODE}: ${name}`, async ({ page }) => {
        await page.setViewportSize(vp);
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        if (locale === "ar") await chooseArabic(page, route.ownLanguageControl);
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        // Next dev overlay is not part of the product look.
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
        await page.waitForTimeout(300);
        const image = await page.screenshot({ fullPage: true });

        if (MODE === "before") {
          expect(image).toMatchSnapshot(["screens", "before", name], {
            maxDiffPixelRatio: 0,
          });
          return;
        }

        const afterDir = path.join("tests", "screens", "after");
        mkdirSync(afterDir, { recursive: true });
        writeFileSync(path.join(afterDir, name), image);
        expect(image).toMatchSnapshot(["screens", "before", name], {
          maxDiffPixelRatio: 0.35,
        });
      });
    }
  }
}
