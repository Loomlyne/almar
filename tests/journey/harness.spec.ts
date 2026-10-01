import { test, expect } from "@playwright/test";

test("smoke scene renders under the flag", async ({ page }) => {
  const res = await page.goto("/__harness?c=_smoke&s=ok&l=en");
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("harness-smoke")).toBeVisible();
  await expect(page.getByTestId("harness-locale")).toHaveText("en");
});

test("locale ar flips lang and dir", async ({ page }) => {
  await page.goto("/__harness?c=_smoke&s=ok&l=ar");
  await expect(page.getByTestId("harness-smoke")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});

test("unknown state is a visible 200", async ({ page }) => {
  const res = await page.goto("/__harness?c=_smoke&s=nope&l=en");
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("harness-unknown")).toBeVisible();
});

test("bad input returns 404", async ({ request }) => {
  for (const url of [
    "/__harness?c=../app&s=ok&l=en",
    "/__harness?c=_smoke&s=ok&l=fr",
    "/__harness",
    "/__harness?c=_smoke&l=en",
  ]) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(404);
  }
});

test("heading sizes: utility beats base, plain h2 is 32px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/__harness?c=_smoke&s=ok&l=en");
  const h1 = page.locator("h1.text-display");
  const h2 = page.locator("h2");
  await expect(h1).toBeVisible();
  expect(await h1.evaluate((e) => getComputedStyle(e).fontSize)).toBe("48px");
  expect(await h2.evaluate((e) => getComputedStyle(e).fontSize)).toBe("32px");
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await h1.evaluate((e) => getComputedStyle(e).fontSize)).toBe("32px");
  // Base layer: --text-heading is 24px below 48rem, 32px from 48rem (globals.css).
  expect(await h2.evaluate((e) => getComputedStyle(e).fontSize)).toBe("24px");
});
