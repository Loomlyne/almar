import { expect, test } from "@playwright/test";

test("AR on /framer sets dir rtl and the URL stays /framer", async ({ page }) => {
  await page.goto("/framer");

  const html = page.locator("html");
  await page.getByRole("button", { name: "AR", exact: true }).first().click();
  await expect(html).toHaveAttribute("lang", "ar");
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveURL(/\/framer$/);

  const frame = page.frameLocator("#content");
  await expect(frame.locator("html")).toHaveAttribute("lang", "ar");
  await expect(frame.locator("html")).toHaveAttribute("dir", "rtl");

  await page.getByRole("button", { name: "EN", exact: true }).first().click();
  await expect(html).toHaveAttribute("dir", "ltr");
  await expect(html).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(/\/framer$/);
});
