import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { LOCALES, localeDir, localePath, type Locale } from "../../lib/locale-path";
import { NOT_FOUND_COPY } from "../../lib/not-found-document";

// The three branded 404s and the Cloudflare rules, on the assembled out/ under local wrangler.
// Run: node scripts/assemble-cloudflare.mjs, then
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts -g "404|server rules" --workers=1

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 834, height: 1194 },
  { width: 1440, height: 900 },
];
const PREFIX: Record<Locale, string> = { en: "", ar: "/ar", es: "/es" };
const MISSING = ["/nope", "/deep/nope"];

for (const viewport of VIEWPORTS) {
  test.describe(`404 at ${viewport.width}`, () => {
    test.use({ viewport });

    for (const locale of LOCALES) {
      for (const missing of MISSING) {
        const url = `${PREFIX[locale]}${missing}`;
        test(`404 status: ${url} at ${viewport.width}`, async ({ page }) => {
          const response = await page.goto(url);
          expect(response?.status()).toBe(404);
          expect(response?.request().redirectedFrom()).toBeNull();
          const raw = (await response?.text()) ?? "";
          expect(raw).toContain(`<html lang="${locale}" dir="${localeDir(locale)}">`);

          const copy = NOT_FOUND_COPY[locale];
          const h1 = page.locator("h1");
          await expect(h1).toHaveText(copy.heading);
          expect(await h1.evaluate((el) => getComputedStyle(el).direction)).toBe(localeDir(locale));
          const fits = await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          );
          expect(fits).toBe(true);

          const link = page.getByRole("link", { name: copy.linkLabel });
          await expect(link).toBeVisible();
          const box = await link.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
          expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
        });
      }

      test(`404 home link: ${locale} at ${viewport.width}`, async ({ page }) => {
        const homeBuilt = locale === "en" || existsSync(`out/${locale}/index.html`);
        test.skip(!homeBuilt, `out/${locale}/index.html is not assembled yet, so the 404 link points at "/"`);
        await page.goto(`${PREFIX[locale]}/nope`);
        const link = page.getByRole("link", { name: NOT_FOUND_COPY[locale].linkLabel });
        expect(await link.getAttribute("href")).toBe(localePath(locale, "/"));

        const statuses: number[] = [];
        page.on("response", (r) => {
          if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) statuses.push(r.status());
        });
        const landed = page.waitForResponse(
          (r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === localePath(locale, "/"),
        );
        await link.click();
        const response = await landed;
        expect(response.status()).toBe(200);
        expect(statuses.filter((s) => s >= 300 && s < 400)).toEqual([]);
        expect(new URL(page.url()).pathname).toBe(localePath(locale, "/"));
        const raw = await response.text();
        expect(raw).toMatch(new RegExp(`<html[^>]*\\slang="${locale}"`, "i"));
      });
    }
  });
}

test("server rules: /about/ costs one 307 to /about, and /about is 200", async ({ request }) => {
  const slash = await request.get("/about/", { maxRedirects: 0 });
  expect(slash.status()).toBe(307);
  expect(new URL(slash.headers()["location"], "http://x").pathname).toBe("/about");
  const page = await request.get("/about", { maxRedirects: 0 });
  expect(page.status()).toBe(200);
});
