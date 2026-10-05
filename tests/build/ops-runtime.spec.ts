import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, test } from "@playwright/test";
import { OPS_AUTH_PATHS, opsPathsFrom } from "../../lib/ops-routes";

// Plan 03.2-03: the BUILT ops Worker (almar-ops) through local `wrangler dev` (workerd, never --remote), on the ops host.
// It proves that the dashboard host serves only its own paths, that no marketing page or guest API is reachable on it,
// and that /api/* reaches its route handlers. No Supabase is configured in this build, so signed-in cases are out of
// scope here (the controller's runbook and the owner's UAT cover them). Run:
//   node scripts/assemble-cloudflare.mjs --target=ops
//   node tests/build/make-ops-test-config.mjs
//   PW_READY_PATH=/api/health PW_WRANGLER_CONFIG=.tmp/wrangler.ops.test.toml PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/ops-runtime.spec.ts --workers=1
// The test copy of wrangler.ops.toml has no [ai] block (Workers AI is always remote and would bill) and no route.
// The ops host is sent as the request's Host header; the first test proves the Worker sees it.

const OPS_HOST = "dashboard.almarprivatejourney.com";
const MARKETING_HOST = "almarprivatejourney.com";
const FOLDER = "out-ops";

test.use({ extraHTTPHeaders: { host: OPS_HOST } });

const NEXT_MANIFEST = ".next/server/app-paths-manifest.json";
const ROUTES_FILE = ".open-next/almar-ops-routes.json";

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else found.push(relative(dir, full).split(sep).join("/"));
    }
  };
  walk(dir);
  return found.sort();
}

function nearest404(path: string): Buffer {
  const file = path.startsWith("/ar/") ? "ar/404.html" : path.startsWith("/es/") ? "es/404.html" : "404.html";
  return readFileSync(join(FOLDER, file));
}

const opsPaths: string[] = JSON.parse(readFileSync(ROUTES_FILE, "utf8"));
/** The bare dashboard sections, such as /catalog/stays: what the owner types on the ops host. */
const SECTIONS = opsPaths.filter(
  (p) => p !== "/" && p !== "/sign-in" && !p.startsWith("/dashboard") && !p.startsWith("/api/") && !p.startsWith("/auth/"),
);

// Not served on the ops host: marketing pages, the guest APIs, the held and test sections, the public Worker's sign-in
// paths and the marketing host's handoff start, the owner's API routes that no plan has written yet, and near misses.
const MISSES = [
  "/about",
  "/private-stays",
  "/private-stays/some-stay",
  "/ar/",
  "/es/",
  "/ar/about",
  "/booking",
  "/booking/trip",
  "/api/booking/quote",
  "/api/stripe/webhook",
  "/__harness",
  "/login",
  "/account",
  "/fx",
  "/newsletter",
  "/embed/hero-booker",
  "/services",
  "/services/concierge",
  "/auth/handoff/start",
  "/api/ops/stays",
  "/api/ops/publish",
  "/api/nope",
  "/sitemap.xml",
  "/nope",
  "/_next/image?url=%2Fx.png&w=64&q=75",
  // Near misses of served paths: only the exact pathname goes to Next.
  "/api/health/",
  "/API/health",
  "/catalog/stays/",
  "/catalog/stays/x",
  "/dashboard/",
  "/home/",
  "/auth/confirm/x",
  "/auth/sign-out/x",
  "/dashboard/api/health",
];

test.describe(`almar-ops on the built Worker (${FOLDER}/)`, () => {
  test("the config serves an assembled out-ops/ with no page, and the route list is exactly what the manifest allows", () => {
    expect(process.env.PW_WRANGLER_CONFIG ?? "").toMatch(/wrangler\.ops\.test\.toml$/);
    // The only HTML is the three branded 404s; nothing the marketing host serves.
    expect(filesUnder(FOLDER).filter((f) => /\.(html|body)$/.test(f))).toEqual(["404.html", "ar/404.html", "es/404.html"]);
    expect(existsSync(join(FOLDER, "_redirects"))).toBe(false);
    expect(existsSync(join(FOLDER, "sitemap.xml"))).toBe(false);
    expect(opsPaths).toEqual(opsPathsFrom(Object.keys(JSON.parse(readFileSync(NEXT_MANIFEST, "utf8")))));
    for (const path of OPS_AUTH_PATHS) expect(opsPaths).toContain(path);
    for (const never of ["/auth/handoff/start", "/api/booking/quote", "/api/stripe/webhook", "/about", "/private-stays", "/login", "/account", "/__harness"]) {
      expect(opsPaths, never).not.toContain(never);
    }
    expect(SECTIONS.length).toBeGreaterThanOrEqual(10);
  });

  test("0. the Worker sees the ops host: / without a session is the ops sign-in (200, noindex)", async ({ request }) => {
    const res = await request.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^text\/html/);
    expect(res.headers()["x-robots-tag"]).toBe("noindex");
    const html = await res.text();
    expect(html).toContain("<title>Sign in</title>");
    expect(html).toContain("sign-in-email");
    expect(html).not.toContain("dashboard.almarprivatejourney");
  });

  test("0. the same request on the marketing host is not the ops sign-in: the host, not the path, decides", async ({ request }) => {
    const res = await request.get("/sign-in", { headers: { host: MARKETING_HOST }, maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect(await res.text()).not.toContain("sign-in-email");
    // The dev-only host override is off in a production build: it cannot turn the marketing host into the ops host.
    const spoof = await request.get("/sign-in", { headers: { host: MARKETING_HOST, "x-almar-host": OPS_HOST }, maxRedirects: 0 });
    expect(spoof.status()).toBe(404);
    expect(await spoof.text()).not.toContain("sign-in-email");
  });

  test("1. /sign-in is the ops sign-in too, with and without a browser navigation header", async ({ request }) => {
    const variants: Array<Record<string, string>> = [{}, { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", accept: "text/html" }];
    for (const headers of variants) {
      const res = await request.get("/sign-in", { headers, maxRedirects: 0 });
      expect(res.status()).toBe(200);
      expect(res.headers()["x-robots-tag"]).toBe("noindex");
      expect(await res.text()).toContain("sign-in-email");
    }
  });

  test("2. every dashboard section without a session redirects to /sign-in and shows nothing of the page", async ({ request }) => {
    for (const path of SECTIONS) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([302, 303, 307, 308], path).toContain(res.status());
      expect(new URL(res.headers()["location"], "http://x").pathname, path).toBe("/sign-in");
      expect(res.headers()["x-robots-tag"], path).toBe("noindex");
    }
  });

  test("2. a typed /dashboard/<section> goes to the clean path; /dashboard goes to /", async ({ request }) => {
    const section = await request.get("/dashboard/catalog/stays", { maxRedirects: 0 });
    expect(section.status()).toBe(308);
    expect(new URL(section.headers()["location"], "http://x").pathname).toBe("/catalog/stays");
    const root = await request.get("/dashboard", { maxRedirects: 0 });
    expect(root.status()).toBe(308);
    expect(new URL(root.headers()["location"], "http://x").pathname).toBe("/");
  });

  test("3. /api/health reaches its route handler on the ops host: {\"ok\":true}, JSON, no-store, noindex; HEAD 200; POST 405", async ({ request }) => {
    const res = await request.get("/api/health", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    expect(res.headers()["content-type"]).toMatch(/^application\/json/);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["x-robots-tag"]).toBe("noindex");
    expect((await request.head("/api/health", { maxRedirects: 0 })).status()).toBe(200);
    const post = await request.post("/api/health", { data: "a=1", maxRedirects: 0 });
    expect(post.status()).toBe(405);
    expect(post.headers()["x-robots-tag"]).toBe("noindex");
  });

  test("4. marketing pages, guest APIs and near misses answer 404 with the nearest branded 404 page", async ({ request }) => {
    for (const path of MISSES) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
      expect(Buffer.compare(await res.body(), nearest404(path)), path).toBe(0);
      // A static answer: never the Next one (which carries a bare "noindex").
      expect(res.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    }
  });

  test("4. a browser navigation to a miss gets the same 404; the Worker runs for it (run_worker_first), Next does not", async ({ request }) => {
    const nav = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", accept: "text/html" };
    for (const path of ["/about", "/private-stays", "/ar/", "/booking/trip", "/wp-login.php"]) {
      const res = await request.get(path, { headers: nav, maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
      expect(Buffer.compare(await res.body(), nearest404(path)), path).toBe(0);
    }
  });

  test("5. POST and PUT to a miss answer 404 or 405, never anything from Next", async ({ request }) => {
    for (const path of MISSES) {
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

  test("6. the marketing host's own walls hold on this Worker too: /dashboard and /dashboard/home are 404 on the marketing host", async ({ request }) => {
    for (const path of ["/dashboard", "/dashboard/home", "/dashboard/catalog/stays"]) {
      const res = await request.get(path, { headers: { host: MARKETING_HOST }, maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
      expect(await res.text(), path).not.toContain("sign-in-email");
    }
  });

  test("7. forged x-almar-shell and x-almar-ops-path headers show no page without the owner session", async ({ request }) => {
    // A client-sent x-almar-shell only skips the clean-URL redirect (middleware.ts); the (ops) layout still sends anyone
    // but the owner to /sign-in, and the middleware drops a client x-almar-ops-path before it sets its own.
    for (const path of ["/", "/catalog/stays", "/dashboard/bookings", "/dashboard/catalog/stays", "/settings"]) {
      const plain = await request.get(path, { maxRedirects: 0 });
      const forged = await request.get(path, { headers: { "x-almar-shell": "ops", "x-almar-ops-path": "/catalog/stays" }, maxRedirects: 0 });
      if (forged.status() === 200) {
        expect(await forged.text(), path).toContain("sign-in-email");
        expect(plain.status(), path).toBe(200);
      } else {
        expect([302, 303, 307, 308], path).toContain(forged.status());
        const where = new URL(forged.headers()["location"], "http://x").pathname;
        expect(["/sign-in", new URL(plain.headers()["location"] ?? "/sign-in", "http://x").pathname], path).toContain(where);
      }
      expect(forged.headers()["x-robots-tag"] ?? "", path).toContain("noindex");
    }
  });

  test("8. the sign-in routes fail closed with no Supabase settings: no 500, always noindex", async ({ request }) => {
    const none = await request.get("/auth/confirm", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(none.status());
    expect(none.headers()["location"]).toMatch(/\/sign-in\?expired=1$/);
    expect(none.headers()["x-robots-tag"]).toBe("noindex");

    const ok = await request.get("/auth/confirm?token_hash=abc123&type=magiclink", { maxRedirects: 0 });
    expect(ok.status()).toBe(200);
    expect(ok.headers()["x-robots-tag"]).toBe("noindex");
    expect((await ok.text()).includes("One more step")).toBe(true);

    const handoff = await request.get("/auth/handoff?token=nope", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(handoff.status());
    expect(new URL(handoff.headers()["location"], "http://x").pathname).toBe("/sign-in");

    const out = await request.get("/auth/sign-out", { maxRedirects: 0 });
    expect(out.status()).toBe(405);
  });

  test("9. crawl files and static files are the ops folder's: disallow-all, no sitemap, immutable chunks, noindex on every static answer", async ({ request }) => {
    const robots = await request.get("/robots.txt", { maxRedirects: 0 });
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(robots.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect((await request.get("/sitemap.xml", { maxRedirects: 0 })).status()).toBe(404);

    const chunk = readdirSync(join(FOLDER, "_next/static/chunks")).find((n) => n.endsWith(".js"));
    expect(chunk).toBeTruthy();
    const js = await request.get(`/_next/static/chunks/${chunk}`, { maxRedirects: 0 });
    expect(js.status()).toBe(200);
    expect(js.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(js.headers()["x-robots-tag"]).toBe("noindex, nofollow");

    // public/ is copied (the brand and the images the dashboard shows); a marketing page is not.
    const image = readdirSync(join(FOLDER, "assets/img")).find((n) => n.endsWith(".webp"));
    expect(image).toBeTruthy();
    expect((await request.get(`/assets/img/${image}`, { maxRedirects: 0 })).status()).toBe(200);
  });
});
