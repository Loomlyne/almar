import { expect, test } from "@playwright/test";

test("/design is removed", async ({ request }) => {
  expect((await request.get("/design")).status()).toBe(404);
});

test("/framer is removed", async ({ request }) => {
  expect((await request.get("/framer")).status()).toBe(404);
});

test("live / still serves", async ({ request }) => {
  expect((await request.get("/")).status()).toBe(200);
});

test("/embed/hero-booker still serves JavaScript", async ({ request }) => {
  const res = await request.get("/embed/hero-booker");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("javascript");
});
