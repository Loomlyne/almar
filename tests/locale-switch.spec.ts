import { expect, test } from "@playwright/test";

// Successor of phase-03-locale.spec.ts, removed with /framer in plan 03.1-07.

test.use({ viewport: { width: 1440, height: 900 } });

// Job 21: the page's language is its address (/<locale>/account), so a pick opens the same page in that language and
// remembers it in almar-locale. The harness has no /<locale>/__harness route, so the proof is the address and the cookie;
// the page that answers (the branded 404) is drawn in the cookie's language.
const cookieLocale = async (page: import("@playwright/test").Page) =>
  (await page.context().cookies()).find((c) => c.name === "almar-locale")?.value;

test("choosing AR opens the page at /ar/ in rtl and remembers it, and choosing EN opens /en/", async ({ page }) => {
  await page.goto("/__harness?c=guest-account&s=hub&l=en");
  await page.waitForLoadState("networkidle");
  await page.locator("#account-language").click();
  await page.getByRole("option", { name: "العربية" }).click();
  await page.waitForURL((url) => url.pathname === "/ar/__harness");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(await cookieLocale(page)).toBe("ar");

  await page.goto("/__harness?c=guest-account&s=hub&l=ar");
  await page.waitForLoadState("networkidle");
  await page.locator("#account-language").click();
  await page.getByRole("option", { name: "English" }).click();
  await page.waitForURL((url) => url.pathname === "/en/__harness");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  expect(await cookieLocale(page)).toBe("en");
});

test("the nav language control opens the page in that language too", async ({ page }) => {
  await page.goto("/__harness?c=guest-account&s=hub&l=en");
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: /^Language:/ }).first().click();
  await page.getByRole("option", { name: "Español" }).click();
  await page.waitForURL((url) => url.pathname === "/es/__harness");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  expect(await cookieLocale(page)).toBe("es");
});
