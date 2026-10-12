// Plan 02-05 (addendum 2026-10-11): followAccount, run by the confirm action right after verifyOtp. A returning
// account's saved language and currency follow her into this browser; a new account keeps what the browser had; the
// ops host gets no sync cookie and no localised return; a failure never throws (the sign-in must not break).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { followAccount } = await loadTs("lib/account-follow.ts");

const ID = "00000000-0000-4000-8000-0000000000aa";
const NOW = Date.parse("2026-10-11T12:00:00Z");
const OLD = "2026-09-01T10:00:00Z";
const FRESH = "2026-10-11T11:58:00Z";

function fake(row, { selectError = null, throws = false } = {}) {
  const updates = [];
  const client = {
    from(table) {
      assert.equal(table, "profiles");
      return {
        select(columns) {
          assert.equal(columns, "locale, currency, created_at");
          return {
            eq(column, value) {
              assert.equal(column, "id");
              assert.equal(value, ID);
              return {
                maybeSingle: async () => {
                  if (throws) throw new Error("network");
                  return { data: row, error: selectError };
                },
              };
            },
          };
        },
        update(values) {
          return { eq: (column, value) => ({ select: async () => (updates.push({ values, column, value }), { data: [{ id: value }], error: null }) }) };
        },
      };
    },
  };
  return { client, updates };
}

async function run(row, { cookies = {}, ops = false, options, firstSignIn = true } = {}) {
  const { client, updates } = fake(row, options);
  const set = {};
  const locale = await followAccount({
    client,
    userId: ID,
    firstSignIn,
    readCookie: (name) => cookies[name],
    setCookie: (name, value, opts) => (set[name] = { value, ...opts }),
    ops,
    now: NOW,
    production: true,
  });
  return { locale, set, updates };
}

test("returning account: her saved language becomes almar-locale, her currency goes in the one-shot sync cookie", async () => {
  const { locale, set, updates } = await run({ locale: "ar", currency: "USD", created_at: OLD }, { cookies: { "almar-locale": "es" } });
  assert.equal(locale, "ar");
  assert.deepEqual(set["almar-locale"], { value: "ar", path: "/", maxAge: 31536000, sameSite: "lax" });
  assert.deepEqual(set["almar-prefs-sync"], { value: "USD", path: "/", maxAge: 600, sameSite: "lax", secure: true });
  assert.equal(updates.length, 0, "nothing is written for a returning account");
});

test("new account: the browser's language is saved to her row and kept; the browser is asked to push its currency", async () => {
  const { locale, set, updates } = await run({ locale: "en", currency: "AED", created_at: FRESH }, { cookies: { "almar-locale": "ar" } });
  assert.equal(locale, "ar");
  assert.deepEqual(updates, [{ values: { locale: "ar" }, column: "id", value: ID }]);
  assert.equal(set["almar-locale"], undefined, "the browser's cookie already says ar");
  assert.equal(set["almar-prefs-sync"].value, "push");
});

test("a second sign-in inside the window (another device) is a returning account: her row wins, nothing is written", async () => {
  const { locale, set, updates } = await run({ locale: "ar", currency: "AED", created_at: FRESH }, { cookies: { "almar-locale": "es" }, firstSignIn: false });
  assert.equal(locale, "ar");
  assert.equal(updates.length, 0);
  assert.equal(set["almar-locale"].value, "ar");
  assert.equal(set["almar-prefs-sync"].value, "AED");
});

test("isFirstSignIn: confirmed by this verification (within a minute of the sign-in) only", async () => {
  const { isFirstSignIn } = await loadTs("lib/account-preferences.ts");
  assert.equal(isFirstSignIn({ email_confirmed_at: "2026-10-11T12:00:00Z", last_sign_in_at: "2026-10-11T12:00:01Z" }), true);
  assert.equal(isFirstSignIn({ email_confirmed_at: "2026-10-11T11:52:00Z", last_sign_in_at: "2026-10-11T12:00:00Z" }), false);
  for (const bad of [null, undefined, {}, { email_confirmed_at: "x", last_sign_in_at: "y" }, { email_confirmed_at: "2026-10-11T12:00:00Z" }]) {
    assert.equal(isFirstSignIn(bad), false);
  }
});

test("new account without a valid browser language keeps the row's default and writes nothing", async () => {
  for (const cookie of [undefined, "fr", "AR"]) {
    const { locale, updates, set } = await run({ locale: "en", currency: "AED", created_at: FRESH }, { cookies: { "almar-locale": cookie } });
    assert.equal(locale, "en");
    assert.equal(updates.length, 0);
    assert.equal(set["almar-prefs-sync"].value, "push");
  }
});

test("ops host: almar-locale still follows her, no sync cookie is set", async () => {
  const back = await run({ locale: "es", currency: "EUR", created_at: OLD }, { ops: true });
  assert.equal(back.locale, "es");
  assert.equal(back.set["almar-locale"].value, "es");
  assert.equal(back.set["almar-prefs-sync"], undefined);
  const fresh = await run({ locale: "en", currency: "AED", created_at: FRESH }, { ops: true, cookies: { "almar-locale": "ar" } });
  assert.equal(fresh.set["almar-prefs-sync"], undefined);
});

test("bad row values are never copied into a cookie", async () => {
  const { locale, set } = await run({ locale: "fr", currency: "GBP", created_at: OLD });
  assert.equal(locale, null);
  assert.deepEqual(set, {});
});

test("no user, no row, a select error or a throw: null, no cookie, no throw", async () => {
  assert.equal(await followAccount({ client: {}, userId: undefined, firstSignIn: true, readCookie: () => undefined, setCookie: () => assert.fail(), ops: false, now: NOW, production: true }), null);
  for (const [row, options] of [[null, {}], [{ locale: "ar" }, { selectError: { code: "42501" } }], [{ locale: "ar" }, { throws: true }]]) {
    const { locale, set } = await run(row, { options });
    assert.equal(locale, null);
    assert.deepEqual(set, {});
  }
});

test("source guard: the confirm action calls followAccount after verifyOtp and never localises on the ops host", () => {
  const source = readFileSync("app/auth/confirm/actions.ts", "utf8");
  assert.ok(source.indexOf("verifyOtp(") < source.indexOf("followAccount("));
  assert.match(source, /firstSignIn: isFirstSignIn\(verified\.user\)/);
  assert.match(source, /redirect\(locale && !ops \? localizedReturnPath\(back, locale\) : back\)/);
  assert.doesNotMatch(source.slice(source.indexOf("followAccount(")), /createSupabaseAdmin|admin\./, "her row is read with her session, not the admin client");
});
