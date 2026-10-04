import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isConfirmType, maskEmail, signContinue, verifyContinue } from "../lib/auth/continue.ts";
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
