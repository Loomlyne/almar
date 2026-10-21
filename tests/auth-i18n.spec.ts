import { expect, test, type Page } from "@playwright/test";

// Plan 02-03: the 404 follows the almar-locale cookie; since job 21 /<locale>/login takes its language from the address
// (the cookie is no longer read there); Arabic is rtl on <html>.

async function withLocale(page: Page, locale: string) {
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: "http://127.0.0.1:3010" }]);
}

test("/ar/login is Arabic and rtl, and an empty submit shows the Arabic email line", async ({ page }) => {
  await page.goto("/ar/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("سجّل الدخول أو أنشئ حسابًا");
  await page.getByRole("button", { name: "الدخول برابط سحري" }).click();
  const field = page.getByRole("textbox");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(/.+/);
  await expect(page.getByText("Enter an email address.")).toHaveCount(0);
});

test("/es/login is Spanish and ltr", async ({ page }) => {
  await page.goto("/es/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("button", { name: "Access with magic link" })).toHaveCount(0);
});

test("an unknown cookie value falls back to English, and an unknown language in the address is a 404", async ({ page }) => {
  await withLocale(page, "fr");
  await page.goto("/en/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Access with magic link" })).toBeVisible();
  const response = await page.goto("/fr/login");
  expect(response?.status()).toBe(404);
});

test("cookie ar: the 404 is Arabic and rtl", async ({ page }) => {
  await withLocale(page, "ar");
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("الصفحة غير موجودة");
  await expect(page.locator('a[href="/ar/"]', { hasText: "العودة إلى الرئيسية" })).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
