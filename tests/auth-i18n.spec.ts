import { expect, test, type Page } from "@playwright/test";

// Plan 02-03: /login and the 404 follow the almar-locale cookie; Arabic is rtl on <html>.

async function withLocale(page: Page, locale: string) {
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: "http://127.0.0.1:3010" }]);
}

test("cookie ar: /login is Arabic and rtl, and an empty submit shows the Arabic email line", async ({ page }) => {
  await withLocale(page, "ar");
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("سجّل الدخول أو أنشئ حسابًا");
  await page.getByRole("button", { name: "الدخول برابط سحري" }).click();
  const field = page.getByRole("textbox");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(/.+/);
  await expect(page.getByText("Enter an email address.")).toHaveCount(0);
});

test("cookie es: /login is Spanish and ltr", async ({ page }) => {
  await withLocale(page, "es");
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("button", { name: "Access with magic link" })).toHaveCount(0);
});

test("an unknown cookie value falls back to English", async ({ page }) => {
  await withLocale(page, "fr");
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Access with magic link" })).toBeVisible();
});

test("cookie ar: the 404 is Arabic and rtl", async ({ page }) => {
  await withLocale(page, "ar");
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("الصفحة غير موجودة");
  await expect(page.locator('a[href="/"]', { hasText: "العودة إلى الرئيسية" })).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
