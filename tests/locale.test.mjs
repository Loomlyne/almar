import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GUEST_COPY } from "../lib/copy/guest.ts";

// Missing AR or ES keys are tests/copy.test.mjs. This file checks the auth meaning, not coverage.

const LOCALES = ["en", "ar", "es"];

test("field errors exist in all three languages", () => {
  for (const locale of LOCALES) {
    const copy = GUEST_COPY[locale];
    for (const key of ["addFirstName", "addLastName", "nameCharacters", "phoneCharacters"]) {
      assert.ok(copy.hub[key]?.trim(), `${locale} hub.${key}`);
    }
    assert.ok(copy.enterEmail.trim(), `${locale} enterEmail`);
  }
  assert.equal(GUEST_COPY.en.hub.addFirstName, "Add your name.");
  assert.equal(GUEST_COPY.en.hub.phoneCharacters, "Use digits and a plus only.");
});

test("Arabic and Spanish auth strings are translated, not English copies", () => {
  for (const locale of ["ar", "es"]) {
    for (const key of ["signIn", "accessWithMagicLink", "enterEmail"]) {
      assert.notEqual(GUEST_COPY[locale][key], GUEST_COPY.en[key], `${locale}.${key}`);
    }
    assert.notEqual(GUEST_COPY[locale].auth.heading, GUEST_COPY.en.auth.heading);
    assert.notEqual(GUEST_COPY[locale].notFound.title, GUEST_COPY.en.notFound.title);
  }
  assert.equal(GUEST_COPY.ar.notFound.title, "الصفحة غير موجودة");
  assert.equal(GUEST_COPY.es.notFound.returnHome, "Volver al inicio");
  assert.equal(GUEST_COPY.ar.mail.subjectConfirm, "أكد بريدك");
});

test("TOUCHWORD is one untranslated literal in capitals, in the account menu only", () => {
  const menu = readFileSync("components/ui/account-menu.tsx", "utf8");
  assert.equal((menu.match(/TOUCHWORD/g) ?? []).length, 1);
  for (const path of ["lib/copy/guest.ts", "lib/copy/home.ts", "lib/copy/journey.ts"]) {
    assert.equal(/touchword/i.test(readFileSync(path, "utf8")), false, path);
  }
});

test("pages read the language from the cookie through one allowlist", () => {
  const helper = readFileSync("lib/request-locale.ts", "utf8");
  assert.match(helper, /value === "en" \|\| value === "ar" \|\| value === "es"/);
  for (const path of ["app/login/page.tsx", "app/account/page.tsx", "app/bookings/page.tsx", "app/not-found.tsx"]) {
    assert.match(readFileSync(path, "utf8"), /requestLocale\(/, path);
  }
});
