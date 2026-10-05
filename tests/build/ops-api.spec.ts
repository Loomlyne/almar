import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Plan 03.2-04: the owner API (/api/ops/*) on the BUILT ops Worker (almar-ops) through local `wrangler dev` (workerd).
//
// Part A, every ops run: the nine routes exist on the ops host and fail closed without the owner (403 not_owner JSON,
// no-store, noindex), the Origin and body rules hold before anything else for a non-owner too, and no other host reaches
// them. Run with the plain test copy (no Supabase settings), as ops-runtime.spec.ts:
//   node scripts/assemble-cloudflare.mjs --target=ops && node tests/build/make-ops-test-config.mjs
//   PW_READY_PATH=/api/health PW_WRANGLER_CONFIG=.tmp/wrangler.ops.test.toml PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/ops-api.spec.ts tests/build/ops-runtime.spec.ts --workers=1
//
// Part B, only with the local-stack copy (.tmp/ops-stack/, tests/build/make-ops-stack-config.mjs): the owner signs in on
// this worktree's local Supabase stack and the API is used for real. It closes job 10's open item (02-RUNTIME-DEPLOY.md
// section 6, 03.2-OPS-DEPLOY.md section 7): worker/handle.mjs rebuilds every Request before OpenNext sees it, so this proves
// that many POSTs with DIFFERENT bodies in ONE workerd session each reach the parser with their own body, by having the
// route echo what it read: the first bad field of each body, and the saved values read back byte for byte.
//   node tests/helpers/local-supabase.mjs start && node tests/helpers/local-supabase.mjs reset
//   node tests/build/make-ops-stack-config.mjs
//   PW_READY_PATH=/api/health PW_WRANGLER_CONFIG=.tmp/ops-stack/wrangler.ops.test.toml PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/ops-api.spec.ts --workers=1

const CONFIG = process.env.PW_WRANGLER_CONFIG ?? "";
const OPS_RUN = /wrangler\.ops\.test\.toml$/.test(CONFIG);
const STACK_RUN = OPS_RUN && /(^|\/)\.tmp\/ops-stack\/wrangler\.ops\.test\.toml$/.test(CONFIG);
test.skip(!OPS_RUN, "runs only with an ops test config (PW_WRANGLER_CONFIG=.tmp/wrangler.ops.test.toml or .tmp/ops-stack/...), see the header");

const OPS_HOST = "dashboard.almarprivatejourney.com";
const OPS_ORIGIN = `https://${OPS_HOST}`;
const OWNER_EMAIL = "maria@almarprivatejourney.com";
const ROUTES = ["blocks", "catalog", "destinations", "journeys", "publish", "stay-access", "stay-rates", "stays", "team"];
const GET_ROUTES = ROUTES.filter((r) => r !== "publish");

test.use({ extraHTTPHeaders: { host: OPS_HOST } });

const json = { "content-type": "application/json", origin: OPS_ORIGIN };

async function expectRefusal(res: Awaited<ReturnType<APIRequestContext["get"]>>, status: number, code: string, label: string) {
  expect(res.status(), label).toBe(status);
  expect(res.headers()["content-type"] ?? "", label).toMatch(/^application\/json/);
  // Next replaces a 404's Cache-Control with "private, no-cache, no-store, max-age=0, must-revalidate": no-store either way.
  expect(res.headers()["cache-control"] ?? "", label).toMatch(status === 404 ? /(^|, )no-store(,|$)/ : /^no-store$/);
  expect(res.headers()["x-robots-tag"], label).toBe("noindex");
  type Refusal = { code: string; field: string | null; locale: string | null; detail: unknown };
  const body = (await res.json()) as { ok: boolean; error: Refusal };
  expect(body, label).toEqual({ ok: false, error: { code, field: body.error.field, locale: body.error.locale, detail: body.error.detail } });
  return body.error;
}

test.describe("owner API on the built ops Worker: no owner session", () => {
  test("A1. the route list holds the nine /api/ops paths and nothing else under /api/ops", () => {
    const paths: string[] = JSON.parse(readFileSync(".open-next/almar-ops-routes.json", "utf8"));
    expect(paths.filter((p) => p.startsWith("/api/ops/")).sort()).toEqual(ROUTES.map((r) => `/api/ops/${r}`));
  });

  test("A2. every GET without a session is 403 not_owner, JSON, no-store, noindex", async ({ request }) => {
    for (const route of GET_ROUTES) await expectRefusal(await request.get(`/api/ops/${route}`, { maxRedirects: 0 }), 403, "not_owner", route);
    await expectRefusal(await request.get(`/api/ops/stays?id=11111111-1111-4111-8111-111111111111`, { maxRedirects: 0 }), 403, "not_owner", "detail");
  });

  test("A3. every POST without a session is 403 not_owner, whatever its origin, type or size (owner first)", async ({ request }) => {
    for (const route of ROUTES) {
      await expectRefusal(await request.post(`/api/ops/${route}`, { headers: json, data: { action: "save", item: {} }, maxRedirects: 0 }), 403, "not_owner", route);
    }
    const variants: Array<{ headers: Record<string, string>; data: string }> = [
      { headers: { "content-type": "application/json", origin: "https://evil.example" }, data: "{}" },
      { headers: { "content-type": "text/plain", origin: OPS_ORIGIN }, data: "{}" },
      { headers: { "content-type": "application/json" }, data: "{nope" },
      { headers: json, data: JSON.stringify({ t: "a".repeat(70_000) }) },
    ];
    for (const v of variants) await expectRefusal(await request.post("/api/ops/destinations", { ...v, maxRedirects: 0 }), 403, "not_owner", JSON.stringify(v.headers));
  });

  test("A4. a forged x-almar-shell or a forged session cookie is still not the owner", async ({ request }) => {
    await expectRefusal(await request.get("/api/ops/stays", { headers: { "x-almar-shell": "ops" }, maxRedirects: 0 }), 403, "not_owner", "forged shell");
    await expectRefusal(await request.get("/api/ops/stays", { headers: { cookie: "sb-127-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJ4In0" }, maxRedirects: 0 }), 403, "not_owner", "forged cookie");
  });

  test("A5. methods a route does not export answer 405, never a page", async ({ request }) => {
    expect((await request.fetch("/api/ops/stays", { method: "PUT", headers: json, data: "{}", maxRedirects: 0 })).status()).toBe(405);
    expect((await request.fetch("/api/ops/publish", { method: "GET", maxRedirects: 0 })).status()).toBe(405);
  });

  test("A6. no other host and no near miss reaches the owner API: the static 404", async ({ request }) => {
    for (const host of ["almarprivatejourney.com", "www.almarprivatejourney.com", "preview.almarprivatejourney.com", `${OPS_HOST}.evil.com`]) {
      for (const path of ["/api/ops/stays", "/api/ops/publish"]) {
        const res = await request.get(path, { headers: { host }, maxRedirects: 0 });
        expect(res.status(), `${host}${path}`).toBe(404);
        expect(res.headers()["x-robots-tag"], `${host}${path}`).toBe("noindex, nofollow");
      }
      const post = await request.post("/api/ops/destinations", { headers: { host, ...json }, data: "{}", maxRedirects: 0 });
      expect([404, 405], host).toContain(post.status());
    }
    for (const path of ["/api/ops", "/api/ops/", "/api/ops/stays/", "/api/ops/stays/x", "/API/ops/stays", "/api/ops/nope", "/dashboard/api/ops/stays"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
      expect(res.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    }
  });
});

// ---- Part B: signed in on the local stack ------------------------------------------------------------------------------

type Stack = { url: string; anonKey: string; serviceKey: string };

/** The local stack the Worker under test talks to: read from the .dev.vars that make-ops-stack-config.mjs wrote next to the config. */
function stackFromDevVars(): Stack {
  const vars = new Map<string, string>();
  for (const line of readFileSync(CONFIG.replace(/wrangler\.ops\.test\.toml$/, ".dev.vars"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars.set(m[1], m[2]);
  }
  const stack = { url: vars.get("NEXT_PUBLIC_SUPABASE_URL") ?? "", anonKey: vars.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "", serviceKey: vars.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" };
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(stack.url) || !stack.anonKey || !stack.serviceKey) throw new Error("the .dev.vars beside the config is not a local stack");
  return stack;
}

/** A signed-in session cookie for `email` on the local stack, built by @supabase/ssr itself (name and encoding exact). */
async function sessionCookie(stack: Stack, email: string): Promise<string> {
  const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error && !/already/i.test(created.error.message)) throw new Error(`createUser: ${created.error.message}`);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data.properties?.hashed_token) throw new Error(`generateLink: ${link.error?.message}`);
  const jar = new Map<string, string>();
  const client = createServerClient(stack.url, stack.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw new Error(`verifyOtp: ${verified.error.message}`);
  expect(jar.size).toBeGreaterThan(0);
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

test.describe("owner API on the built ops Worker: the owner signed in (local stack)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!STACK_RUN, "needs the local-stack config: PW_WRANGLER_CONFIG=.tmp/ops-stack/wrangler.ops.test.toml (see the header)");

  let owner = "";
  let guest = "";
  const created: string[] = [];

  test.beforeAll(async () => {
    const stack = stackFromDevVars();
    owner = await sessionCookie(stack, OWNER_EMAIL);
    guest = await sessionCookie(stack, "guest-ops-spec@example.com");
    const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await admin.from("profiles").select("email, role").in("email", [OWNER_EMAIL, "guest-ops-spec@example.com"]);
    expect(new Map((data ?? []).map((r) => [r.email, r.role]))).toEqual(new Map([[OWNER_EMAIL, "owner"], ["guest-ops-spec@example.com", "guest"]]));
  });

  test("B1. a signed-in guest is not the owner: 403 on GET and POST; the owner reads the list", async ({ request }) => {
    await expectRefusal(await request.get("/api/ops/destinations", { headers: { cookie: guest }, maxRedirects: 0 }), 403, "not_owner", "guest GET");
    await expectRefusal(await request.post("/api/ops/destinations", { headers: { ...json, cookie: guest }, data: { action: "reorder", ids: [] }, maxRedirects: 0 }), 403, "not_owner", "guest POST");
    const res = await request.get("/api/ops/destinations", { headers: { cookie: owner }, maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toBe("no-store");
    expect(res.headers()["x-robots-tag"]).toBe("noindex");
    expect(Array.isArray((await res.json()).items)).toBe(true);
    // The owner's cookie on another host never reaches the API.
    const other = await request.get("/api/ops/destinations", { headers: { cookie: owner, host: "almarprivatejourney.com" }, maxRedirects: 0 });
    expect(other.status()).toBe(404);
  });

  test("B2. the owner's POST rules: wrong or missing Origin 403, text/plain 415, over 64 KiB 413, bad JSON 400", async ({ request }) => {
    const send = (headers: Record<string, string>, data: string) => request.post("/api/ops/destinations", { headers: { cookie: owner, ...headers }, data, maxRedirects: 0 });
    await expectRefusal(await send({ "content-type": "application/json", origin: "https://evil.example" }, "{}"), 403, "wrong_origin", "evil origin");
    await expectRefusal(await send({ "content-type": "application/json" }, "{}"), 403, "wrong_origin", "no origin");
    await expectRefusal(await send({ "content-type": "application/json", origin: "http://dashboard.localhost:3010" }, "{}"), 403, "wrong_origin", "dev origin in production");
    await expectRefusal(await send({ "content-type": "text/plain", origin: OPS_ORIGIN }, "{}"), 415, "wrong_type", "text/plain");
    await expectRefusal(await send(json, JSON.stringify({ t: "a".repeat(70_000) })), 413, "too_large", "70 kB");
    expect((await expectRefusal(await send(json, "{nope"), 400, "invalid", "bad json")).field).toBe("body");
  });

  test("B3. job 10's open item: many POSTs with different bodies in one workerd session each reach the parser with their own body", async ({ request }) => {
    const post = (body: unknown) => request.post("/api/ops/destinations", { headers: { ...json, cookie: owner }, data: JSON.stringify(body), maxRedirects: 0 });

    // 1. Refusals that echo the first bad field of each body, alternating, in one session.
    const bad: Array<[unknown, string]> = [
      [{ action: "nope" }, "action"],
      [{ action: "delete", id: "x" }, "id"],
      [{ action: "reorder", ids: [] }, "ids"],
      [{ action: "save", item: { slug: "Bad Slug", translations: { en: { name: "x" } } } }, "slug"],
      [{ action: "save", item: { slug: "ok-slug", translations: { en: { name: "x".repeat(161) } } } }, "translations.en.name"],
      [{ action: "save", item: { slug: "ok-slug", translations: { en: { name: "x" } }, colour: "red" } }, "colour"],
    ];
    for (let round = 0; round < 3; round++) {
      for (const [body, field] of bad) {
        const error = await expectRefusal(await post(body), 400, "invalid", `${round}: ${field}`);
        expect(error.field, `${round}: ${JSON.stringify(body).slice(0, 80)}`).toBe(field);
      }
    }

    // 2. Saves of different sizes; each reads back byte for byte (the hash of what the route stored = what was sent).
    const texts: Array<[string, string]> = [
      ["A", "S"],
      ["Señorío en Cartagena · بيت", "Señorío en Cartagena · بيت في قرطاجنة. ".repeat(24)],
      ["B".repeat(160), "B".repeat(4000)],
      ["Ñ".repeat(150), "ñ"],
    ];
    for (const [i, [name, summary]] of texts.entries()) {
      const slug = `proof-${i}-${sha(name + summary).slice(0, 8)}`;
      const res = await post({ action: "save", item: { slug, translations: { en: { name, summary } } } });
      expect(res.status(), slug).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.affects_site).toBe(false);
      created.push(body.id);
      const read = await request.get(`/api/ops/destinations?id=${body.id}`, { headers: { cookie: owner }, maxRedirects: 0 });
      const item = (await read.json()).item;
      expect(item.slug).toBe(slug);
      expect(sha(item.translations.en.name)).toBe(sha(name.trim()));
      expect(sha(item.translations.en.summary)).toBe(sha(summary.trim()));
    }

    // 3. A body of about 48 KB (three 3,990-character summaries of 4-byte characters) is read whole; the next one, just
    //    over 64 KiB, is refused; then a small one works again.
    const big = { en: "😀".repeat(3990), ar: `ب${"😀".repeat(3989)}`, es: `ñ${"😀".repeat(3989)}` };
    const near = { action: "save", item: { id: created[0], translations: { en: { summary: big.en }, ar: { name: "ا", summary: big.ar }, es: { name: "e", summary: big.es } } } };
    const nearBytes = Buffer.byteLength(JSON.stringify(near));
    expect(nearBytes).toBeGreaterThan(45_000);
    expect(nearBytes).toBeLessThan(64 * 1024);
    expect((await post(near)).status()).toBe(200);
    const detail = (await (await request.get(`/api/ops/destinations?id=${created[0]}`, { headers: { cookie: owner } })).json()).item;
    expect(sha(detail.translations.en.summary)).toBe(sha(big.en));
    expect(sha(detail.translations.ar.summary)).toBe(sha(big.ar));
    expect(sha(detail.translations.es.summary)).toBe(sha(big.es));
    await expectRefusal(await post({ action: "save", item: { id: created[0], pad: "p".repeat(66_000) } }), 413, "too_large", "just over");
    const after = await post({ action: "delete", id: "x" });
    expect((await expectRefusal(after, 400, "invalid", "after a 413")).field).toBe("id");
  });

  test("B4. publish on the built Worker: refused with each gap, then the drafts are deleted", async ({ request }) => {
    const publish = await request.post("/api/ops/publish", {
      headers: { ...json, cookie: owner },
      data: { entity: "destination", id: created[1], published: true },
      maxRedirects: 0,
    });
    const error = await expectRefusal(publish, 409, "publish_incomplete", "publish");
    const missing = (error.detail as { missing: Array<{ locale: string | null; field: string }> }).missing;
    expect(missing).toEqual(expect.arrayContaining([{ locale: "ar", field: "name" }, { locale: "es", field: "name" }, { locale: null, field: "hero_media_id" }]));
    for (const id of created) {
      const res = await request.post("/api/ops/destinations", { headers: { ...json, cookie: owner }, data: { action: "delete", id }, maxRedirects: 0 });
      expect(await res.json()).toEqual({ ok: true, id, affects_site: false });
    }
    const gone = await request.get(`/api/ops/destinations?id=${created[0]}`, { headers: { cookie: owner }, maxRedirects: 0 });
    await expectRefusal(gone, 404, "not_found", "deleted");
  });
});
