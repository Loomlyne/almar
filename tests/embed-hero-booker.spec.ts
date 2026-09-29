import { test, expect } from "@playwright/test";

test("embed bundle builds and serves the mount global", async ({ request }) => {
  const res = await request.get("/embed/hero-booker");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("javascript");
  expect(await res.text()).toContain("AlmarMountHeroBooker");
});
