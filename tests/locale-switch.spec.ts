import { expect, test } from "@playwright/test";

// Successor of phase-03-locale.spec.ts, removed with /framer in plan 03.1-07.

test.use({ viewport: { width: 1440, height: 900 } });

test("choosing AR sets rtl, keeps the URL, and choosing EN restores ltr", async ({ page }) => {
  await page.goto("/account");
  await page.waitForLoadState("networkidle");
  const trigger = page.locator("#account-language");

  await trigger.click();
  await page.getByRole("option", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(new URL(page.url()).pathname).toBe("/account");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "almar-locale")?.value).toBe("ar");

  await trigger.click();
  await page.getByRole("option", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  expect(new URL(page.url()).pathname).toBe("/account");
});

test("the nav language control switches the page too", async ({ page }) => {
  await page.goto("/account");
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: /^Language:/ }).first().click();
  await page.getByRole("option", { name: "Español" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
