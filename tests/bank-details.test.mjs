// Plan 04-08, Task 3: the pure IBAN and BIC rules of lib/booking/bank.ts (04-09's money Settings parser and 04-05's
// booking page use them; the SQL checks the same rules again). Every IBAN and BIC here is a published documentation
// example (the GB, DE and AE examples of the IBAN standard, and the TESTAEAA test code): never a real account.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const bank = await loadTs("lib/booking/bank.ts");
const { normalizeIban, isValidIban, formatIban, normalizeBic, isValidBic, BANK_TEXT_LIMITS } = bank;

const EXAMPLES = ["GB82 WEST 1234 5698 7654 32", "DE89 3704 0044 0532 0130 00", "AE07 0331 2345 6789 0123 456"];

/** The same IBAN with its last digit changed (0 -> 1, otherwise minus one). */
function lastDigitChanged(iban) {
  const last = iban.at(-1);
  const changed = last === "0" ? "1" : String(Number(last) - 1);
  return iban.slice(0, -1) + changed;
}

// ---------------------------------------------------------------- IBAN

test("normalizeIban: spaces out, upper case", () => {
  assert.equal(normalizeIban("gb82 west 1234 5698 7654 32"), "GB82WEST12345698765432");
  assert.equal(normalizeIban("  AE07 0331\t2345 6789 0123 456 "), "AE070331234567890123456");
});

test("isValidIban: the documentation examples pass, with spaces or without, in any case", () => {
  for (const iban of EXAMPLES) {
    assert.equal(isValidIban(iban), true, iban);
    assert.equal(isValidIban(iban.replace(/ /g, "")), true, iban);
    assert.equal(isValidIban(iban.toLowerCase()), true, iban);
  }
});

test("isValidIban: the same examples with the last digit changed fail the mod-97 check", () => {
  for (const iban of EXAMPLES) assert.equal(isValidIban(lastDigitChanged(iban)), false, lastDigitChanged(iban));
});

test("isValidIban: shorter than 15 or longer than 34 characters is refused", () => {
  assert.equal(isValidIban("GB82WEST123456"), false, "14 characters");
  assert.equal(isValidIban(`GB82${"1".repeat(31)}`), false, "35 characters");
});

test("isValidIban: a wrong shape is refused, and nothing throws", () => {
  for (const bad of ["", "   ", "1282WEST12345698765432", "G882WEST12345698765432", "GBX2WEST12345698765432", "GB82-WEST-1234-5698-7654-32", "GB82WEST1234569876543!"]) {
    assert.equal(isValidIban(bad), false, bad);
  }
  for (const bad of [null, undefined, 42, {}, [], true]) assert.doesNotThrow(() => isValidIban(bad));
  for (const bad of [null, undefined, 42, {}, [], true]) assert.equal(isValidIban(bad), false);
});

test("formatIban: groups of four for display; the stored value is unchanged", () => {
  assert.equal(formatIban("GB82WEST12345698765432"), "GB82 WEST 1234 5698 7654 32");
  assert.equal(formatIban("ae070331234567890123456"), "AE07 0331 2345 6789 0123 456");
  const stored = "DE89370400440532013000";
  const shown = formatIban(stored);
  assert.equal(shown, "DE89 3704 0044 0532 0130 00");
  assert.equal(normalizeIban(shown), stored);
  assert.equal(stored, "DE89370400440532013000");
});

// ---------------------------------------------------------------- BIC

test("isValidBic: 8 or 11 characters, bank, country, location, optional branch", () => {
  for (const bic of ["TESTAEAA", "TESTAEAA500", "TESTAEAAXXX", "testaeaa", " TESTAEAA "]) assert.equal(isValidBic(bic), true, bic);
  for (const bic of ["TESTAEA", "TESTAEAAX", "TESTAEAA50", "TESTAEAA5000", "TEST1EAA", "", null, undefined, 7]) assert.equal(isValidBic(bic), false, String(bic));
});

test("normalizeBic: spaces out, upper case", () => {
  assert.equal(normalizeBic(" testaeaa xxx "), "TESTAEAAXXX");
});

// ---------------------------------------------------------------- limits and the file

test("BANK_TEXT_LIMITS mirror the SQL checks", () => {
  assert.deepEqual({ ...BANK_TEXT_LIMITS }, { accountName: 120, bankName: 120, bankAddress: 300, note: 300 });
  const sql = readFileSync("supabase/migrations/20261019160000_booking_requests.sql", "utf8");
  assert.match(sql, /account_name text check \(char_length\(account_name\) between 1 and 120\)/);
  assert.match(sql, /bank_name text check \(char_length\(bank_name\) between 1 and 120\)/);
  assert.match(sql, /bank_address text check \(char_length\(bank_address\) between 1 and 300\)/);
  assert.match(sql, /note_en text check \(char_length\(note_en\) between 1 and 300\)/);
});

test("bank.ts is a leaf: no imports, no environment, no per-country length table", () => {
  const source = readFileSync("lib/booking/bank.ts", "utf8");
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /BigInt/);
});
