// lib/data/anon-key.ts (plan 03.2-02 review): the anon-key variable is checked by VALUE, not only by name, in the
// three places the build takes it (scripts/assemble-cloudflare.mjs, scripts/parity-build.mjs, lib/data/source.ts).
// Every key here is fabricated for the test: an unsigned JWT with a chosen payload, or a made-up sb_* string.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertAnonKey } from "../lib/data/anon-key.ts";
import { dataSourceFor } from "../scripts/assemble-cloudflare.mjs";
import { livePublicEnv } from "../scripts/parity-build.mjs";

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (payload) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.fabricated-signature-for-a-test`;
const FAKE_SECRET = "sb_secret_FABRICATEDtestVALUEnotAkey000";
const FAKE_SERVICE_JWT = jwt({ iss: "supabase-demo", role: "service_role", exp: 1 });
const NAME = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

/** The error names the variable and holds no part of the value (beyond the sb_secret_ marker itself). */
const refusal = (value, why) => (error) => {
  assert.match(error.message, new RegExp(NAME));
  assert.match(error.message, why);
  for (const piece of [value, value.slice(-12), value.split(".")[1] ?? "never-a-piece"]) assert.ok(!error.message.includes(piece), "no value printed");
  return true;
};

test("assertAnonKey: an anon JWT, a publishable key and an opaque test value pass unchanged", () => {
  for (const value of [jwt({ iss: "supabase-demo", role: "anon", exp: 1 }), "sb_publishable_FABRICATEDtestVALUE000", "anon-key-for-a-test"]) {
    assert.equal(assertAnonKey(NAME, value), value);
  }
});

test("assertAnonKey: a secret key is refused by value (any case, quoted), the message names the variable only", () => {
  for (const value of [FAKE_SECRET, FAKE_SECRET.toUpperCase(), `"${FAKE_SECRET}"`, `'${FAKE_SECRET}'`, ` ${FAKE_SECRET}`]) {
    assert.throws(() => assertAnonKey(NAME, value), refusal(value.trim(), /secret key/));
  }
});

test("assertAnonKey: a JWT whose role is not anon is refused (service_role, authenticated, no role, unreadable payload)", () => {
  const bad = [
    FAKE_SERVICE_JWT,
    jwt({ role: "authenticated" }),
    jwt({ iss: "supabase-demo" }),
    `${b64({ alg: "HS256" })}.not-json-at-all.fabricated-signature-for-a-test`,
    // a mangled header is still the shape of a JWT: refused unless its payload says anon
    `${Buffer.from(' {"alg":"HS256"}').toString("base64url")}.${b64({ role: "service_role" })}.fabricated-signature-for-a-test`,
    `"${FAKE_SERVICE_JWT}"`,
  ];
  for (const value of bad) assert.throws(() => assertAnonKey(NAME, value), refusal(value, /role is not "anon"/));
});

test("dataSourceFor refuses a secret value in the anon-key variable for every database build", () => {
  const url = { NEXT_PUBLIC_SUPABASE_URL: "https://jkdkaldgeiowkhlfmsft.supabase.co" };
  for (const value of [FAKE_SECRET, FAKE_SERVICE_JWT]) {
    for (const target of ["preview", "production"]) {
      assert.throws(() => dataSourceFor(target, { ...url, [NAME]: value }), refusal(value, /anon key only/));
    }
    assert.throws(() => dataSourceFor("local", { ...url, ALMAR_DATA_SOURCE: "supabase", [NAME]: value }), refusal(value, /anon key only/));
    assert.equal(dataSourceFor("ops", { ...url, [NAME]: value }), "fixtures", "ops reads no key at all");
  }
});

test("parity-build --live refuses a secret value in the anon-key variable", () => {
  for (const value of [FAKE_SECRET, ` ${FAKE_SERVICE_JWT} `]) {
    assert.throws(() => livePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co", [NAME]: value }), refusal(value.trim(), /anon key only/));
  }
});

test("lib/data/source.ts checks the key it reads with assertAnonKey, under the name it read it from", () => {
  const src = readFileSync("lib/data/source.ts", "utf8");
  assert.match(src, /import \{ assertAnonKey \} from "\.\/anon-key";/);
  assert.match(src, /anonKey: assertAnonKey\(keyName, anonKey\)/);
});
