// Plan 02-05 (addendum 2026-10-11): the pure rules behind "language and currency follow a signed-in account".
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const p = await loadTs("lib/account-preferences.ts");

test("locale and currency allow-lists: exact values only, never repaired", () => {
  for (const ok of ["en", "ar", "es"]) assert.equal(p.parseAccountLocale(ok), ok);
  for (const bad of ["xx", "AR", " ar", "", null, undefined, 1, ["ar"], { ar: 1 }]) assert.equal(p.parseAccountLocale(bad), null);
  for (const ok of ["AED", "USD", "EUR"]) assert.equal(p.parseAccountCurrency(ok), ok);
  for (const bad of ["GBP", "aed", "AED ", "", null, undefined, 0]) assert.equal(p.parseAccountCurrency(bad), null);
  assert.equal(p.parseSyncValue("push"), "push");
  assert.equal(p.parseSyncValue("USD"), "USD");
  for (const bad of ["Push", "pull", "", null, "GBP"]) assert.equal(p.parseSyncValue(bad), null);
});

test("parsePreferenceBody: only locale and/or currency, each allowed, at least one", () => {
  assert.deepEqual(p.parsePreferenceBody({ locale: "ar" }), { locale: "ar" });
  assert.deepEqual(p.parsePreferenceBody({ currency: "EUR" }), { currency: "EUR" });
  assert.deepEqual(p.parsePreferenceBody({ locale: "es", currency: "USD" }), { locale: "es", currency: "USD" });
  for (const bad of [
    {},
    null,
    "ar",
    ["ar"],
    { locale: "fr" },
    { currency: "GBP" },
    { locale: "ar", role: "owner" },
    { locale: "ar", currency: null },
    { id: "00000000-0000-4000-8000-000000000001", locale: "ar" },
  ]) {
    assert.equal(p.parsePreferenceBody(bad), null, JSON.stringify(bad));
  }
});

test("isNewAccount: a row made within the window before now; bad or old times are not new", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  assert.equal(p.isNewAccount("2026-10-11T11:59:00Z", now), true);
  assert.equal(p.isNewAccount("2026-10-11T11:46:00Z", now), true);
  assert.equal(p.isNewAccount("2026-10-11T11:44:00Z", now), false);
  assert.equal(p.isNewAccount("2026-09-01T00:00:00Z", now), false);
  assert.equal(p.isNewAccount("2026-10-11T12:30:00Z", now), false, "a time in the future is not trusted");
  for (const bad of [null, undefined, "", "yesterday", 1760000000000]) assert.equal(p.isNewAccount(bad, now), false);
});

test("localizedReturnPath: public pages get her language, other paths are unchanged", () => {
  assert.equal(p.localizedReturnPath("/", "ar"), "/ar/");
  assert.equal(p.localizedReturnPath("/", "en"), "/");
  assert.equal(p.localizedReturnPath("/private-stays", "ar"), "/ar/private-stays");
  assert.equal(p.localizedReturnPath("/es/about", "en"), "/about");
  assert.equal(p.localizedReturnPath("/ar/", "es"), "/es/");
  assert.equal(p.localizedReturnPath("/private-stays/casa-1?from=x#top", "es"), "/es/private-stays/casa-1?from=x#top");
  assert.equal(p.localizedReturnPath("/account", "ar"), "/account");
  assert.equal(p.localizedReturnPath("/bookings?id=1", "ar"), "/bookings?id=1");
  assert.equal(p.localizedReturnPath("/dashboard", "es"), "/dashboard");
});

test("localizedReturnPath never turns a path into another origin", () => {
  // safeReturnPath runs first in the confirm action; even so, nothing here may build "//" or a scheme.
  for (const back of ["/", "/about", "/ar/contact", "/blog/a-post?x=//evil.example"]) {
    for (const locale of ["en", "ar", "es"]) {
      const out = p.localizedReturnPath(back, locale);
      assert.ok(out.startsWith("/") && !out.startsWith("//") && !out.includes("\\"), `${back} ${locale} -> ${out}`);
    }
  }
});

test("the signed-in hint: value-free name, readable by the page, lax, Secure in production, cleared with Max-Age 0", () => {
  assert.equal(p.SIGNED_IN_HINT_COOKIE, "almar-signed-in");
  assert.deepEqual(p.signedInHintOptions(true), { path: "/", maxAge: 400 * 24 * 60 * 60, sameSite: "lax", secure: true, httpOnly: false });
  assert.deepEqual(p.signedInHintOptions(false, 0), { path: "/", maxAge: 0, sameSite: "lax", secure: false, httpOnly: false });
});

test("/account shows the currency the site uses: the browser choice, else her row (02-05 review, finding 4)", () => {
  assert.equal(p.shownAccountCurrency("USD", "AED"), "USD");
  assert.equal(p.shownAccountCurrency("EUR", "EUR"), "EUR");
  for (const bad of [null, undefined, "", "usd", "GBP", "USD "]) assert.equal(p.shownAccountCurrency(bad, "AED"), "AED");
});

test("saveTracker (PR #14 review): only the latest /account click changes the screen; a failure shows the newest saved value", () => {
  const t = p.saveTracker("AED");
  const a = t.begin(); // she picks USD
  const b = t.begin(); // then EUR before the first answer
  assert.deepEqual(t.settle(a, true, "USD"), { show: null, store: true }, "overtaken on screen; still the newest success so far");
  assert.deepEqual(t.settle(b, false, "EUR"), { show: "USD", store: false }, "the latest failed: show the newest saved value (USD)");

  const u = p.saveTracker("AED");
  const c = u.begin();
  const d = u.begin();
  assert.deepEqual(u.settle(d, true, "EUR"), { show: "EUR", store: true });
  assert.deepEqual(u.settle(c, false, "USD"), { show: null, store: false }, "a late failure of an older click changes nothing");
  assert.deepEqual(u.settle(u.begin(), false, "USD"), { show: "EUR", store: false });

  const w = p.saveTracker("AED");
  w.adopt("USD");
  assert.deepEqual(w.settle(w.begin(), false, "EUR"), { show: "USD", store: false }, "the currency the page opened with is the fallback");
});

test("saveTracker (PR #14 review round 2): USD clicked, EUR clicked, EUR succeeds, then the USD success arrives: nothing changes", () => {
  const t = p.saveTracker("AED");
  const usd = t.begin();
  const eur = t.begin();
  assert.deepEqual(t.settle(eur, true, "EUR"), { show: "EUR", store: true }, "EUR is shown and stored in the browser");
  assert.deepEqual(t.settle(usd, true, "USD"), { show: null, store: false }, "the older success neither shows nor stores USD");
  assert.deepEqual(t.settle(t.begin(), false, "AED"), { show: "EUR", store: false }, "the saved value is still EUR, not USD");
});

test("/account wires the tracker: an overtaken result returns before touching the screen", async () => {
  const { readFileSync } = await import("node:fs");
  const screen = readFileSync("app/account/account-screen.tsx", "utf8");
  assert.match(screen, /const ticket = prefSaves\.current\.begin\(\);/);
  assert.match(screen, /const \{ show: shown, store \} = prefSaves\.current\.settle\(ticket, result\.status === "saved", nextCurrency\);\s*if \(store\) storeCurrencyChoice\(nextCurrency\);\s*if \(shown === null\) return;\s*setPrefState\(result\);\s*setCurrency\(shown\);/);
  assert.match(screen, /prefSaves\.current\.adopt\(shown\);/);
});
