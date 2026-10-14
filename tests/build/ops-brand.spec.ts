import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Plan 02-06 (D-110, D-113): the dashboard wears the saved brand, proven on the BUILT ops Worker (local `wrangler dev`,
// never --remote) against this worktree's local Supabase stack, the owner signed in. The (ops) layout reads the settings
// row on every request: a saved Teal is a CSS variable in the page, a saved logo is the shell's header image (from the
// image host); with nothing saved the page is the design system's.
//   node tests/helpers/local-supabase.mjs start && node tests/helpers/local-supabase.mjs reset
//   node scripts/assemble-cloudflare.mjs --target=ops && node tests/build/make-ops-stack-config.mjs
//   PW_READY_PATH=/api/health PW_WRANGLER_CONFIG=.tmp/ops-stack/wrangler.ops.test.toml PW_PORT=<free> \
//     npx playwright test -c playwright.build.config.ts tests/build/ops-brand.spec.ts --workers=1
// Bodies are never printed.

const CONFIG = process.env.PW_WRANGLER_CONFIG ?? "";
const STACK_RUN = /(^|\/)\.tmp\/ops-stack\/wrangler\.ops\.test\.toml$/.test(CONFIG);
test.skip(!STACK_RUN, "needs the local-stack ops config: PW_WRANGLER_CONFIG=.tmp/ops-stack/wrangler.ops.test.toml (see the header)");

const OPS_HOST = "dashboard.almarprivatejourney.com";
const OWNER_EMAIL = "maria@almarprivatejourney.com";
const SAVED_TEAL = "#7a1f3b";
const LOGO_ID = "00000000-0000-4000-8000-0000000002b6";
const LOGO_KEY = "uploads/ops-brand-spec.webp";

test.use({ extraHTTPHeaders: { host: OPS_HOST } });
test.describe.configure({ mode: "serial" });

type Stack = { url: string; anonKey: string; serviceKey: string };

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

async function ownerCookie(stack: Stack): Promise<string> {
  const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await admin.auth.admin.createUser({ email: OWNER_EMAIL, email_confirm: true });
  if (created.error && !/already/i.test(created.error.message)) throw new Error(`createUser: ${created.error.message}`);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: OWNER_EMAIL });
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
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function rest(request: APIRequestContext, stack: Stack, method: "POST" | "PATCH" | "DELETE", path: string, data?: unknown) {
  const res = await request.fetch(`${stack.url}/rest/v1/${path}`, {
    method,
    headers: { apikey: stack.serviceKey, authorization: `Bearer ${stack.serviceKey}`, "content-type": "application/json", prefer: "return=minimal,resolution=merge-duplicates", host: new URL(stack.url).host },
    data,
  });
  expect(res.status(), `${method} ${path.split("?")[0]}`).toBeLessThan(300);
}

let stack: Stack;
let cookie = "";

test.beforeAll(async ({ playwright }) => {
  stack = stackFromDevVars();
  cookie = await ownerCookie(stack);
  const request = await playwright.request.newContext();
  await rest(request, stack, "POST", "media", { id: LOGO_ID, key: LOGO_KEY, width: 512, height: 512, bytes: 2048, content_type: "image/webp", sha256: "e".repeat(64), source: "upload" });
  await request.dispose();
});

test.afterAll(async ({ playwright }) => {
  const request = await playwright.request.newContext();
  await rest(request, stack, "PATCH", "site_settings?id=eq.1", { teal: null, logo_media_id: null });
  await rest(request, stack, "DELETE", `media?id=eq.${LOGO_ID}`);
  await request.dispose();
});

async function settingsPage(request: APIRequestContext): Promise<string> {
  const res = await request.get("/settings", { headers: { cookie }, maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^text\/html/);
  return res.text();
}

test("with nothing saved, the dashboard is the design system's (no brand style, the wordmark in the header)", async ({ playwright, request }) => {
  const admin = await playwright.request.newContext();
  await rest(admin, stack, "PATCH", "site_settings?id=eq.1", { teal: null, logo_media_id: null });
  await admin.dispose();
  const html = await settingsPage(request);
  expect(html.includes('id="almar-brand"')).toBe(false);
  expect(/<img[^>]*alt="ALMAR"[^>]*src="\/_next\/static\/media\/Stacked_Charcoal\.[0-9a-f]+\.svg"/.test(html)).toBe(true);
});

test("a saved Teal and logo are in the next page: CSS variables, and the logo from the image host in the header", async ({ playwright, request }) => {
  const admin = await playwright.request.newContext();
  await rest(admin, stack, "PATCH", "site_settings?id=eq.1", { teal: SAVED_TEAL, logo_media_id: LOGO_ID });
  await admin.dispose();
  const html = await settingsPage(request);
  expect(html.includes(`<style id="almar-brand">:root{--color-teal:${SAVED_TEAL};--color-teal-hover:`)).toBe(true);
  expect(new RegExp(`<img[^>]*alt="ALMAR"[^>]*src="https://media\\.almarprivatejourney\\.com/${LOGO_KEY.replace(/[.]/g, "\\.")}"`).test(html)).toBe(true);
});
