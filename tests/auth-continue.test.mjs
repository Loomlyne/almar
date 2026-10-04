import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkContinue,
  continueMode,
  isConfirmType,
  isLinkNonce,
  maskEmail,
  newLinkNonce,
  signBrowser,
  signContinue,
  signEmail,
  verifyBrowser,
  verifyContinue,
  verifyEmail,
} from "../lib/auth/continue.ts";
import { sendMagicLink } from "../lib/auth/send-link.ts";
import { isEmail, OWNER_EMAIL } from "../lib/auth/rules.ts";

const KEY = "test-key-not-a-secret";

test("maskEmail keeps the first character and the domain, lowercased", () => {
  assert.equal(maskEmail("Lina@Gmail.com"), "l•••@gmail.com");
  assert.equal(maskEmail("  a@b.co "), "a•••@b.co");
  assert.equal(maskEmail("nope"), "");
});

test("sign and verify round trip", () => {
  const s = signContinue(KEY, "hash1", "l•••@gmail.com");
  assert.ok(s && /^[A-Za-z0-9_-]+$/.test(s));
  assert.equal(verifyContinue(KEY, "hash1", "l•••@gmail.com", s), true);
});

test("a tampered m, token, key, or signature fails", () => {
  const s = signContinue(KEY, "hash1", "l•••@gmail.com");
  assert.equal(verifyContinue(KEY, "hash1", "x•••@gmail.com", s), false);
  assert.equal(verifyContinue(KEY, "hash2", "l•••@gmail.com", s), false);
  assert.equal(verifyContinue("other-key", "hash1", "l•••@gmail.com", s), false);
  assert.equal(verifyContinue(KEY, "hash1", "l•••@gmail.com", s.slice(1)), false);
  assert.equal(verifyContinue(KEY, "hash1", "l•••@gmail.com", ""), false);
  assert.equal(verifyContinue(KEY, "hash1", "l•••@gmail.com", null), false);
});

test("a missing key gives no signature and never verifies", () => {
  assert.equal(signContinue(undefined, "hash1", "l•••@gmail.com"), undefined);
  assert.equal(signContinue("", "hash1", "l•••@gmail.com"), undefined);
  assert.equal(verifyContinue(undefined, "hash1", "l•••@gmail.com", "abc"), false);
});

test("only the three link types are allowed", () => {
  for (const t of ["magiclink", "signup", "email"]) assert.equal(isConfirmType(t), true);
  for (const t of ["recovery", "invite", "", null, undefined]) assert.equal(isConfirmType(t), false);
});

function run(continueProof) {
  const sent = [];
  const deps = {
    claimSlot: async () => true,
    accountExists: async () => false,
    generateLink: async () => ({ ok: true, tokenHash: "h1", verificationType: "signup" }),
    sendEmail: async (m) => (sent.push(m), true),
    ...(continueProof ? { continueProof } : {}),
  };
  return sendMagicLink(
    { email: "Lina@Gmail.com", origin: "https://almarprivatejourney.com", host: "public", ownerEmail: OWNER_EMAIL, isEmail },
    deps,
  ).then(() => new URL(sent[0].href));
}

test("the confirm URL carries m and s when signed, and verifies", async () => {
  const href = await run((tokenHash, email) => {
    const m = maskEmail(email);
    return { m, s: signContinue(KEY, tokenHash, m) };
  });
  assert.equal(href.searchParams.get("m"), "l•••@gmail.com");
  assert.equal(href.searchParams.get("token_hash"), "h1");
  assert.equal(verifyContinue(KEY, "h1", href.searchParams.get("m"), href.searchParams.get("s")), true);
});

test("the confirm URL carries neither m nor s without a proof", async () => {
  const href = await run(undefined);
  assert.equal(href.searchParams.has("m"), false);
  assert.equal(href.searchParams.has("s"), false);
});

test("the confirm page never verifies on GET", () => {
  const source = readFileSync("app/auth/confirm/page.tsx", "utf8");
  assert.equal(source.includes("verifyOtp"), false);
  assert.throws(() => readFileSync("app/auth/confirm/route.ts"));
  assert.ok(readFileSync("app/auth/confirm/actions.ts", "utf8").includes("verifyOtp"));
});

// Plan 02-26 task 2: the forwarded-link check.
const HASH = "a".repeat(56);

test("a nonce is 32 random bytes, base64url, and different every time", () => {
  const a = newLinkNonce();
  assert.equal(isLinkNonce(a), true);
  assert.equal(Buffer.from(a, "base64url").length, 32);
  assert.notEqual(a, newLinkNonce());
  for (const bad of ["", "short", `${a}x`, null, undefined, 5]) assert.equal(isLinkNonce(bad), false);
});

test("b round trip; a wrong nonce, a tampered token_hash, another key, a missing b all fail", () => {
  const nonce = newLinkNonce();
  const b = signBrowser(KEY, nonce, HASH);
  assert.ok(b && /^[A-Za-z0-9_-]+$/.test(b));
  assert.equal(verifyBrowser(KEY, nonce, HASH, b), true);
  assert.equal(verifyBrowser(KEY, newLinkNonce(), HASH, b), false);
  assert.equal(verifyBrowser(KEY, nonce, "b".repeat(56), b), false);
  assert.equal(verifyBrowser("other-key", nonce, HASH, b), false);
  assert.equal(verifyBrowser(KEY, nonce, HASH, undefined), false);
  assert.equal(verifyBrowser(KEY, nonce, HASH, b.slice(1)), false);
  assert.equal(verifyBrowser(KEY, undefined, HASH, b), false);
  assert.equal(verifyBrowser(KEY, "not-a-nonce", HASH, b), false);
  assert.equal(signBrowser(undefined, nonce, HASH), undefined);
});

test("e round trip on the normalised email; a wrong email, a tampered token_hash, an empty email fail", () => {
  const e = signEmail(KEY, "Lina@Gmail.com", HASH);
  assert.ok(e && /^[A-Za-z0-9_-]+$/.test(e));
  assert.equal(verifyEmail(KEY, "  lina@gmail.COM ", HASH, e), true);
  assert.equal(verifyEmail(KEY, "other@gmail.com", HASH, e), false);
  assert.equal(verifyEmail(KEY, "lina@gmail.com", "b".repeat(56), e), false);
  assert.equal(verifyEmail(KEY, "", HASH, e), false);
  assert.equal(verifyEmail(KEY, null, HASH, e), false);
  assert.equal(verifyEmail(KEY, "lina@gmail.com", HASH, undefined), false);
  assert.equal(verifyEmail("other-key", "lina@gmail.com", HASH, e), false);
  assert.equal(signEmail(undefined, "lina@gmail.com", HASH), undefined);
});

test("b and e do not stand in for each other or for s", () => {
  const nonce = newLinkNonce();
  const b = signBrowser(KEY, nonce, HASH);
  const e = signEmail(KEY, nonce, HASH);
  assert.notEqual(b, e);
  assert.equal(verifyEmail(KEY, "lina@gmail.com", HASH, b), false);
  assert.equal(verifyBrowser(KEY, nonce, HASH, signContinue(KEY, HASH, "l•••@gmail.com")), false);
});

test("continueMode and checkContinue: browser, email, wrong email, closed", () => {
  const nonce = newLinkNonce();
  const b = signBrowser(KEY, nonce, HASH);
  const e = signEmail(KEY, "lina@gmail.com", HASH);
  const base = { key: KEY, tokenHash: HASH, b, e };
  assert.equal(continueMode(KEY, nonce, HASH, b), "browser");
  assert.equal(continueMode(KEY, undefined, HASH, b), "email");
  assert.equal(continueMode(KEY, newLinkNonce(), HASH, b), "email");
  assert.equal(continueMode(KEY, nonce, HASH, undefined), "email");
  assert.equal(continueMode(undefined, nonce, HASH, b), "closed");
  assert.equal(checkContinue({ ...base, nonce, email: "" }), "ok");
  assert.equal(checkContinue({ ...base, nonce: undefined, email: "Lina@gmail.com" }), "ok");
  assert.equal(checkContinue({ ...base, nonce: undefined, email: "other@gmail.com" }), "wrong-email");
  assert.equal(checkContinue({ ...base, nonce: undefined, email: "" }), "wrong-email");
  assert.equal(checkContinue({ ...base, nonce: undefined, email: "lina@gmail.com", e: undefined }), "wrong-email");
  assert.equal(checkContinue({ ...base, key: undefined, nonce, email: "lina@gmail.com" }), "closed");
});

test("the confirm URL carries b and e, never the email", async () => {
  const nonce = newLinkNonce();
  const href = await run((tokenHash, email) => ({
    b: signBrowser(KEY, nonce, tokenHash),
    e: signEmail(KEY, email, tokenHash),
  }));
  assert.equal(verifyBrowser(KEY, nonce, "h1", href.searchParams.get("b")), true);
  assert.equal(verifyEmail(KEY, "lina@gmail.com", "h1", href.searchParams.get("e")), true);
  assert.equal(href.searchParams.has("m"), false);
  assert.equal(/lina|gmail/i.test(href.toString()), false);
});

test("confirmSignIn: shape, then slot, then the check, then verifyOtp; a wrong email never reaches verifyOtp", () => {
  const source = readFileSync("app/auth/confirm/actions.ts", "utf8");
  const at = (needle) => {
    const i = source.indexOf(needle);
    assert.ok(i > 0, `missing ${needle}`);
    return i;
  };
  const shape = at("isTokenHashShape(tokenHash)");
  const slot = at('admin.rpc("claim_confirm_slot"');
  const check = at("checkContinue({");
  const wrong = at('verdict === "wrong-email"');
  const closed = at('verdict === "closed"');
  const spend = at("supabase.auth.verifyOtp");
  assert.ok(shape < slot && slot < check && check < wrong && wrong < spend && closed < spend);
  assert.equal(source.split("verifyOtp(").length - 1, 1);
  // a wrong email returns a state; it does not redirect and does not spend
  assert.match(source, /verdict === "wrong-email"\) return \{ status: "wrong-email"/);
});

test("the page and the button read the cookie nonce, the hidden b and e; the screen posts them", () => {
  const page = readFileSync("app/auth/confirm/page.tsx", "utf8");
  assert.ok(page.includes("continueMode(") && page.includes("LINK_NONCE_COOKIE"));
  assert.equal(page.includes("verifyOtp"), false);
  const screen = readFileSync("app/auth/confirm/continue-screen.tsx", "utf8");
  for (const name of ['name="b"', 'name="e"', 'name="email"', "copy.why", "copy.wrongEmail"]) assert.ok(screen.includes(name), name);
});

test("both sign-in actions get the nonce cookie from the shared sender: httpOnly, Lax, Secure in production, 1 hour", () => {
  const server = readFileSync("lib/auth/magic-link-server.ts", "utf8");
  assert.match(server, /store\.set\(LINK_NONCE_COOKIE, nonce, \{[^}]*httpOnly: true[^}]*sameSite: "lax"[^}]*secure: process\.env\.NODE_ENV === "production"[^}]*path: "\/"[^}]*maxAge: LINK_NONCE_MAX_AGE/s);
  assert.ok(server.includes("isLinkNonce(existing)"));
  for (const file of ["app/login/actions.ts", "app/dashboard/actions.ts"]) {
    assert.ok(readFileSync(file, "utf8").includes("sendLinkFromRequest"), file);
  }
});
