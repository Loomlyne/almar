// Plan 04-02, Task 2: the booking reference, the signed booking link, the allowed origins and the terms constants.
// Pure modules in lib/booking; only lib/booking/link.ts reads the environment (BOOKING_LINK_SECRET).
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const refMod = await loadTs("lib/booking/ref.ts");
const tokenMod = await loadTs("lib/booking/link-token.ts");
const linkMod = await loadTs("lib/booking/link.ts");
const originMod = await loadTs("lib/booking/origin.ts");
const termsMod = await loadTs("lib/booking/terms.ts");

const { REF_ALPHABET, isBookingRef } = refMod;
const { hmacBookingLink, checkBookingLink } = tokenMod;
const { bookingLinkConfigured, signBookingLink, verifyBookingLink } = linkMod;
const { bookingOrigin, allowedBookingOrigins, isAllowedPostOrigin } = originMod;

const SECRET = "test-secret-test-secret-test-secret-0123456789"; // a symbolic test value, 46 characters
const ID = "7f1c2a3e-1111-4222-8333-444455556666";

// ---------------------------------------------------------------- ref.ts

test("the reference alphabet has 31 letters and no I, L, O, 0 or 1 (B-17)", () => {
  assert.equal(REF_ALPHABET, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
  assert.equal(REF_ALPHABET.length, 31);
  assert.equal(new Set(REF_ALPHABET).size, 31);
  for (const bad of ["I", "L", "O", "0", "1"]) assert.equal(REF_ALPHABET.includes(bad), false, bad);
});

test("isBookingRef accepts ALMAR- plus six letters of the alphabet and nothing else", () => {
  assert.equal(isBookingRef("ALMAR-7K3QH9"), true);
  for (const bad of [
    "almar-7K3QH9", "ALMAR-7k3qh9", "ALMAR-7K3QI9", "ALMAR-7K3QL9", "ALMAR-7K3QO9", "ALMAR-7K3Q09", "ALMAR-7K3Q19",
    "ALMAR-7K3QH", "ALMAR-7K3QH99", "ALMAR7K3QH9", " ALMAR-7K3QH9", "ALMAR-7K3QH9 ", "ALMAR-7K3QH9\n", "ALMAR-7K3QH9-", "",
    null, undefined, 123456, {}, ["ALMAR-7K3QH9"],
  ]) {
    assert.equal(isBookingRef(bad), false, JSON.stringify(bad));
  }
});

// ---------------------------------------------------------------- link-token.ts

test("the token is the base64url HMAC-SHA256 of booking-link:v1:<id>:<version>, checked against node:crypto", async () => {
  const token = await hmacBookingLink(SECRET, ID, 1);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const expected = createHmac("sha256", SECRET).update(`booking-link:v1:${ID}:1`).digest("base64url");
  assert.equal(token, expected);
  assert.equal(await hmacBookingLink(SECRET, ID, 1), token, "deterministic");
});

test("the token follows the id, the version and the secret", async () => {
  const token = await hmacBookingLink(SECRET, ID, 1);
  assert.notEqual(await hmacBookingLink(SECRET, ID, 2), token);
  assert.notEqual(await hmacBookingLink(SECRET, "7f1c2a3e-1111-4222-8333-444455556667", 1), token);
  assert.notEqual(await hmacBookingLink(`${SECRET}x`, ID, 1), token);
});

test("checkBookingLink: the right token passes; a wrong id, version, secret or token fails", async () => {
  const token = await hmacBookingLink(SECRET, ID, 3);
  assert.equal(await checkBookingLink(SECRET, ID, 3, token), true);
  assert.equal(await checkBookingLink(SECRET, ID, 4, token), false, "version bumped: the old link is revoked");
  assert.equal(await checkBookingLink(SECRET, "7f1c2a3e-1111-4222-8333-444455556667", 3, token), false);
  assert.equal(await checkBookingLink(`${SECRET}x`, ID, 3, token), false);
  assert.equal(await checkBookingLink(SECRET, ID, 3, token.slice(0, -1)), false, "truncated");
  assert.equal(await checkBookingLink(SECRET, ID, 3, `${token}A`), false, "extended");
  assert.equal(await checkBookingLink(SECRET, ID, 3, `${token.slice(0, 20)}${token[20] === "A" ? "B" : "A"}${token.slice(21)}`), false, "one character changed");
  for (const bad of ["", " ", "not base64 !!", "%%%%", null, undefined, 42, {}]) {
    assert.equal(await checkBookingLink(SECRET, ID, 3, bad), false, JSON.stringify(bad));
  }
});

test("a secret shorter than 32 characters throws on sign and never verifies", async () => {
  await assert.rejects(() => hmacBookingLink("short", ID, 1));
  await assert.rejects(() => hmacBookingLink("x".repeat(31), ID, 1));
  await assert.doesNotReject(() => hmacBookingLink("x".repeat(32), ID, 1));
  const good = await hmacBookingLink(SECRET, ID, 1);
  assert.equal(await checkBookingLink("short", ID, 1, good), false);
});

test("the comparison is the platform's constant-time verify, never a string comparison", () => {
  const source = readFileSync("lib/booking/link-token.ts", "utf8");
  assert.match(source, /subtle\.verify/);
  assert.doesNotMatch(source, /token\s*===|===\s*token|expected\s*===|===\s*expected/);
});

// ---------------------------------------------------------------- link.ts

async function withSecret(value, fn) {
  const before = process.env.BOOKING_LINK_SECRET;
  if (value === undefined) delete process.env.BOOKING_LINK_SECRET;
  else process.env.BOOKING_LINK_SECRET = value;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env.BOOKING_LINK_SECRET;
    else process.env.BOOKING_LINK_SECRET = before;
  }
}

test("link.ts signs and verifies with BOOKING_LINK_SECRET", async () => {
  await withSecret(SECRET, async () => {
    assert.equal(bookingLinkConfigured(), true);
    const token = await signBookingLink(ID, 1);
    assert.equal(token, createHmac("sha256", SECRET).update(`booking-link:v1:${ID}:1`).digest("base64url"));
    assert.equal(await verifyBookingLink(ID, 1, token), true);
    assert.equal(await verifyBookingLink(ID, 2, token), false);
    assert.equal(await verifyBookingLink(ID, 1, "nope"), false);
  });
});

test("link.ts without a secret: sign throws 'booking link secret missing', verify is false, configured is false", async () => {
  await withSecret(undefined, async () => {
    assert.equal(bookingLinkConfigured(), false);
    await assert.rejects(() => signBookingLink(ID, 1), /booking link secret missing/);
    assert.equal(await verifyBookingLink(ID, 1, "anything"), false);
  });
  await withSecret("   ", async () => {
    assert.equal(bookingLinkConfigured(), false);
    await assert.rejects(() => signBookingLink(ID, 1), /booking link secret missing/);
  });
  await withSecret("x".repeat(31), async () => {
    assert.equal(bookingLinkConfigured(), false, "a secret under 32 characters is not configured");
    assert.equal(await verifyBookingLink(ID, 1, "anything"), false);
  });
});

test("only link.ts reads the environment, and it reads only BOOKING_LINK_SECRET", () => {
  for (const file of ["types", "validate", "ref", "link-token", "terms", "access"]) {
    assert.doesNotMatch(readFileSync(`lib/booking/${file}.ts`, "utf8"), /process\.env/, file);
  }
  assert.deepEqual([...readFileSync("lib/booking/link.ts", "utf8").matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i), ["BOOKING_LINK_SECRET"]);
});

// ---------------------------------------------------------------- origin.ts

const PUBLIC = "https://almarprivatejourney.com";
const WWW = "https://www.almarprivatejourney.com";
const PREVIEW = "https://preview.almarprivatejourney.com";

test("allowedBookingOrigins lists the production, www and preview origins", () => {
  assert.deepEqual([...allowedBookingOrigins()].sort(), [PREVIEW, PUBLIC, WWW].sort());
});

test("bookingOrigin: the three public hosts map to their own https origin, in any case and with spaces", () => {
  assert.equal(bookingOrigin("almarprivatejourney.com", "production", undefined), PUBLIC);
  assert.equal(bookingOrigin("www.almarprivatejourney.com", "production", undefined), WWW);
  assert.equal(bookingOrigin("preview.almarprivatejourney.com", "production", undefined), PREVIEW);
  assert.equal(bookingOrigin(" Preview.AlmarPrivateJourney.com ", "production", undefined), PREVIEW);
});

test("bookingOrigin: dev hosts get a plain http origin only outside production", () => {
  assert.equal(bookingOrigin("127.0.0.1:3131", "development", undefined), "http://127.0.0.1:3131");
  assert.equal(bookingOrigin("localhost:3000", "test", undefined), "http://localhost:3000");
  assert.equal(bookingOrigin("127.0.0.1:3131", undefined, undefined), "http://127.0.0.1:3131");
  assert.equal(bookingOrigin("127.0.0.1:3131", "production", undefined), PUBLIC, "never in production");
  assert.equal(bookingOrigin("localhost", "production", undefined), PUBLIC);
});

test("bookingOrigin: any other host (the ops host) gets PUBLIC_ORIGIN only when it is one of the three https origins, else the canonical one", () => {
  const ops = "dashboard.almarprivatejourney.com";
  assert.equal(bookingOrigin(ops, "production", PREVIEW), PREVIEW);
  assert.equal(bookingOrigin(ops, "production", WWW), WWW);
  assert.equal(bookingOrigin(ops, "production", PUBLIC), PUBLIC);
  assert.equal(bookingOrigin(ops, "production", undefined), PUBLIC);
  assert.equal(bookingOrigin(ops, "production", ""), PUBLIC);
  for (const bad of ["https://evil.example", "http://almarprivatejourney.com", `${PREVIEW}/`, `${PREVIEW}/x`, "preview.almarprivatejourney.com", "https://almarprivatejourney.com.evil.example", "javascript:alert(1)"]) {
    assert.equal(bookingOrigin(ops, "production", bad), PUBLIC, bad);
  }
  assert.equal(bookingOrigin("evil.example", "production", undefined), PUBLIC);
  assert.equal(bookingOrigin(null, "production", undefined), PUBLIC);
  assert.equal(bookingOrigin(undefined, "production", undefined), PUBLIC);
});

test("bookingOrigin's default publicOrigin is process.env.PUBLIC_ORIGIN", () => {
  const before = process.env.PUBLIC_ORIGIN;
  try {
    process.env.PUBLIC_ORIGIN = PREVIEW;
    assert.equal(bookingOrigin("dashboard.almarprivatejourney.com", "production"), PREVIEW);
    delete process.env.PUBLIC_ORIGIN;
    assert.equal(bookingOrigin("dashboard.almarprivatejourney.com", "production"), PUBLIC);
  } finally {
    if (before === undefined) delete process.env.PUBLIC_ORIGIN;
    else process.env.PUBLIC_ORIGIN = before;
  }
});

test("isAllowedPostOrigin: true only when the Origin header equals the booking origin of the Host", () => {
  assert.equal(isAllowedPostOrigin(PUBLIC, "almarprivatejourney.com", "production"), true);
  assert.equal(isAllowedPostOrigin(WWW, "www.almarprivatejourney.com", "production"), true);
  assert.equal(isAllowedPostOrigin(PREVIEW, "preview.almarprivatejourney.com", "production"), true);
  assert.equal(isAllowedPostOrigin("http://127.0.0.1:3131", "127.0.0.1:3131", "development"), true);
  // Another allowed origin on the wrong host, a lookalike, a missing or empty header, a cross-site page: all refused.
  assert.equal(isAllowedPostOrigin(WWW, "almarprivatejourney.com", "production"), false);
  assert.equal(isAllowedPostOrigin(PREVIEW, "almarprivatejourney.com", "production"), false);
  assert.equal(isAllowedPostOrigin("https://evil.example", "almarprivatejourney.com", "production"), false);
  assert.equal(isAllowedPostOrigin("https://evil.example", "evil.example", "production"), false, "a spoofed Host cannot make a foreign Origin pass");
  assert.equal(isAllowedPostOrigin(null, "almarprivatejourney.com", "production"), false);
  assert.equal(isAllowedPostOrigin("", "almarprivatejourney.com", "production"), false);
  assert.equal(isAllowedPostOrigin("null", "almarprivatejourney.com", "production"), false);
  assert.equal(isAllowedPostOrigin(`${PUBLIC}/`, "almarprivatejourney.com", "production"), false);
  assert.equal(isAllowedPostOrigin("http://127.0.0.1:3131", "127.0.0.1:3131", "production"), false);
});

// ---------------------------------------------------------------- terms.ts

test("terms: the placeholder pair changes together (B-13)", () => {
  assert.equal(termsMod.BOOKING_TERMS_VERSION, "placeholder");
  assert.equal(termsMod.BOOKING_TERMS_IS_PLACEHOLDER, true);
  assert.match(readFileSync("lib/booking/terms.ts", "utf8"), /\[Booking terms\]/);
});
