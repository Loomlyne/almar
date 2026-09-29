import { test, expect } from "@playwright/test";

test("embed bundle builds and serves the mount global", async ({ request }) => {
  const res = await request.get("/embed/hero-booker");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("javascript");
  expect(await res.text()).toContain("AlmarMountHeroBooker");
});

test("embed bundle defines the mount function and renders the search form", async ({ page, request }) => {
  const res = await request.get("/embed/hero-booker");
  const js = await res.text();
  await page.setContent('<div id="host"></div>');
  await page.evaluate((code) => {
    // eslint-disable-next-line no-eval
    (0, eval)(code);
  }, js);
  expect(await page.evaluate(() => typeof (window as unknown as { AlmarMountHeroBooker?: unknown }).AlmarMountHeroBooker)).toBe("function");
  await page.evaluate(() => {
    const host = document.getElementById("host") as HTMLElement;
    (window as unknown as { AlmarMountHeroBooker: (h: HTMLElement) => void }).AlmarMountHeroBooker(host);
  });
  const form = page.getByRole("search", { name: "Find a stay" });
  await expect(form).toBeVisible();
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeEnabled();
});
