import { expect, test } from "@playwright/test";

// The footer link labelled "Contact" (container framer-1pmr5p9-container) must land on /contact.
// Framer's client router once ignored the server href and sent a plain click to
// /legal/privacy-policy, so markup checks are not enough: these tests click the link.
const CONTAINER = ".framer-1pmr5p9-container";
const PAGES = ["/", "/about", "/contact", "/private-stays"];
const DEAD = [
  "/legal/privacy-policy",
  "/legal/booking-terms",
  "/legal/disclaimer",
  "/legal/liability-waiver",
  "/legal/terms-of-service",
];

for (const path of PAGES) {
  test(`footer Contact link on ${path} lands on /contact`, async ({ page }) => {
    await page.goto(path);
    // Framer's router only takes over the click once the page has hydrated; click before that and
    // the plain href wins, which would hide the bug. Wait until the page is settled.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const link = page.locator(`${CONTAINER} a[href="/contact"]:visible`).first();
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL((url) => url.pathname === "/contact" || url.pathname.startsWith("/legal/"), { timeout: 15_000 });
    // Let a late client-side redirect, if any, happen before the final assertion.
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname).toBe("/contact");
  });
}

test("no visible footer link points at a dead /legal page", async ({ page }) => {
  await page.goto("/about");
  const hrefs = await page.locator("footer a:visible").evaluateAll((anchors) =>
    anchors.map((a) => new URL((a as HTMLAnchorElement).href).pathname.replace(/\/$/, "")),
  );
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.filter((href) => DEAD.includes(href))).toEqual([]);
});
