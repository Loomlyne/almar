import { expect, test } from "@playwright/test";

test("/design is removed", async ({ request }) => {
  expect((await request.get("/design")).status()).toBe(404);
});

test("/framer is removed", async ({ request }) => {
  expect((await request.get("/framer")).status()).toBe(404);
});

test("live /en/ still serves", async ({ request }) => {
  expect((await request.get("/en/")).status()).toBe(200);
});

// Phase 3.3 close: the Framer bridge (the hero booker bundle, its Lato font route and the dev-only /fx rates page) is
// gone. The built Workers prove the branded 404 (tests/build/server-runtime.spec.ts, tests/build/ops-runtime.spec.ts).
test("the Framer bridge routes are removed", async ({ request }) => {
  for (const path of ["/embed/hero-booker", "/embed/font/Lato-Regular.ttf", "/fx"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
