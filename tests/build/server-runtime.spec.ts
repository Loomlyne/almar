import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, test } from "@playwright/test";
import { JOB02_SERVER_PATHS } from "../../lib/auth/server-paths";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { LOCALES, localeDir } from "../../lib/locale-path";
import { HELD_PATHS } from "../../lib/server-routes";

// Job 10 (plan 02-21): the server runtime on the BUILT Worker, through local `wrangler dev` (workerd, never --remote).
// It proves that turning the runtime on changed no public byte, opened no held section, and serves /api/health.
// Run it against both Worker files:
//   node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/server-runtime.spec.ts --workers=1
//   node scripts/assemble-cloudflare.mjs --target=preview
//   PW_WRANGLER_CONFIG=wrangler.preview.toml PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/server-runtime.spec.ts --workers=1

const CONFIG = process.env.PW_WRANGLER_CONFIG ?? "wrangler.toml";
const CONFIG_TEXT = readFileSync(CONFIG, "utf8");
const FOLDER = /^directory = "\.\/([^"]+)"$/m.exec(CONFIG_TEXT)?.[1] ?? "";
const IS_PREVIEW = /^name = "almar-preview"$/m.test(CONFIG_TEXT);

// The four sections still held (the prompt's nine minus /login, /account and /bookings, opened by plan 02-23 task 3
// and moved under /en, /ar and /es by job 21,
// /booking, opened by plan 04-02, and /newsletter, opened by plan 03.3-27), pinned here on purpose: changing HELD_PATHS
// breaks this spec until the spec is changed in the same commit (lib/server-routes.ts, step 3 of its how-to). The
// opened sign-in paths are proven in tests/build/auth-paths.spec.ts; /newsletter in test 9 below.
const PINNED_HELD = ["/dashboard", "/fx", "/embed", "/__harness"];

const HELD_PROBES = [
  "/dashboard",
  "/dashboard/home",
  "/dashboard/catalog/stays",
  "/fx",
  "/es/fx",
  // Phase 3.3 close removed the Framer bridge files; their paths stay held and answer the static 404.
  "/embed/hero-booker",
  "/embed/font/Lato-Regular.ttf",
  "/embed/font/x.woff2",
  "/__harness",
  "/ar/dashboard",
];
// Not held sections, but never served by Next either: they get the static 404 too.
// Also the near misses of the opened sign-in paths: an unknown language, a child path, the ops-host handoff.
const OTHER_MISSES = [
  // /booking left the held list with plan 04-02; plan 04-03 gave /booking/trip its pages (/en|ar|es/booking/trip), so
  // only the paths around them are still the static 404.
  "/booking",
  "/booking/trip/x",
  "/ar/booking",
  "/es/booking",
  "/api/health/",
  "/api/nope",
  "/_next/image?url=%2Fx.png&w=64&q=75",
  "/API/health",
  "/fr/login",
  "/en/login/x",
  "/es/account/x",
  "/ar/bookings/x",
  "/en/bookings/x",
  "/login/x",
  "/account/x",
  "/auth/handoff",
  "/auth/confirm/x",
  "/auth/sign-out/x",
  "/auth/handoff/start/x",
  // Plan 03.3-27: only the exact /newsletter is served; a locale prefix or a child path is the static 404.
  "/ar/newsletter",
  "/es/newsletter",
  "/newsletter/x",
  // Plan 03.2-03: the owner's dashboard API is served by Worker almar-ops only; on almar and almar-preview it is the
  // same static 404, whatever app/ holds (lib/server-routes.ts skips it, worker/almar.mjs refuses it at startup).
  "/api/ops",
  "/api/ops/stays",
  "/api/ops/publish",
  "/api/ops/site-status",
  "/ar/api/ops/stays",
];

// Plan 04-03 (Q-06): the guest's trip, a static page in every locale (English is prefixed, job 21), noindex and
// same-origin; the screen reads this query in the browser.
const TRIP_QUERY = "stay=a&from=2026-11-02&to=2026-11-06&adults=2&children=0&infants=0";

function htmlFiles(dir: string): string[] {
  const found: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".html")) found.push(relative(dir, full).split(sep).join("/"));
    }
  };
  walk(dir);
  return found.sort();
}

function addressOf(rel: string): string {
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel.slice(0, -".html".length)}`;
}

function nearest404(path: string): Buffer {
  const file = path.startsWith("/ar/") ? "ar/404.html" : path.startsWith("/es/") ? "es/404.html" : "404.html";
  return readFileSync(join(FOLDER, file));
}

test.describe(`server runtime on ${CONFIG} (${FOLDER}/)`, () => {
  test("the config serves an assembled folder with the OpenNext bundle beside it", () => {
    expect(["out", "out-preview"]).toContain(FOLDER);
    expect(FOLDER === "out-preview").toBe(IS_PREVIEW);
    expect(existsSync(join(FOLDER, "en/index.html"))).toBe(true);
    expect(existsSync(join(FOLDER, "index.html")), `"/" is the Worker's language redirect, never a file`).toBe(false);
    expect(JSON.parse(readFileSync(".open-next/almar-server-routes.json", "utf8"))).toEqual(
      [
        "/api/booking/hold",
        "/api/booking/quote",
        "/api/booking/release",
        "/api/booking/request",
        "/api/booking/view",
        "/api/booking/withdraw",
        "/api/contact",
        "/api/health",
        "/api/preferences",
        ...JOB02_SERVER_PATHS,
        "/newsletter",
      ].sort(),
    );
  });

  test("1. same bytes: every page answers 200 at its address with exactly the file's bytes", async ({ request }) => {
    const pages = htmlFiles(FOLDER).filter((rel) => !rel.endsWith("404.html"));
    expect(pages.length).toBeGreaterThanOrEqual(54);
    for (const rel of pages) {
      const res = await request.get(addressOf(rel), { maxRedirects: 0 });
      expect(res.status(), rel).toBe(200);
      expect(res.headers()["content-type"], rel).toMatch(/^text\/html/);
      expect(Buffer.compare(await res.body(), readFileSync(join(FOLDER, rel))), rel).toBe(0);
    }
  });

  test("2. the held list is the four sections still held, and every one is probed", () => {
    expect([...HELD_PATHS]).toEqual(PINNED_HELD);
    for (const entry of PINNED_HELD) {
      const probed = HELD_PROBES.some((p) => {
        const bare = p.replace(/^\/(ar|es)(?=\/)/, "");
        return bare === entry || bare.startsWith(`${entry}/`);
      });
      expect(probed, entry).toBe(true);
    }
  });

  test("2. held sections and other misses: GET answers 404 with the nearest locale 404 page", async ({ request }) => {
    for (const path of [...HELD_PROBES, ...OTHER_MISSES]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
      expect(Buffer.compare(await res.body(), nearest404(path)), path).toBe(0);
    }
  });

  test("3. held sections and other misses: POST and PUT answer 404 or 405, never anything from Next", async ({ request }) => {
    for (const path of [...HELD_PROBES, ...OTHER_MISSES]) {
      for (const method of ["POST", "PUT"]) {
        const res = await request.fetch(path, {
          method,
          data: "Email=a%40b.co&website=",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          maxRedirects: 0,
        });
        expect([404, 405], `${method} ${path}`).toContain(res.status());
        expect(res.headers()["content-type"] ?? "", `${method} ${path}`).not.toMatch(/json/);
        expect(res.headers()["x-robots-tag"] ?? "", `${method} ${path}`).not.toBe("noindex");
      }
    }
  });

  test("4. /api/health answers {\"ok\":true}, JSON, no-store, noindex; HEAD 200; POST 405", async ({ request }) => {
    const res = await request.get("/api/health", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    expect(res.headers()["content-type"]).toMatch(/^application\/json/);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["x-robots-tag"]).toBe("noindex");
    const withQuery = await request.get("/api/health?x=1", { maxRedirects: 0 });
    expect(await withQuery.text()).toBe('{"ok":true}');
    const head = await request.head("/api/health", { maxRedirects: 0 });
    expect(head.status()).toBe(200);
    const post = await request.post("/api/health", { data: "a=1", maxRedirects: 0 });
    expect(post.status()).toBe(405);
    expect(post.headers()["x-robots-tag"]).toBe("noindex");
  });

  test("4. headers only Next's own layers set, sent by a visitor, change nothing on /api/health", async ({ request }) => {
    // Pre-landing review 2026-10-05: Next and OpenNext read x-matched-path, x-middleware-rewrite, x-now-route-matches
    // and RSC to route a request they believe an earlier layer already handled. A visitor can send all of them; the
    // answer must stay the health JSON, never a dashboard or login page.
    const probes: Array<Record<string, string>> = [
      { "x-matched-path": "/dashboard/home" },
      { "x-matched-path": "/login" },
      { "x-middleware-rewrite": "/login" },
      { "x-middleware-rewrite": "https://almarprivatejourney.com/dashboard/home" },
      { "x-now-route-matches": "1" },
      { RSC: "1" },
      {
        "x-matched-path": "/dashboard/home",
        "x-middleware-rewrite": "/login",
        "x-now-route-matches": "1",
        RSC: "1",
      },
    ];
    for (const headers of probes) {
      const label = JSON.stringify(headers);
      const res = await request.get("/api/health", { headers, maxRedirects: 0 });
      expect(res.status(), label).toBe(200);
      const text = await res.text();
      expect(text, label).toBe('{"ok":true}');
      expect(text.toLowerCase(), label).not.toMatch(/dashboard|login|<html/);
      expect(res.headers()["content-type"], label).toMatch(/^application\/json/);
      expect(res.headers()["x-robots-tag"], label).toBe("noindex");
    }
  });

  test("4. a browser navigation reaches /api/health, and still gets the 404 on a held path or near miss", async ({ request }) => {
    // Security review 2026-10-04: without run_worker_first, Cloudflare answers navigation misses from the assets
    // layer and the Worker never sees them. The Playwright request API sends no Sec-Fetch-Mode unless told to.
    const nav = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", accept: "text/html" };
    const health = await request.get("/api/health", { headers: nav, maxRedirects: 0 });
    expect(health.status()).toBe(200);
    expect(await health.text()).toBe('{"ok":true}');
    for (const path of ["/fr/login", "/dashboard", "/es/account/x", "/ar/newsletter", "/api/nope", "/wp-login.php"]) {
      const res = await request.get(path, { headers: nav, maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
      expect(Buffer.compare(await res.body(), nearest404(path)), path).toBe(0);
    }
  });

  test("5. pages, caching and crawl files are the static host's, per config", async ({ request }) => {
    for (const path of ["/en/", "/en/about", "/ar/", "/es/"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      if (IS_PREVIEW) expect(res.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
      else expect(res.headers()["x-robots-tag"], path).toBeUndefined();
    }
    const chunk = readdirSync(join(FOLDER, "_next/static/chunks")).find((n) => n.endsWith(".js"));
    expect(chunk).toBeTruthy();
    const js = await request.get(`/_next/static/chunks/${chunk}`, { maxRedirects: 0 });
    expect(js.status()).toBe(200);
    expect(js.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    const robots = await request.get("/robots.txt", { maxRedirects: 0 });
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toBe(readFileSync(join(FOLDER, "robots.txt"), "utf8"));
    expect(await robots.text()).toContain(IS_PREVIEW ? "Disallow: /" : "Sitemap: https://almarprivatejourney.com/sitemap.xml");
    const sitemap = await request.get("/sitemap.xml", { maxRedirects: 0 });
    if (IS_PREVIEW) {
      expect(sitemap.status()).toBe(404);
    } else {
      expect(sitemap.status()).toBe(200);
      expect(await sitemap.text()).toBe(readFileSync(join(FOLDER, "sitemap.xml"), "utf8"));
    }
  });

  test("5b. \"/\" is the Worker's language redirect: 302 to the almar-locale cookie's language, else /en/; private, no-store, noindex", async ({ request }) => {
    const want: Array<[string | undefined, string]> = [
      [undefined, "/en/"],
      ["almar-locale=ar", "/ar/"],
      ["almar-locale=es", "/es/"],
      ["almar-locale=fr", "/en/"],
      ["theme=dark; almar-locale=ar", "/ar/"],
    ];
    for (const [cookie, to] of want) {
      const res = await request.get("/", { headers: cookie ? { cookie } : {}, maxRedirects: 0 });
      expect(res.status(), String(cookie)).toBe(302);
      expect(res.headers()["location"], String(cookie)).toBe(to);
      expect(res.headers()["cache-control"], String(cookie)).toBe("private, no-store");
      expect(res.headers()["vary"], String(cookie)).toBe("Cookie");
      expect(res.headers()["x-robots-tag"], String(cookie)).toBe("noindex");
    }
    const withQuery = await request.get("/?utm_source=x", { headers: { cookie: "almar-locale=es" }, maxRedirects: 0 });
    expect(withQuery.headers()["location"]).toBe("/es/?utm_source=x");
  });

  test("6. slash and index redirects are unchanged", async ({ request }) => {
    const cases: Array<[string, string]> = [
      ["/en", "/en/"],
      ["/ar", "/ar/"],
      ["/es", "/es/"],
      ["/en/about/", "/en/about"],
      ["/en/index.html", "/en/"],
      // The static layer turns any percent-encoded character into a redirect to the plain path before the Worker
      // runs; the target then meets the same exact-match rule (measured 2026-10-04).
      ["/api%2Fhealth", "/api/health"],
      ["/api/%68ealth", "/api/health"],
      ["/dashboard%2Fhome", "/dashboard/home"],
    ];
    for (const [from, to] of cases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), from).toBe(307);
      expect(res.headers()["location"], from).toBe(to);
    }
  });

  test("7. a client-router (RSC) request for a page gets the same static file", async ({ request }) => {
    const res = await request.get("/en/about?_rsc=x", { headers: { RSC: "1" }, maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(Buffer.compare(await res.body(), readFileSync(join(FOLDER, "en/about.html")))).toBe(0);
  });

  test("8. POST /api/booking/quote is served by Next (plan 04-02): an empty body is 400, 403 or 503, never the static 404", async ({ request }) => {
    const res = await request.post("/api/booking/quote", { data: {}, maxRedirects: 0 });
    expect([400, 403, 503], `POST /api/booking/quote answered ${res.status()}`).toContain(res.status());
    expect(res.headers()["content-type"]).toMatch(/^application\/json/);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["x-robots-tag"]).toBe("noindex");
    const get = await request.get("/api/booking/quote", { maxRedirects: 0 });
    expect(get.status()).toBe(405);
  });

  test("8b. POST /api/booking/request, /view and /withdraw are served by Next (plan 04-08): an empty body is 400, 403 or 503, never the static 404; GET is 405", async ({ request }) => {
    for (const path of ["/api/booking/request", "/api/booking/view", "/api/booking/withdraw"]) {
      const res = await request.post(path, { data: {}, maxRedirects: 0 });
      expect([400, 403, 503], `POST ${path} answered ${res.status()}`).toContain(res.status());
      expect(res.headers()["content-type"], path).toMatch(/^application\/json/);
      expect(res.headers()["cache-control"], path).toContain("no-store");
      expect(res.headers()["x-robots-tag"], path).toBe("noindex");
      const get = await request.get(path, { maxRedirects: 0 });
      expect(get.status(), path).toBe(405);
    }
  });

  test("8c. /en|ar|es/booking/trip are static pages (plan 04-03): 200, the file's bytes, noindex, same-origin referrer, lang and dir", async ({ request }) => {
    for (const locale of LOCALES) {
      const file = readFileSync(join(FOLDER, `${locale}/booking/trip.html`));
      for (const path of [`/${locale}/booking/trip`, ...(locale === "en" ? [`/en/booking/trip?${TRIP_QUERY}`] : [])]) {
        const res = await request.get(path, { maxRedirects: 0 });
        expect(res.status(), path).toBe(200);
        expect(res.headers()["content-type"], path).toMatch(/^text\/html/);
        const body = await res.body();
        expect(Buffer.compare(body, file), path).toBe(0);
        const html = body.toString("utf8");
        expect(html, path).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
        expect(html, path).toMatch(/<meta name="referrer" content="same-origin"\s*\/?>/);
        expect(html, path).toMatch(new RegExp(`<html lang="${locale}" dir="${localeDir(locale)}"`));
      }
    }
  });

  test("8d. the trip page's own POST /api/booking/quote is never 403 (F-02): the Origin the real page sends passes, and the page shows the reason", async ({ page }) => {
    // The local Worker has no Supabase, so the quote is 503 `unavailable`; a 403 would mean the page's Origin (or a
    // dropped referrer, Origin: null) is refused by isAllowedPostOrigin.
    const quote = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/booking/quote" && r.request().method() === "POST");
    await page.goto(`/en/booking/trip?${TRIP_QUERY}`);
    const res = await quote;
    expect(res.status(), `the page's quote answered ${res.status()}`).not.toBe(403);
    expect([400, 503], `the page's quote answered ${res.status()}`).toContain(res.status());
    if (res.status() === 503) {
      const line = page.locator('[data-reason="unavailable"]');
      await expect(line).toHaveCount(1);
      await expect(line).toContainText(JOURNEY_COPY.en.reasons.unavailable);
    } else {
      await expect(page.locator("[data-reason]").first()).toBeVisible();
    }
  });

  test("9. /newsletter is the footer's POST handler (plan 03.3-27): GET and HEAD are 405, never a page; a refused POST is JSON, no-store, noindex", async ({ request, baseURL }) => {
    const navigations: Array<Record<string, string>> = [{}, { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", accept: "text/html" }];
    for (const nav of navigations) {
      const get = await request.get("/newsletter", { headers: nav, maxRedirects: 0 });
      expect(get.status(), JSON.stringify(nav)).toBe(405);
      expect(await get.text(), JSON.stringify(nav)).not.toMatch(/<html|<form/i);
      expect(get.headers()["x-robots-tag"]).toBe("noindex");
    }
    const head = await request.head("/newsletter", { maxRedirects: 0 });
    expect(head.status()).toBe(405);
    // No Origin (the request API sends none): 403 before anything else. Never a valid address here: no contact is created.
    const bare = await request.post("/newsletter", { multipart: { Email: "guest@example.com" }, maxRedirects: 0 });
    expect(bare.status()).toBe(403);
    expect(await bare.text()).toBe('{"ok":false}');
    expect(bare.headers()["content-type"]).toMatch(/^application\/json/);
    expect(bare.headers()["cache-control"]).toContain("no-store");
    expect(bare.headers()["x-robots-tag"]).toBe("noindex");
    const origin = new URL(baseURL ?? "http://127.0.0.1").origin;
    const urlencoded = await request.post("/newsletter", {
      form: { Email: "guest@example.com" },
      headers: { origin },
      maxRedirects: 0,
    });
    expect(urlencoded.status()).toBe(415);
    // A filled trap with the site's own Origin: the honeypot answer, 400, so the handler is live without a Resend call.
    const trap = await request.post("/newsletter", { multipart: { Email: "guest@example.com", website: "x" }, headers: { origin }, maxRedirects: 0 });
    expect(trap.status()).toBe(400);
    expect(await trap.text()).toBe('{"ok":false}');
  });

  test("10. review fix (PR #16): a form POST declaring more than its route's cap is 413 from the Worker, before Next", async ({ request }) => {
    // No Origin: Next would answer 403 first, so a 413 here can only come from worker/handle.mjs. At the cap the same
    // post reaches the route (403), so the guard turns away only what is too large.
    for (const [path, cap] of [["/api/contact", 16384], ["/newsletter", 8192]] as const) {
      const post = (bytes: number) =>
        request.post(path, { data: "x".repeat(bytes), headers: { "content-type": "application/x-www-form-urlencoded" }, maxRedirects: 0 });
      const big = await post(cap + 1);
      expect(big.status(), path).toBe(413);
      expect(await big.text()).toBe('{"ok":false}');
      expect(big.headers()["content-type"]).toMatch(/^application\/json/);
      expect(big.headers()["cache-control"]).toContain("no-store");
      expect(big.headers()["x-robots-tag"]).toBe("noindex");
      const atCap = await post(cap);
      expect(atCap.status(), path).toBe(403);
      expect(await atCap.text()).toBe('{"ok":false}');
    }
  });
});
