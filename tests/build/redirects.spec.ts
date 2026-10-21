import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Plan 03.3-12 (job 21: every old unprefixed page answers 301 to its /en/ address too): the rules of public/_redirects answer 301 on local workerd (`wrangler dev`, the same
// engine family as the edge; never --remote). Run after `node scripts/assemble-cloudflare.mjs`:
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/redirects.spec.ts --workers=1

const ORIGIN = "https://almarprivatejourney.com";
const rules = readFileSync("public/_redirects", "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "" && !line.startsWith("#"))
  .map((line) => {
    const [from, to] = line.trim().split(/\s+/);
    return { from, to };
  });
const splat = rules.find((r) => r.from === "/services/*");
// Job 21: /blog/*, /private-stays/* and /bookings/* carry the rest of the path to /en/ (a final /:splat).
const carrying = rules.filter((r) => r.from.endsWith("/*") && r.to.endsWith("/:splat"));

const cases: Array<{ source: string; to: string }> = [
  ...rules.filter((r) => !r.from.endsWith("/*") && !r.to.endsWith("/:splat")).map((r) => ({ source: r.from, to: r.to })),
  ...["helicopter-transfers", "private-city-guides"].map((slug) => ({ source: `/services/${slug}`, to: splat!.to })),
];

test("the rule file is read and holds rules", () => {
  expect(rules.length).toBeGreaterThan(0);
  expect(splat).toBeDefined();
});

for (const { source, to } of cases) {
  test(`301: ${source} goes to ${to}`, async ({ request, baseURL }) => {
    const first = await request.get(source, { maxRedirects: 0 });
    expect(first.status()).toBe(301);
    const location = new URL(first.headers()["location"], baseURL);
    const want = new URL(to, ORIGIN);
    expect(location.pathname + location.search).toBe(want.pathname + want.search);

    const followed = await request.get(source);
    expect(followed.status()).toBe(200);
    // /en/account and /en/bookings send a signed-out visitor on to the sign-in page.
    const landing = /^\/en\/(account|bookings)$/.test(want.pathname) ? "/en/login" : want.pathname;
    expect(new URL(followed.url()).pathname).toBe(landing);
  });
}

test("the rules that carry the rest of the path (/blog/*, /private-stays/*, /bookings/*) keep it", async ({ request, baseURL }) => {
  expect(carrying.map((r) => r.from).sort()).toEqual(["/blog/*", "/bookings/*", "/private-stays/*"]);
  for (const rule of carrying) {
    const source = `${rule.from.slice(0, -1)}some-page`;
    const first = await request.get(`${source}?x=1`, { maxRedirects: 0 });
    expect(first.status(), source).toBe(301);
    const location = new URL(first.headers()["location"], baseURL);
    expect(location.pathname, source).toBe(rule.to.replace(":splat", "some-page"));
  }
});

test("/ar/services and /es/services never existed and answer 404", async ({ request }) => {
  for (const path of ["/ar/services", "/es/services"]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
});

test("the status of GET /_redirects is recorded, not asserted (the edge behaviour is an owner preview step)", async ({ request }) => {
  const response = await request.get("/_redirects", { maxRedirects: 0 });
  test.info().annotations.push({ type: "_redirects served", description: `${response.status()}` });
});
