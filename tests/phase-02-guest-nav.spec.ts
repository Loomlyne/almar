import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Plan 02-25: real header links on /account and /bookings, no currency control on /bookings, Profile sign-out wired.

// The four pages are English-only Framer pages today: siteHref keeps their one address in every language,
// exactly as the React public pages do. The test derives the expected value from siteHref, not from a literal.
import { siteHref } from "../lib/locale-path";
const PATHS = ["/destinations", "/experiences", "/about", "/contact"];
const HREFS = {
  en: PATHS.map((p) => siteHref("en", p)),
  ar: PATHS.map((p) => siteHref("ar", p)),
  es: PATHS.map((p) => siteHref("es", p)),
} as const;

test.use({ viewport: { width: 1440, height: 900 } });

for (const locale of ["en", "ar", "es"] as const) {
  for (const scene of ["hub", "bookings"] as const) {
    test(`${scene} header links in ${locale} are real, locale-aware paths`, async ({ page }) => {
      await page.goto(`/__harness?c=guest-account&s=${scene}&l=${locale}`);
      await page.waitForLoadState("networkidle");
      const hrefs = await page.locator("header a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      for (const expected of HREFS[locale]) expect(hrefs, `${scene} ${locale}`).toContain(expected);
      expect(hrefs.some((h) => h?.startsWith("#destinations"))).toBe(false);
    });
  }
}

test("bookings has no currency control; account still has one", async ({ page }) => {
  await page.goto("/__harness?c=guest-account&s=bookings&l=en");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("header").getByText("AED")).toHaveCount(0);
  await page.goto("/__harness?c=guest-account&s=hub&l=en");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#account-currency")).toHaveCount(1);
  await expect(page.locator("header").getByText("AED").first()).toBeVisible();
});

// Plan 05-04 (P5-10): sign-out lives in the rail only. The Profile page has none, so the test moves to the shell.
test("sign-out: the rail's form posts to /auth/sign-out and the dialogs use the locked words", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/ops/site-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, site: { state: "up_to_date", requested_seq: 5, live_seq: 5, requested_at: "2026-10-13T10:02:00.000Z", built_at: "2026-10-13T10:05:00.000Z", last_hook_at: "2026-10-13T10:02:00.000Z", last_hook_result: "ok" } }),
    }),
  );
  await page.goto("/__harness?c=ops-shell&s=owner&l=en");
  await page.waitForLoadState("networkidle");
  const form = page.locator('form[action="/auth/sign-out"]');
  await expect(form).toHaveCount(1);
  await expect(form).toHaveAttribute("method", "post");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out of this site" })).toBeVisible();
  const source = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  expect(source).toMatch(/signOutForm\.current\?\.submit\(\)/);
  expect(source).toMatch(/void signOutEverywhere\(\)/);
});
