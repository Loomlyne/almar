import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sendMagicLink } from "../lib/auth/send-link.ts";
import { isEmail, isOwnerProfile, OWNER_EMAIL } from "../lib/auth/rules.ts";
import { handoffExpiry, hashHandoffToken, HANDOFF_SECONDS, isHandoffToken, newHandoffToken } from "../lib/auth/handoff.ts";
import { DASHBOARD_COPY } from "../lib/copy/dashboard.ts";

const code = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

test("ops sign-in refuses a guest email without calling Supabase", async () => {
  let calls = 0;
  const deps = {
    claimSlot: async () => true,
    accountExists: async () => true,
    generateLink: async () => (calls++, { ok: true, tokenHash: "x", verificationType: "magiclink" }),
    sendEmail: async () => true,
  };
  const base = { origin: "https://dashboard.almarprivatejourney.com", host: "ops", ownerEmail: OWNER_EMAIL, isEmail };
  assert.deepEqual(await sendMagicLink({ ...base, email: "guest@example.com" }, deps), { status: "refused" });
  assert.equal(calls, 0);
  assert.deepEqual(await sendMagicLink({ ...base, email: OWNER_EMAIL }, deps), { status: "sent" });
  assert.equal(calls, 1);
});

test("the host comes from the middleware shell header, never from the caller", () => {
  const server = code("lib/auth/magic-link-server.ts");
  assert.match(server, /const host = \(await headers\(\)\)\.get\(SHELL_HEADER\) === "ops" \? "ops" : "public";/);
  for (const path of ["app/dashboard/actions.ts", "app/login/actions.ts"]) {
    const actions = code(path);
    assert.equal(/host:/.test(actions), false, path);
    assert.match(actions, /case "refused":\s*(\/\/[^\n]*\s*)?return \{ status: "refused", email \}/, path);
  }
  const screen = code("app/login/sign-in-screen.tsx");
  assert.match(screen, /state\.status === "refused"[\s\S]{0,80}copy\.auth\.cannotUseEmail/);
});

test("owner means the owner role and the owner email together", () => {
  assert.equal(isOwnerProfile({ role: "owner", email: OWNER_EMAIL }), true);
  assert.equal(isOwnerProfile({ role: "owner", email: "guest@example.com" }), false);
  assert.equal(isOwnerProfile({ role: "guest", email: OWNER_EMAIL }), false);
  assert.equal(isOwnerProfile(null), false);
});

test("TOUCHWORD: only an owner profile gets the handoff link", () => {
  const nav = code("lib/auth/nav-account.ts");
  assert.match(nav, /isOwnerProfile\(profile\) \? \{ opsHref: HANDOFF_START \}/);
  assert.match(nav, /HANDOFF_START = "\/auth\/handoff\/start"/);
  const menu = code("components/ui/account-menu.tsx");
  const anchor = menu.slice(menu.indexOf("account.opsHref ? ("), menu.indexOf("TOUCHWORD") + 40);
  assert.match(anchor, /target="_blank"/);
  assert.match(anchor, /rel="noopener noreferrer"/);
  assert.equal(/dashboard/i.test(anchor), false);
});

test("handoff tokens: random, 43 characters, stored only as a SHA-256 hash, five minutes", () => {
  const a = newHandoffToken();
  const b = newHandoffToken();
  assert.notEqual(a, b);
  assert.equal(isHandoffToken(a), true);
  assert.equal(isHandoffToken("short"), false);
  assert.equal(isHandoffToken("x".repeat(42) + "!"), false);
  assert.match(hashHandoffToken(a), /^[0-9a-f]{64}$/);
  assert.equal(HANDOFF_SECONDS, 300);
  assert.equal(handoffExpiry(new Date("2026-10-01T10:00:00Z")), "2026-10-01T10:05:00.000Z");
});

test("issuing a handoff: owner session on the public host only; the raw token is never stored", () => {
  const start = code("app/auth/handoff/start/route.ts");
  assert.match(start, /isOwnerProfile\(profile\)/);
  assert.match(start, /request\.headers\.get\(SHELL_HEADER\) === "ops"\) return home/);
  assert.match(start, /token_hash: hashHandoffToken\(token\)/);
  assert.equal(/\btoken: token\b|\btoken,\s*$/m.test(start), false);
  assert.match(start, /"Referrer-Policy": "no-referrer"/);
});

test("redeeming a handoff: ops host only, single use, unexpired, owner email, no redirect from the query", () => {
  const route = code("app/auth/handoff/route.ts");
  assert.match(route, /!onOps \|\| !isHandoffToken\(token\)/);
  assert.match(route, /\.is\("used_at", null\)/);
  assert.match(route, /\.gt\("expires_at"/);
  assert.match(route, /isOwnerEmail\(email\)/);
  assert.match(route, /"Referrer-Policy": "no-referrer"/);
  assert.equal(/searchParams\.get\("(next|redirect|returnTo)"\)/.test(route), false);
});

test("Logout-all is global scope; public and ops Sign out stay local", () => {
  assert.match(code("app/dashboard/actions.ts"), /signOut\(\{ scope: "global" \}\)/);
  const signOut = code("app/auth/sign-out/route.ts");
  assert.match(signOut, /scope: "local"/);
  assert.equal(signOut.includes("global"), false);
});

test("ops Sign out and Logout-all confirm with the locked label pairs", () => {
  const shell = code("app/dashboard/(ops)/ops-shell.tsx");
  assert.match(shell, /confirmLabel=\{copy\.signOutOfThisSite\}\s*cancelLabel=\{copy\.staySignedIn\}/);
  assert.match(shell, /confirmLabel=\{copy\.signOutEverywhere\}\s*cancelLabel=\{copy\.staySignedIn\}/);
  assert.equal(DASHBOARD_COPY.en.signOutEverywhere, "Sign out everywhere");
  assert.equal(DASHBOARD_COPY.en.signOutOfThisSite, "Sign out of this site");
  assert.equal(DASHBOARD_COPY.en.notReady, "Not ready.");
  const menu = code("components/ui/account-menu.tsx");
  assert.equal(menu.includes("ConfirmDialog"), false, "public Sign out does not confirm");
});
