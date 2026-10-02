import { expect, test, type Page } from "@playwright/test";

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

// Framer's router only takes over the click once the page has hydrated; click before that and the
// plain href wins, which would hide the bug. Network idle is best effort (Framer keeps some requests
// open), then a fixed pause for hydration.
async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

for (const path of PAGES) {
  test(`footer Contact link on ${path} lands on /contact`, async ({ page }) => {
    await page.goto(path);
    await settle(page);
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

// The same page carries three breakpoint copies of the footer; click the one that is visible at each width.
for (const width of [390, 834]) {
  test(`footer Contact link on /about lands on /contact at ${width}px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/about");
    await settle(page);
    const link = page.locator(`${CONTAINER} a[href="/contact"]:visible`).first();
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL((url) => url.pathname === "/contact" || url.pathname.startsWith("/legal/"), { timeout: 15_000 });
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname).toBe("/contact");
  });
}

// A modified click must keep its browser meaning (new tab); the delegate must not force it into this tab.
// Not asserted: whether headless Chromium opens a popup.
test("cmd+click on the footer Contact link does not navigate this tab", async ({ page }) => {
  await page.goto("/about");
  await settle(page);
  const link = page.locator(`${CONTAINER} a[href="/contact"]:visible`).first();
  await link.scrollIntoViewIfNeeded();
  await link.click({ modifiers: ["Meta"] });
  await page.waitForTimeout(2000);
  expect(new URL(page.url()).pathname).toBe("/about");
});

test("pressing Enter on the focused footer Contact link lands on /contact", async ({ page }) => {
  await page.goto("/about");
  await settle(page);
  const link = page.locator(`${CONTAINER} a[href="/contact"]:visible`).first();
  await link.scrollIntoViewIfNeeded();
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname === "/contact" || url.pathname.startsWith("/legal/"), { timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname).toBe("/contact");
});

test("no visible footer link points at a dead /legal page", async ({ page }) => {
  await page.goto("/about");
  const hrefs = await page.locator("footer a:visible").evaluateAll((anchors) =>
    anchors.map((a) => new URL((a as HTMLAnchorElement).href).pathname.replace(/\/$/, "")),
  );
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.filter((href) => DEAD.includes(href))).toEqual([]);
});
