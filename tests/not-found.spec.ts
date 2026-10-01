import { expect, test } from "@playwright/test";

test("unknown path is the branded 404 and contact stays Framer", async ({ page }) => {
  const missing = await page.goto("/this-route-does-not-exist");
  expect(missing?.status()).toBe(404);

  const body = await page.content();
  expect(body).toContain("Page not found");
  expect(body).toContain("Return home");
  expect(body).not.toContain("Bricolage");
  expect(body).not.toContain("#f9f6f3");
  expect(body).not.toContain('name="generator" content="Framer');

  const home = page.locator('a[href="/"]', { hasText: "Return home" });
  await expect(home).toHaveCount(1);

  const contact = await page.goto("/contact");
  expect(contact?.status()).toBe(200);
  await expect(page.content()).resolves.toContain("Framer");
});
