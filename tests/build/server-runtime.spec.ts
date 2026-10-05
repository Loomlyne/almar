import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, test } from "@playwright/test";
import { JOB02_SERVER_PATHS } from "../../lib/auth/server-paths";
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

// The six sections still held (the prompt's nine minus /login, /account and /bookings, opened by plan 02-23 task 3),
// pinned here on purpose: changing HELD_PATHS breaks this spec until the spec is changed in the same commit
// (lib/server-routes.ts, step 3 of its how-to). The six opened paths are proven in tests/build/auth-paths.spec.ts.
const PINNED_HELD = ["/dashboard", "/booking", "/fx", "/newsletter", "/embed", "/__harness"];

const HELD_PROBES = [
  "/dashboard",
  "/dashboard/home",
  "/dashboard/catalog/stays",
  "/booking",
  "/booking/trip",
  "/fx",
  "/newsletter",
  "/embed/hero-booker",
  "/embed/font/x.woff2",
  "/__harness",
  "/ar/dashboard",
  "/es/booking",
];
// Not held sections, but never served by Next either: they get the static 404 too.
// Also the near misses of the six opened sign-in paths: a locale prefix, a child path, the ops-host handoff.
const OTHER_MISSES = [
  "/api/health/",
  "/api/nope",
  "/_next/image?url=%2Fx.png&w=64&q=75",
  "/API/health",
  "/ar/login",
  "/es/account",
  "/ar/bookings",
  "/login/x",
  "/account/x",
  "/bookings/x",
  "/auth/handoff",
  "/auth/confirm/x",
  "/auth/sign-out/x",
  "/auth/handoff/start/x",
];

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
  if (rel === "index.html") return "/";
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
    expect(existsSync(join(FOLDER, "index.html"))).toBe(true);
    expect(JSON.parse(readFileSync(".open-next/almar-server-routes.json", "utf8"))).toEqual(["/api/health", ...[...JOB02_SERVER_PATHS].sort()].sort());
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

  test("2. the held list is the six sections still held, and every one is probed", () => {
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
    for (const path of ["/ar/login", "/dashboard", "/es/account", "/newsletter", "/api/nope", "/wp-login.php"]) {
      const res = await request.get(path, { headers: nav, maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
      expect(Buffer.compare(await res.body(), nearest404(path)), path).toBe(0);
    }
  });

  test("5. pages, caching and crawl files are the static host's, per config", async ({ request }) => {
    for (const path of ["/", "/about", "/ar/", "/es/"]) {
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

  test("6. slash and index redirects are unchanged", async ({ request }) => {
    const cases: Array<[string, string]> = [
      ["/ar", "/ar/"],
      ["/es", "/es/"],
      ["/about/", "/about"],
      ["/index.html", "/"],
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
    const res = await request.get("/about?_rsc=x", { headers: { RSC: "1" }, maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(Buffer.compare(await res.body(), readFileSync(join(FOLDER, "about.html")))).toBe(0);
  });
});
