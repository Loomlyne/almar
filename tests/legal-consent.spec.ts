import { expect, test } from "@playwright/test";
import { OPS_LEGAL_COPY } from "../lib/copy/ops-legal";
import { COOKIE_CONSENT_COPY } from "../lib/copy/cookie-consent";
import { SITE_FOOTER_COPY } from "../lib/copy/site-footer";

// Plan 06-04, Task 6: the public site with nothing published (fixtures, token null): no legal row, no Cookie settings, no
// banner, no beacon, and a legal address is a 404. The published flows have no scene (accepted deviation: no harness scenes for
// 06-04): loadBeacon and the cookie are held by tests/consent.test.mjs; a built site with published rows is the controller's
// check. Written, NOT run (owner rule, 2026-10-21).

const LOCALES = ["en", "ar", "es"] as const;
const WIDTHS = [390, 834, 1440];

for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    test(`nothing published: today's footer and no consent UI (${locale} ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/about`);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      const footer = page.getByRole("contentinfo");
      await expect(footer).toBeVisible();
      await expect(footer.getByRole("navigation", { name: SITE_FOOTER_COPY[locale].legal })).toHaveCount(0);
      await expect(page.getByRole("button", { name: SITE_FOOTER_COPY[locale].cookieSettings })).toHaveCount(0);
      await expect(page.getByRole("button", { name: COOKIE_CONSENT_COPY[locale].acceptAnalytics })).toHaveCount(0);
      await expect(page.locator('script[src*="cloudflareinsights"]')).toHaveCount(0);
      await expect(page.locator("input[type=radio]")).toHaveCount(0);
      expect(await page.content()).not.toContain("cloudflareinsights");
    });
  }
}

test("nothing published: every legal address answers not found", async ({ page }) => {
  for (const slug of ["privacy", "terms", "booking-terms", "waiver", "disclaimer", "cookie-banner"]) {
    const res = await page.goto(`/en/legal/${slug}`);
    expect(res?.status(), slug).toBe(404);
  }
});

test("the copy has no legal wording: the banner's words are the owner's, in the database", () => {
  for (const locale of LOCALES) {
    for (const value of Object.values(COOKIE_CONSENT_COPY[locale])) expect(value.length).toBeLessThan(40);
    expect(OPS_LEGAL_COPY[locale].bookingNote.length).toBeLessThan(90);
  }
});
