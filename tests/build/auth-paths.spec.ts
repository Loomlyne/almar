import { expect, test } from "@playwright/test";
import { JOB02_SERVER_PATHS } from "../../lib/auth/server-paths";

// Plan 02-23 task 3 (job 21: /<locale>/login, account and bookings): the sign-in paths on the BUILT Worker (local `wrangler dev`, never --remote), with NO
// Supabase or Resend settings on the Worker (none are bound in either wrangler file; no .env or .dev.vars exists).
// Each opened path must fail closed: a clear page or a redirect, never a 500, always x-robots-tag noindex.
//   node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/auth-paths.spec.ts --workers=1
//   node scripts/assemble-cloudflare.mjs --target=preview
//   PW_WRANGLER_CONFIG=wrangler.preview.toml PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/auth-paths.spec.ts --workers=1
// Bodies are never printed: assertions name the path only.

const NAV = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", accept: "text/html" };

test.describe("sign-in paths on the built Worker, no secrets bound", () => {
  test("the twelve paths are job 02's list", () => {
    expect([...JOB02_SERVER_PATHS]).toEqual([
      "/en/login", "/ar/login", "/es/login",
      "/auth/confirm", "/auth/sign-out", "/auth/handoff/start",
      "/en/account", "/ar/account", "/es/account",
      "/en/bookings", "/ar/bookings", "/es/bookings",
    ]);
  });

  test("GET /<locale>/login: 200 sign-in page, noindex", async ({ request }) => {
    for (const locale of ["en", "ar", "es"]) {
      for (const headers of [{}, NAV]) {
        const res = await request.get(`/${locale}/login`, { headers, maxRedirects: 0 });
        expect(res.status(), locale).toBe(200);
        expect(res.headers()["content-type"]).toMatch(/^text\/html/);
        expect(res.headers()["x-robots-tag"]).toBe("noindex");
        const html = await res.text();
        expect(html.includes("sign-in-email")).toBe(true);
        expect(html).toContain(`<html lang="${locale}"`);
      }
      const expired = await request.get(`/${locale}/login?expired=1`, { maxRedirects: 0 });
      expect(expired.status()).toBe(200);
      expect(expired.headers()["x-robots-tag"]).toBe("noindex");
    }
  });

  test("GET /<locale>/account and /<locale>/bookings: redirect to /<locale>/login?return=..., noindex", async ({ request }) => {
    for (const locale of ["en", "ar", "es"]) {
      for (const [section, key] of [["account", "account"], ["bookings", "bookings"]]) {
        const path = `/${locale}/${section}`;
        const res = await request.get(path, { maxRedirects: 0 });
        expect([302, 303, 307, 308], path).toContain(res.status());
        expect(res.headers()["location"], path).toBe(`/${locale}/login?return=${key}`);
        expect(res.headers()["x-robots-tag"], path).toBe("noindex");
      }
    }
  });

  test("GET /auth/confirm: valid-looking params give the Continue page; none redirect to /en/login?expired=1", async ({ request }) => {
    const ok = await request.get("/auth/confirm?token_hash=abc123&type=magiclink", { maxRedirects: 0 });
    expect(ok.status()).toBe(200);
    expect(ok.headers()["x-robots-tag"]).toBe("noindex");
    expect((await ok.text()).includes("One more step")).toBe(true);

    for (const url of ["/auth/confirm", "/auth/confirm?token_hash=abc123", "/auth/confirm?token_hash=abc123&type=nope"]) {
      const res = await request.get(url, { maxRedirects: 0 });
      expect([302, 303, 307, 308], url).toContain(res.status());
      expect(res.headers()["location"], url).toBe("/en/login?expired=1");
      expect(res.headers()["x-robots-tag"], url).toBe("noindex");
    }
  });

  test("GET /auth/handoff/start: no session, no 500: it sends the visitor home with nothing issued", async ({ request }) => {
    const res = await request.get("/auth/handoff/start", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());
    expect(new URL(res.headers()["location"], "http://x").pathname).toBe("/");
    expect(res.headers()["x-robots-tag"]).toBe("noindex");
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("POST /auth/sign-out: redirect to the English home without a language, no 500, noindex", async ({ request }) => {
    const res = await request.post("/auth/sign-out", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());
    expect(new URL(res.headers()["location"], "http://x").pathname).toBe("/en/");
    expect(res.headers()["x-robots-tag"]).toBe("noindex");
  });

  test("POST /auth/sign-out (job 21): the form's locale, else the almar-locale cookie, else /en/; a bad value is ignored", async ({ request }) => {
    const cases: { name: string; form?: Record<string, string>; cookie?: string; want: string }[] = [
      { name: "form locale=ar", form: { locale: "ar" }, want: "/ar/" },
      { name: "cookie es", cookie: "almar-locale=es", want: "/es/" },
      { name: "bad form value", form: { locale: "//evil.com" }, want: "/en/" },
      { name: "bad cookie value", cookie: "almar-locale=//evil.com", want: "/en/" },
    ];
    for (const c of cases) {
      const res = await request.post("/auth/sign-out", {
        maxRedirects: 0,
        ...(c.form ? { form: c.form } : {}),
        ...(c.cookie ? { headers: { cookie: c.cookie } } : {}),
      });
      expect([302, 303, 307, 308], c.name).toContain(res.status());
      const location = new URL(res.headers()["location"], "http://x");
      expect(location.pathname, c.name).toBe(c.want);
      expect(location.host === "x" || !location.host.includes("evil"), c.name).toBe(true);
    }
  });

  test("the server action behind /en/login answers 'unavailable' with no 500 (browser submit)", async ({ page }) => {
    await page.goto("/en/login");
    await page.locator("#sign-in-email").fill("guest@example.com");
    const posted = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/en/login");
    await page.getByRole("button", { name: "Access with magic link", exact: false }).or(page.locator('button[type="submit"]')).first().click();
    const response = await posted;
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex");
    await expect(page.getByRole("alert").filter({ hasText: "Sign-in is not available right now" })).toBeVisible();
  });

  test("near misses still answer the static 404: an unknown language, child paths, the ops-host handoff", async ({ request }) => {
    for (const path of ["/fr/login", "/en/login/x", "/ar/account/x", "/login/x", "/account/x", "/auth/handoff", "/auth/confirm/x"]) {
      for (const headers of [{}, NAV]) {
        const res = await request.get(path, { headers, maxRedirects: 0 });
        expect(res.status(), path).toBe(404);
        expect(res.headers()["x-robots-tag"] ?? "", path).not.toBe("noindex");
      }
    }
  });

  test("GET /auth/sign-out is not served (405 from Next, never a sign-out)", async ({ request }) => {
    const res = await request.get("/auth/sign-out", { maxRedirects: 0 });
    expect([404, 405]).toContain(res.status());
  });
});
