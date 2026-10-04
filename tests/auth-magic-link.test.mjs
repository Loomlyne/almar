import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sendMagicLink } from "../lib/auth/send-link.ts";
import { isEmail, OWNER_EMAIL, safeReturnPath } from "../lib/auth/rules.ts";
import { linkOrigin } from "../lib/auth/allowed-origin.ts";
import { renderMagicLinkEmail } from "../lib/email/magic-link.ts";
import { GUEST_COPY } from "../lib/copy/guest.ts";

const code = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

function fakeDeps({ claim = true, exists = false, link = { ok: true, tokenHash: "hash123", verificationType: "magiclink" }, sendOk = true } = {}) {
  const calls = { generate: [], send: [], claim: [] };
  return {
    calls,
    deps: {
      claimSlot: async (email) => {
        calls.claim.push(email);
        if (claim instanceof Error) throw claim;
        return claim;
      },
      accountExists: async () => exists,
      generateLink: async (email) => {
        calls.generate.push(email);
        return link;
      },
      sendEmail: async (input) => {
        calls.send.push(input);
        return sendOk;
      },
    },
  };
}

const base = { origin: "https://almarprivatejourney.com", host: "public", ownerEmail: OWNER_EMAIL, isEmail };

test("an unknown email gets a link that creates the account (confirm email)", async () => {
  const { deps, calls } = fakeDeps({ exists: false, link: { ok: true, tokenHash: "h1", verificationType: "signup" } });
  const result = await sendMagicLink({ ...base, email: " New@Guest.com " }, deps);
  assert.deepEqual(result, { status: "sent" });
  assert.deepEqual(calls.generate, ["new@guest.com"]);
  assert.equal(calls.send[0].kind, "confirm");
  const href = new URL(calls.send[0].href);
  assert.equal(href.origin, "https://almarprivatejourney.com");
  assert.equal(href.pathname, "/auth/confirm");
  assert.equal(href.searchParams.get("token_hash"), "h1");
  assert.equal(href.searchParams.get("type"), "signup");
});

test("a known email gets a sign-in link", async () => {
  const { deps, calls } = fakeDeps({ exists: true });
  await sendMagicLink({ ...base, email: "guest@example.com" }, deps);
  assert.equal(calls.send[0].kind, "sign-in");
});

test("an invalid email calls nothing", async () => {
  const { deps, calls } = fakeDeps();
  assert.deepEqual(await sendMagicLink({ ...base, email: "not-an-email" }, deps), { status: "invalid" });
  assert.equal(calls.generate.length, 0);
});

test("the owner email never creates an account and leaks nothing", async () => {
  const { deps, calls } = fakeDeps({ exists: false });
  assert.deepEqual(await sendMagicLink({ ...base, email: OWNER_EMAIL }, deps), { status: "sent" });
  assert.equal(calls.generate.length, 0);
  assert.equal(calls.send.length, 0);
});

test("the ops host refuses a guest email without calling Supabase", async () => {
  const { deps, calls } = fakeDeps({ exists: true });
  const result = await sendMagicLink({ ...base, host: "ops", email: "guest@example.com" }, deps);
  assert.deepEqual(result, { status: "refused" });
  assert.equal(calls.generate.length, 0);
});

test("a provider wait comes back as seconds; other failures are unavailable", async () => {
  const wait = fakeDeps({ link: { ok: false, retryAfterSeconds: 37 } });
  assert.deepEqual(await sendMagicLink({ ...base, email: "a@b.co" }, wait.deps), { status: "wait", seconds: 37 });
  const down = fakeDeps({ link: { ok: false } });
  assert.deepEqual(await sendMagicLink({ ...base, email: "a@b.co" }, down.deps), { status: "unavailable" });
  const mail = fakeDeps({ sendOk: false });
  assert.deepEqual(await sendMagicLink({ ...base, email: "a@b.co" }, mail.deps), { status: "unavailable" });
});

test("over the limit says sent and generates and sends nothing", async () => {
  const { deps, calls } = fakeDeps({ claim: false });
  assert.deepEqual(await sendMagicLink({ ...base, email: "New@Guest.com" }, deps), { status: "sent" });
  assert.deepEqual(calls.claim, ["new@guest.com"]);
  assert.equal(calls.generate.length, 0);
  assert.equal(calls.send.length, 0);
});

test("a limiter failure is unavailable and sends nothing", async () => {
  const { deps, calls } = fakeDeps({ claim: new Error("rpc down") });
  assert.deepEqual(await sendMagicLink({ ...base, email: "a@b.co" }, deps), { status: "unavailable" });
  assert.equal(calls.generate.length, 0);
  assert.equal(calls.send.length, 0);
});

test("the limit is not touched for an invalid email or an ops refusal", async () => {
  const bad = fakeDeps();
  await sendMagicLink({ ...base, email: "nope" }, bad.deps);
  assert.equal(bad.calls.claim.length, 0);
  const ops = fakeDeps();
  await sendMagicLink({ ...base, host: "ops", email: "guest@example.com" }, ops.deps);
  assert.equal(ops.calls.claim.length, 0);
});

test("the server hashes the email and IP, fails closed and never logs them", () => {
  const server = code("lib/auth/magic-link-server.ts");
  assert.match(server, /createHash\("sha256"\)/);
  assert.match(server, /rpc\("claim_link_slot"/);
  assert.match(server, /x-forwarded-for/);
  assert.match(server, /typeof data !== "boolean"/);
  assert.equal(/console\./.test(server), false);
});

test("return paths stay on this site", () => {
  assert.equal(safeReturnPath("/account"), "/account");
  for (const bad of ["/login", "/login?expired=1", "/auth/confirm", "/LOGIN", "//evil.com", "/\\evil.com", "https://evil.com", "account", "", null, "/a\nb"]) {
    assert.equal(safeReturnPath(bad), "/", String(bad));
  }
});

test("links are only built for ALMAR hosts", () => {
  assert.equal(linkOrigin("almarprivatejourney.com", "production"), "https://almarprivatejourney.com");
  assert.equal(linkOrigin("dashboard.almarprivatejourney.com", "production"), "https://dashboard.almarprivatejourney.com");
  assert.equal(linkOrigin("evil.com", "production"), "https://almarprivatejourney.com");
  assert.equal(linkOrigin("127.0.0.1:3010", "production"), "https://almarprivatejourney.com");
  assert.equal(linkOrigin("127.0.0.1:3010", "development"), "http://127.0.0.1:3010");
});

test("the public email has the button, no password, no dashboard, and escapes the link", () => {
  for (const locale of ["en", "ar", "es"]) {
    const copy = { ...GUEST_COPY[locale].mail, button: GUEST_COPY[locale].accessWithMagicLink };
    const mail = renderMagicLinkEmail({ href: 'https://almarprivatejourney.com/auth/confirm?token_hash=a"b&type=email', locale, kind: "confirm", copy });
    assert.equal(/dashboard|password|contraseña|كلمة المرور/i.test(mail.html + mail.text), false);
    assert.ok(mail.html.includes(copy.button));
    assert.ok(mail.html.includes("a&quot;b&amp;type"));
    assert.equal(mail.subject, copy.subjectConfirm);
    assert.ok(mail.html.includes(`dir="${locale === "ar" ? "rtl" : "ltr"}"`));
  }
  assert.throws(() => renderMagicLinkEmail({ href: "javascript:alert(1)", locale: "en", kind: "sign-in", copy: { ...GUEST_COPY.en.mail, button: "x" } }));
});

test("sign-in screen: one email field, no password, no create tab", () => {
  const screen = code("app/login/sign-in-screen.tsx");
  assert.equal(screen.includes('type="password"'), false);
  assert.equal(/role="tab"|Create account/.test(screen), false);
  assert.match(screen, /requestSignIn/);
});

test("confirm route verifies the token and reads no redirect from the query", () => {
  const route = code("app/auth/confirm/route.ts");
  assert.match(route, /verifyOtp/);
  assert.equal(/searchParams\.get\("(next|redirect|redirect_to|returnTo)"\)/.test(route), false);
  assert.match(route, /safeReturnPath/);
});

test("login page reads the return key from a fixed list only", () => {
  const page = code("app/login/page.tsx");
  assert.match(page, /Object\.hasOwn\(RETURN_KEYS/);
});

test("every path job 02 opens runs through the middleware, so the shell-header strip always runs", async () => {
  const { JOB02_SERVER_PATHS } = await import("../lib/auth/server-paths.ts");
  assert.ok(JOB02_SERVER_PATHS.includes("/auth/handoff/start"));
  const source = readFileSync("middleware.ts", "utf8");
  const matcher = source.match(/matcher:\s*\[\s*"((?:[^"\\]|\\.)*)"\s*\]/);
  assert.ok(matcher, "middleware matcher not found");
  const pattern = new RegExp(`^${JSON.parse(`"${matcher[1]}"`)}$`);
  for (const path of JOB02_SERVER_PATHS) {
    assert.ok(pattern.test(path), `${path} is skipped by the middleware matcher`);
    assert.ok(pattern.test(`/ar${path}`) && pattern.test(`/es${path}`), `/ar|/es${path} is skipped`);
  }
  assert.equal(pattern.test("/assets/x.png"), false, "the matcher still skips static assets");
});
