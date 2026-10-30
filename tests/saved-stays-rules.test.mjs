// Plan 06-07 Task 3: the pure rules of saved stays and Share, and the parity of their copy. Written, not run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { isStaySlug, loginHrefForSave, stayReturnPath, readIntent, whatsappShareHref, SAVE_INTENT_KEY, SAVE_INTENT_TTL_MS, SAVED_STAY_LOCALES } = await loadTs("lib/saved-stays/rules.ts");
const { SAVED_STAYS_COPY, saveHeartCopy, stayShareCopy } = await loadTs("lib/copy/saved-stays.ts");
const { RETURN_COOKIE_MAX_AGE, safeReturnPath } = await loadTs("lib/auth/rules.ts");

test("isStaySlug: lowercase words and hyphens, at most 80 characters", () => {
  for (const good of ["casa-loma", "casa", "a1-b2", "x".repeat(80)]) assert.equal(isStaySlug(good), true, good);
  for (const bad of ["", "Casa", "a/b", "..", "x".repeat(81), "%2e", "-casa", "casa-", "casa--loma", "casa loma", null, undefined, 7, ["casa"]]) {
    assert.equal(isStaySlug(bad), false, String(bad));
  }
});

test("loginHrefForSave and stayReturnPath build one fixed shape, and null from a bad slug", () => {
  assert.equal(loginHrefForSave("ar", "casa-loma"), "/ar/login?return=stay&stay=casa-loma");
  assert.equal(stayReturnPath("es", "casa-loma"), "/es/private-stays/casa-loma");
  for (const bad of ["../account", "//evil.example", "a/b", "", undefined]) {
    assert.equal(loginHrefForSave("en", bad), null);
    assert.equal(stayReturnPath("en", bad), null);
  }
});

test("the return path survives safeReturnPath as it is, in every language", () => {
  for (const locale of SAVED_STAY_LOCALES) {
    const path = stayReturnPath(locale, "casa-loma");
    assert.equal(safeReturnPath(path), path);
  }
});

test("readIntent: a fresh intent gives its slug; old, future, malformed or a bad slug give null", () => {
  const now = 1_800_000_000_000;
  const intent = (stay, at) => JSON.stringify({ stay, at });
  assert.equal(readIntent(intent("casa-loma", now), now), "casa-loma");
  assert.equal(readIntent(intent("casa-loma", now - SAVE_INTENT_TTL_MS), now), "casa-loma");
  assert.equal(readIntent(intent("casa-loma", now - SAVE_INTENT_TTL_MS - 1), now), null);
  assert.equal(readIntent(intent("casa-loma", now + 1), now), null);
  assert.equal(readIntent(intent("../account", now), now), null);
  assert.equal(readIntent(intent("casa-loma", "soon"), now), null);
  for (const raw of [null, "", "{", "null", "7", "[]", "{}"]) assert.equal(readIntent(raw, now), null, String(raw));
});

test("the intent lives exactly as long as the return cookie", () => {
  assert.equal(SAVE_INTENT_TTL_MS, RETURN_COOKIE_MAX_AGE * 1000);
  assert.equal(SAVE_INTENT_KEY, "almar-save-intent");
});

test("whatsappShareHref: a chat with no number, decoding back to the filled template", () => {
  const url = "https://almarprivatejourney.com/en/private-stays/casa-x";
  const href = whatsappShareHref("Casa [x] $& 50%", url, SAVED_STAYS_COPY.en.whatsappText);
  assert.ok(href.startsWith("https://wa.me/?text="));
  assert.equal(decodeURIComponent(href.slice("https://wa.me/?text=".length)), `Casa [x] $& 50% · ALMAR Private Journey ${url}`);
});

test("SAVED_STAYS_COPY: the same keys in en, ar and es, none empty, and the same fill slots", () => {
  const keys = Object.keys(SAVED_STAYS_COPY.en).sort();
  const slots = (text) => (text.match(/\{\w+\}/g) ?? []).sort();
  for (const locale of SAVED_STAY_LOCALES) {
    assert.deepEqual(Object.keys(SAVED_STAYS_COPY[locale]).sort(), keys, locale);
    for (const key of keys) {
      assert.ok(SAVED_STAYS_COPY[locale][key].trim().length > 0, `${locale}.${key}`);
      assert.deepEqual(slots(SAVED_STAYS_COPY[locale][key]), slots(SAVED_STAYS_COPY.en[key]), `${locale}.${key}`);
    }
  }
});

test("public Spanish says tú, and the picks carry the strings their parts draw", () => {
  assert.match(SAVED_STAYS_COPY.es.saveFailed, /Inténtalo/);
  assert.match(SAVED_STAYS_COPY.es.saveStay, /tus estancias/);
  assert.equal(saveHeartCopy("ar").savedNotice, SAVED_STAYS_COPY.ar.savedNotice);
  assert.equal(stayShareCopy("es").shareOn, SAVED_STAYS_COPY.es.shareOn);
});
