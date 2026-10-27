import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { BOOKING_PAGE_COPY } from "../../lib/copy/booking-page";
import { LOCALES, localeAlternates, localeDir } from "../../lib/locale-path";

// Plan 04-05, Task 5: the guest booking page /<locale>/bookings/trip on the BUILT Worker (local `wrangler dev`, never
// --remote). The three documents are static files in out/ (run_worker_first has /<locale>/bookings exactly, never
// /bookings/trip), noindex, same-origin referrer, with a self canonical and four hreflang alternates without a query.
// The page's own POST /api/booking/view and a same-origin POST /api/booking/withdraw from inside it are never 403 (F-02:
// the referrer policy keeps the Origin); the local Worker has no Supabase, so they answer 503 (or 404).
// Run after the build and the assembly:
//   npm run build && node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/booking-pages.spec.ts --workers=1

const CONFIG = process.env.PW_WRANGLER_CONFIG ?? "wrangler.toml";
const CONFIG_TEXT = readFileSync(CONFIG, "utf8");
const FOLDER = /^directory = "\.\/([^"]+)"$/m.exec(CONFIG_TEXT)?.[1] ?? "out";

const REF = "ALMAR-TEST22";
const FAKE_T = "fake-link-token-for-tests-only-000000000000";

function attr(tag: string, name: string): string | null {
  return new RegExp(`${name}="([^"]*)"`, "i").exec(tag)?.[1] ?? null;
}

test.describe("booking pages (built)", () => {
  test("the three documents are the static files: 200, noindex, same-origin referrer, lang and dir, canonical and four alternates with no query", async ({ request }) => {
    for (const locale of LOCALES) {
      const path = `/${locale}/bookings/trip`;
      const file = readFileSync(join(FOLDER, `${locale}/bookings/trip.html`));
      for (const url of [path, `${path}?ref=${REF}&t=${FAKE_T}`]) {
        const res = await request.get(url, { maxRedirects: 0 });
        expect(res.status(), url).toBe(200);
        expect(res.headers()["content-type"], url).toMatch(/^text\/html/);
        const body = await res.body();
        expect(Buffer.compare(body, file), `${url} is the file's bytes`).toBe(0);
        const html = body.toString("utf8");
        expect(html, url).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
        expect(html, url).toMatch(/<meta name="referrer" content="same-origin"\s*\/?>/);
        expect(html, url).not.toMatch(/no-referrer/);
        expect(html, url).toMatch(new RegExp(`<html lang="${locale}" dir="${localeDir(locale)}"`));
        expect(html, url).toContain(`<title>${BOOKING_PAGE_COPY[locale].pageTitle}`);
        const links = html.match(/<link [^>]*>/g) ?? [];
        const want = localeAlternates(locale, "/bookings/trip");
        const canonical = links.filter((l) => /rel="canonical"/.test(l));
        expect(canonical, url).toHaveLength(1);
        expect(attr(canonical[0], "href")).toBe(want.canonical);
        const alternates = links.filter((l) => /hreflang=/.test(l));
        expect(alternates, url).toHaveLength(4);
        expect(Object.fromEntries(alternates.map((l) => [attr(l, "hreflang"), attr(l, "href")]))).toEqual(want.languages);
        for (const l of [...canonical, ...alternates]) expect(attr(l, "href"), "no query in an alternate").not.toMatch(/[?&]|t=/);
        expect(html, "the static HTML never holds a token").not.toContain(FAKE_T);
      }
    }
  });

  test("a deeper path is the static 404; the unprefixed page is a 301 to /en/bookings/trip; the sitemap never lists bookings", async ({ request }) => {
    for (const path of ["/en/bookings/trip/x", "/ar/bookings/trip/x", "/es/bookings/trip/x"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
    }
    const unprefixed = await request.get(`/bookings/trip?ref=${REF}`, { maxRedirects: 0 });
    expect(unprefixed.status()).toBe(301);
    expect(unprefixed.headers()["location"] ?? "").toMatch(/\/en\/bookings\/trip/);
    const deep = await request.get("/bookings/trip/x");
    expect(deep.status()).toBe(404);
    // The preview Worker has no sitemap at all (scripts/crawl-files.mjs); production's never lists bookings.
    const sitemap = await request.get("/sitemap.xml");
    if (sitemap.status() === 200) expect(await sitemap.text()).not.toMatch(/bookings/);
  });

  test("the page's own POST /api/booking/view keeps its Origin (never 403), is JSON no-store, and the page shows unavailable or not found", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://127.0.0.1").origin;
    const view = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/booking/view" && r.request().method() === "POST");
    await page.goto(`/en/bookings/trip?ref=${REF}&t=${FAKE_T}`);
    const res = await view;
    expect((await res.request().allHeaders())["origin"], "the Origin the page sends").toBe(origin);
    expect(res.status(), `the view answered ${res.status()}`).not.toBe(403);
    expect([404, 503]).toContain(res.status());
    expect(res.headers()["content-type"]).toMatch(/^application\/json/);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const copy = BOOKING_PAGE_COPY.en;
    await expect(page.getByText(res.status() === 503 ? copy.unavailable : copy.notFound)).toBeVisible();
  });

  test("a same-origin POST /api/booking/withdraw from inside the page is never 403 (R2), JSON no-store, 503 or 404", async ({ page }) => {
    await page.goto(`/en/bookings/trip?ref=${REF}&t=${FAKE_T}`);
    const answer = await page.evaluate(
      async ({ ref, t }) => {
        const res = await fetch("/api/booking/withdraw", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ref, t }),
          cache: "no-store",
          credentials: "same-origin",
        });
        return { status: res.status, type: res.headers.get("content-type") ?? "", cache: res.headers.get("cache-control") ?? "" };
      },
      { ref: REF, t: FAKE_T },
    );
    expect(answer.status, `the withdraw answered ${answer.status}`).not.toBe(403);
    expect([404, 503]).toContain(answer.status);
    expect(answer.type).toMatch(/^application\/json/);
    expect(answer.cache).toContain("no-store");
  });
});
