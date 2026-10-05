import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readProfileInput, validateProfile } from "../lib/auth/rules.ts";

const form = (values) => ({ get: (name) => values[name] ?? null });

test("names: letters in any script, spaces, hyphens; required", () => {
  const ok = readProfileInput(form({ firstName: " Zoé ", lastName: "عبد الله", phone: "" }));
  assert.deepEqual(validateProfile(ok), {});
  assert.deepEqual(validateProfile(readProfileInput(form({ firstName: "", lastName: "" }))), {
    firstName: "addFirstName",
    lastName: "addLastName",
  });
  assert.equal(validateProfile(readProfileInput(form({ firstName: "R2D2", lastName: "Ok" }))).firstName, "nameCharacters");
  assert.equal(validateProfile(readProfileInput(form({ firstName: "Ana-María", lastName: "O'Neil" }))).firstName, undefined);
});

test("phone: optional, digits and one plus; Arabic digits are read as Western", () => {
  const read = (phone) => readProfileInput(form({ firstName: "A", lastName: "B", phone }));
  assert.equal(validateProfile(read("")).phone, undefined);
  assert.equal(read("+971 56 388 3302").phone, "+971563883302");
  assert.equal(read("+٩٧١٥٦٣٨٨٣٣٠٢").phone, "+971563883302");
  assert.equal(validateProfile(read("+97156abc")).phone, "phoneCharacters");
  assert.equal(validateProfile(read("97+15")).phone, "phoneCharacters");
});

test("saveProfile writes only names and phone on her own row, never role or email", () => {
  const source = readFileSync("app/account/actions.ts", "utf8");
  assert.match(source, /\.eq\("id", data\.user\.id\)/);
  assert.equal(/role|email:|createSupabaseAdmin/.test(source.replace(/\/\*\*[^\n]*\*\//g, "").replace(/never role or email/gi, "")), false);
  assert.match(source, /getUser\(\)/);
});

test("the account page has no password field and no dashboard word", () => {
  for (const path of ["app/account/page.tsx", "app/account/account-screen.tsx"]) {
    const text = readFileSync(path, "utf8");
    assert.equal(text.includes('type="password"'), false, path);
    assert.equal(/dashboard/i.test(text), false, path);
  }
});
