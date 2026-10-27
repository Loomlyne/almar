// Plan 04-09 Task 1: the money Settings form model (lib/ops/money-form.ts) and its copy (lib/copy/ops-money.ts).
// Bank values are bracket text and the IBAN documentation example only (the repo is public, B-30).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const m = await loadTs("lib/ops/money-form.ts");
const { OPS_MONEY_COPY } = await loadTs("lib/copy/ops-money.ts");
const { BANK_TEXT_LIMITS } = await loadTs("lib/booking/bank.ts");
const SOURCE = readFileSync("lib/ops/money-form.ts", "utf8");

const IBAN_DOC = "AE07 0331 2345 6789 0123 456";
const IBAN_DOC_STORED = "AE070331234567890123456";
const IBAN_BAD_CHECK = "AE07 0331 2345 6789 0123 457";

const view = (over = {}) => ({
  transfer_window_minutes: null,
  balance_due_days: null,
  bank: {
    account_name: null, bank_name: null, iban: null, swift: null, bank_address: null, note_en: null, note_ar: null, note_es: null,
  },
  bank_complete: false,
  updated_at: null,
  updated_by: null,
  ...over,
});

const FILLED_BANK = {
  account_name: "[Account name]",
  bank_name: "[Bank]",
  iban: IBAN_DOC_STORED,
  swift: "TESTAEAAXXX",
  bank_address: "[Bank address]",
  note_en: "[Note line]",
  note_ar: "[Arabic note line]",
  note_es: "[Spanish note line]",
};
const filledView = () => view({ transfer_window_minutes: 1440, balance_due_days: 14, bank: { ...FILLED_BANK }, bank_complete: true });
const NO_NOTES = { ar: null, es: null };

// ---------------------------------------------------------------- moneyForm

test("moneyForm: the window unit is days when the minutes divide by 1440, else hours by 60, else minutes", () => {
  assert.deepEqual([m.moneyForm(view({ transfer_window_minutes: 43200 })).windowValue, m.moneyForm(view({ transfer_window_minutes: 43200 })).windowUnit], ["30", "days"]);
  assert.deepEqual([m.moneyForm(view({ transfer_window_minutes: 1440 })).windowValue, m.moneyForm(view({ transfer_window_minutes: 1440 })).windowUnit], ["1", "days"]);
  assert.deepEqual([m.moneyForm(view({ transfer_window_minutes: 120 })).windowValue, m.moneyForm(view({ transfer_window_minutes: 120 })).windowUnit], ["2", "hours"]);
  assert.deepEqual([m.moneyForm(view({ transfer_window_minutes: 35 })).windowValue, m.moneyForm(view({ transfer_window_minutes: 35 })).windowUnit], ["35", "minutes"]);
  assert.equal(m.moneyForm(view()).windowValue, "");
});

test("moneyForm: unset values are empty strings; saved values are text", () => {
  const empty = m.moneyForm(view());
  for (const key of ["windowValue", "balanceDays", "accountName", "bankName", "iban", "swift", "bankAddress", "noteEn", "noteAr", "noteEs"]) {
    assert.equal(empty[key], "", key);
  }
  const filled = m.moneyForm(filledView());
  assert.equal(filled.balanceDays, "14");
  assert.equal(filled.accountName, "[Account name]");
  assert.equal(filled.noteAr, "[Arabic note line]");
  assert.equal(m.moneyForm(view({ balance_due_days: 0 })).balanceDays, "0");
});

// ---------------------------------------------------------------- windowMinutes and balance days

test("windowMinutes: empty is null; 35 minutes to 30 days; whole numbers only", () => {
  assert.equal(m.windowMinutes("", "hours"), null);
  assert.equal(m.windowMinutes("  ", "days"), null);
  assert.equal(m.windowMinutes("35", "minutes"), 35);
  assert.equal(m.windowMinutes("34", "minutes"), "range");
  assert.equal(m.windowMinutes("30", "days"), 43200);
  assert.equal(m.windowMinutes("31", "days"), "range");
  assert.equal(m.windowMinutes("720", "hours"), 43200);
  assert.equal(m.windowMinutes("721", "hours"), "range");
  assert.equal(m.windowMinutes("1.5", "hours"), "whole");
  assert.equal(m.windowMinutes("0", "days"), "range");
  assert.equal(m.windowMinutes("٢", "days"), 2880);
});

test("balance days: empty is null, 0 is 0, 366 and 1.5 are errors", () => {
  const saved = m.moneyForm(filledView());
  assert.equal(m.moneyErrors({ ...saved, balanceDays: "" }).balanceDays, undefined);
  assert.equal(m.moneyErrors({ ...saved, balanceDays: "0" }).balanceDays, undefined);
  assert.equal(m.moneyErrors({ ...saved, balanceDays: "365" }).balanceDays, undefined);
  assert.equal(m.moneyErrors({ ...saved, balanceDays: "366" }).balanceDays, "range");
  assert.equal(m.moneyErrors({ ...saved, balanceDays: "1.5" }).balanceDays, "whole");
  assert.deepEqual(m.moneySaveBody({ ...saved, balanceDays: "" }, saved, NO_NOTES), { balance_due_days: null });
  assert.deepEqual(m.moneySaveBody({ ...saved, balanceDays: "0" }, saved, NO_NOTES), { balance_due_days: 0 });
  assert.equal(m.moneySaveBody({ ...saved, balanceDays: "366" }, saved, NO_NOTES), null);
});

// ---------------------------------------------------------------- moneyErrors

test("moneyErrors: the IBAN documentation example is valid; one changed digit fails the check", () => {
  const saved = m.moneyForm(filledView());
  assert.deepEqual(m.moneyErrors({ ...saved, iban: IBAN_DOC }), {});
  assert.deepEqual(m.moneyErrors(saved), {});
  assert.equal(m.moneyErrors({ ...saved, iban: IBAN_BAD_CHECK }).iban, "checksum");
});

test("moneyErrors: a SWIFT / BIC has 8 or 11 characters", () => {
  const saved = m.moneyForm(filledView());
  assert.equal(m.moneyErrors({ ...saved, swift: "TESTAEAAXXX" }).swift, undefined);
  assert.equal(m.moneyErrors({ ...saved, swift: "TESTAEAA" }).swift, undefined);
  assert.equal(m.moneyErrors({ ...saved, swift: "testaeaa" }).swift, undefined);
  assert.equal(m.moneyErrors({ ...saved, swift: "TESTAEA" }).swift, "shape");
});

test("moneyErrors: each text field over BANK_TEXT_LIMITS is long", () => {
  const saved = m.moneyForm(filledView());
  const cases = [
    ["accountName", BANK_TEXT_LIMITS.accountName],
    ["bankName", BANK_TEXT_LIMITS.bankName],
    ["bankAddress", BANK_TEXT_LIMITS.bankAddress],
    ["noteEn", BANK_TEXT_LIMITS.note],
    ["noteAr", BANK_TEXT_LIMITS.note],
    ["noteEs", BANK_TEXT_LIMITS.note],
  ];
  for (const [field, limit] of cases) {
    assert.equal(m.moneyErrors({ ...saved, [field]: "x".repeat(limit) })[field], undefined, `${field} at the limit`);
    assert.equal(m.moneyErrors({ ...saved, [field]: "x".repeat(limit + 1) })[field], "long", `${field} over the limit`);
  }
});

test("moneyErrors: the six bank fields travel together; all empty clears the bank details", () => {
  const empty = m.moneyForm(view());
  assert.deepEqual(m.moneyErrors(empty), {});
  const one = m.moneyErrors({ ...empty, accountName: "[Account name]" });
  for (const field of ["bankName", "iban", "swift", "bankAddress", "noteEn"]) assert.equal(one[field], "required", field);
  assert.equal(one.accountName, undefined);
  assert.equal(one.noteAr, undefined);
  assert.equal(one.noteEs, undefined);
  const saved = m.moneyForm(filledView());
  assert.equal(m.moneyErrors({ ...saved, swift: "" }).swift, "required");
});

test("moneyErrors: the window says range or whole", () => {
  const saved = m.moneyForm(filledView());
  assert.equal(m.moneyErrors({ ...saved, windowValue: "34", windowUnit: "minutes" }).window, "range");
  assert.equal(m.moneyErrors({ ...saved, windowValue: "1.5", windowUnit: "hours" }).window, "whole");
  assert.equal(m.moneyErrors({ ...saved, windowValue: "", windowUnit: "hours" }).window, undefined);
});

// ---------------------------------------------------------------- dirty, save body, bankChanged

test("moneySaveBody: an unchanged form is null and Save is off", () => {
  const saved = m.moneyForm(filledView());
  assert.equal(m.moneyDirty(saved, saved), false);
  assert.equal(m.canSaveMoney(saved, saved), false);
  assert.equal(m.moneySaveBody(saved, saved, NO_NOTES), null);
  // 1 day and 24 hours are the same window.
  assert.equal(m.moneyDirty({ ...saved, windowValue: "24", windowUnit: "hours" }, saved), false);
});

test("moneySaveBody: only the groups that changed", () => {
  const saved = m.moneyForm(filledView());
  assert.deepEqual(m.moneySaveBody({ ...saved, windowValue: "2", windowUnit: "days" }, saved, NO_NOTES), { transfer_window_minutes: 2880 });
  assert.deepEqual(m.moneySaveBody({ ...saved, windowValue: "" }, saved, NO_NOTES), { transfer_window_minutes: null });
  assert.deepEqual(m.moneySaveBody({ ...saved, balanceDays: "30" }, saved, NO_NOTES), { balance_due_days: 30 });
  assert.equal(m.canSaveMoney({ ...saved, balanceDays: "30" }, saved), true);
  assert.equal(m.canSaveMoney({ ...saved, balanceDays: "400" }, saved), false);
});

test("moneySaveBody: bank sends all six keys, IBAN and BIC normalized, note_ar / note_es only with text", () => {
  const saved = m.moneyForm(view());
  const form = {
    ...saved,
    accountName: " [Account name] ",
    bankName: "[Bank]",
    iban: "ae07 0331 2345 6789 0123 456",
    swift: "testaeaaxxx",
    bankAddress: "[Bank address]",
    noteEn: "[Note line]",
  };
  assert.equal(m.canSaveMoney(form, saved), true);
  assert.deepEqual(m.moneySaveBody(form, saved, NO_NOTES), {
    bank: {
      account_name: "[Account name]",
      bank_name: "[Bank]",
      iban: IBAN_DOC_STORED,
      swift: "TESTAEAAXXX",
      bank_address: "[Bank address]",
      note_en: "[Note line]",
    },
  });
  assert.deepEqual(m.moneySaveBody(form, saved, { ar: "[Arabic note line]", es: "" }).bank.note_ar, "[Arabic note line]");
  assert.equal("note_es" in m.moneySaveBody(form, saved, { ar: "[Arabic note line]", es: "" }).bank, false);
  assert.equal(m.moneySaveBody(form, saved, { ar: "[Arabic note line]", es: "[Spanish note line]" }).bank.note_es, "[Spanish note line]");
});

test("moneySaveBody: emptying every bank field clears the bank details", () => {
  const saved = m.moneyForm(filledView());
  const cleared = { ...saved, accountName: "", bankName: "", iban: "", swift: "", bankAddress: "", noteEn: "", noteAr: "", noteEs: "" };
  assert.deepEqual(m.moneyErrors(cleared), {});
  assert.deepEqual(m.moneySaveBody(cleared, saved, NO_NOTES), {
    bank: { account_name: null, bank_name: null, iban: null, swift: null, bank_address: null, note_en: null },
  });
});

test("bankChanged: true only when a bank key differs after normalization", () => {
  const saved = m.moneyForm(filledView());
  assert.equal(m.bankChanged(saved, saved), false);
  assert.equal(m.bankChanged({ ...saved, iban: IBAN_DOC }, saved), false);
  assert.equal(m.bankChanged({ ...saved, iban: "ae070331234567890123456" }, saved), false);
  assert.equal(m.bankChanged({ ...saved, swift: "testaeaaxxx" }, saved), false);
  assert.equal(m.bankChanged({ ...saved, accountName: " [Account name] " }, saved), false);
  assert.equal(m.bankChanged({ ...saved, accountName: "[Other account name]" }, saved), true);
  assert.equal(m.bankChanged({ ...saved, iban: IBAN_BAD_CHECK }, saved), true);
  assert.equal(m.bankChanged({ ...saved, noteEs: "[Other Spanish note line]" }, saved), true);
  assert.equal(m.bankChanged({ ...saved, balanceDays: "30" }, saved), false);
});

test("source rule: money-form.ts imports only lib/booking/bank, lib/format and booking-rules types", () => {
  const imports = SOURCE.split("\n").filter((line) => line.startsWith("import"));
  for (const line of imports) assert.match(line, /from "(\.\.\/booking\/bank|\.\.\/format|\.\/booking-rules)"/, line);
  for (const line of imports.filter((l) => l.includes("./booking-rules"))) assert.match(line, /^import type /, line);
  assert.doesNotMatch(SOURCE, /parseFloat|toFixed/);
});

// ---------------------------------------------------------------- copy

function leaves(value, path = []) {
  if (typeof value === "string") return [[path.join("."), value]];
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${path.join(".")} is an object`);
  return Object.keys(value).flatMap((key) => leaves(value[key], [...path, key]));
}
const tokens = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();

test("OPS_MONEY_COPY: same keys in en, ar and es at every depth, every leaf a string, tokens in all three", () => {
  assert.deepEqual(Object.keys(OPS_MONEY_COPY).sort(), ["ar", "en", "es"]);
  const en = new Map(leaves(OPS_MONEY_COPY.en));
  for (const locale of ["ar", "es"]) {
    const other = new Map(leaves(OPS_MONEY_COPY[locale]));
    assert.deepEqual([...other.keys()].sort(), [...en.keys()].sort(), locale);
    for (const [path, text] of other) assert.deepEqual(tokens(text), tokens(en.get(path)), `${locale}.${path}`);
  }
  for (const locale of ["en", "ar", "es"]) {
    for (const [path, text] of leaves(OPS_MONEY_COPY[locale])) {
      assert.ok(text.trim().length > 0, `${locale}.${path}`);
      for (const bad of ["[object", "undefined", "NaN"]) assert.ok(!text.includes(bad), `${locale}.${path} has ${bad}`);
    }
  }
  assert.equal(OPS_MONEY_COPY.en.title, "Bank transfer");
  assert.equal(OPS_MONEY_COPY.en.errors.checksum, "This IBAN does not check out. Look for a typing error.");
});
