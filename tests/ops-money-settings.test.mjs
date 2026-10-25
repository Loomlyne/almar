// Plan 04-09 Task 6: GET and POST /api/ops/money (lib/ops/money-settings.ts) with a fake rpc. The parser holds the same
// rules as the browser (lib/ops/money-form.ts) and the SQL (ops_save_money_settings): window 35..43200 minutes or
// null, balance due days 0..365 or null, the six bank keys all set or all cleared, IBAN mod 97 and BIC shape. Bank
// values are the documentation examples only (IBAN AE07 0331 2345 6789 0123 456, BIC TESTAEAAXXX) and bracket names.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const m = await loadTs("lib/ops/money-settings.ts");
const { runOps } = await loadTs("lib/ops/route-core.ts");
const { BOOKING_TERMS_IS_PLACEHOLDER } = await loadTs("lib/booking/terms.ts");
const SOURCE = readFileSync("lib/ops/money-settings.ts", "utf8");
const ROUTE = readFileSync("app/api/ops/money/route.ts", "utf8");

const OPS = "https://dashboard.almarprivatejourney.com";
const OWNER_ID = "0b0b0b0b-0000-4000-8000-000000000001";
const IBAN = "AE07 0331 2345 6789 0123 456";
const IBAN_STORED = "AE070331234567890123456";
const BIC = "TESTAEAAXXX";

const bank = (over = {}) => ({
  account_name: " [Account name] ",
  bank_name: "[Bank name]",
  iban: IBAN,
  swift: "testaeaa xxx",
  bank_address: "[Bank address]",
  note_en: "[Note line]",
  ...over,
});

const MONEY = {
  transfer_window_minutes: 1440,
  balance_due_days: 14,
  bank: { account_name: "[Account name]", bank_name: "[Bank name]", iban: IBAN_STORED, swift: BIC, bank_address: "[Bank address]", note_en: "[Note line]", note_ar: null, note_es: null },
  bank_complete: true,
  updated_at: "2026-10-21T08:00:00.000Z",
  updated_by: OWNER_ID,
};

function fakeDb(answers = {}) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      return answers[name] ?? { data: null, error: null };
    },
  };
}

const owner = (db) => ({ profile: { id: OWNER_ID, email: "[owner email]" }, admin: db });
const refusal = (code, details = null) => ({ data: null, error: { code: "P0001", message: `almar:${code}`, details, hint: null } });

function invalidField(fn, field) {
  assert.throws(fn, (e) => e.name === "OpsInvalid" && e.field === field, `field ${field}`);
}

// ---- parseMoneySave --------------------------------------------------------------------------------------------------

test("parseMoneySave: each group alone, the bank trimmed and normalized (IBAN and BIC without spaces, upper case)", () => {
  assert.deepEqual(m.parseMoneySave({ transfer_window_minutes: 35 }), { transfer_window_minutes: 35 });
  assert.deepEqual(m.parseMoneySave({ transfer_window_minutes: 43200 }), { transfer_window_minutes: 43200 });
  assert.deepEqual(m.parseMoneySave({ transfer_window_minutes: null }), { transfer_window_minutes: null }, "empty = requests stay closed");
  assert.deepEqual(m.parseMoneySave({ balance_due_days: 0 }), { balance_due_days: 0 });
  assert.deepEqual(m.parseMoneySave({ balance_due_days: 365 }), { balance_due_days: 365 });
  assert.deepEqual(m.parseMoneySave({ balance_due_days: null }), { balance_due_days: null });
  assert.deepEqual(m.parseMoneySave({ bank: bank() }), {
    bank: { account_name: "[Account name]", bank_name: "[Bank name]", iban: IBAN_STORED, swift: BIC, bank_address: "[Bank address]", note_en: "[Note line]" },
  });
});

test("parseMoneySave: all six cleared is allowed; note_ar / note_es only when sent", () => {
  const cleared = { account_name: "", bank_name: null, iban: " ", swift: null, bank_address: "", note_en: null };
  assert.deepEqual(m.parseMoneySave({ bank: cleared }).bank, { account_name: null, bank_name: null, iban: null, swift: null, bank_address: null, note_en: null });
  const withNotes = m.parseMoneySave({ bank: bank({ note_ar: " [سطر الملاحظة] ", note_es: "" }) }).bank;
  assert.equal(withNotes.note_ar, "[سطر الملاحظة]");
  assert.equal(withNotes.note_es, null, "an empty Spanish line is sent as null (cleared)");
  assert.equal("note_ar" in m.parseMoneySave({ bank: bank() }).bank, false, "absent stays absent (P-16 decides in SQL)");
});

test("parseMoneySave: an IBAN with a wrong check digit or a bad BIC is refused on its field (B8)", () => {
  invalidField(() => m.parseMoneySave({ bank: bank({ iban: "AE08 0331 2345 6789 0123 456" }) }), "bank.iban");
  invalidField(() => m.parseMoneySave({ bank: bank({ iban: "AE07 0331" }) }), "bank.iban");
  invalidField(() => m.parseMoneySave({ bank: bank({ swift: "TEST" }) }), "bank.swift");
  invalidField(() => m.parseMoneySave({ bank: bank({ swift: "TESTAEAAXX" }) }), "bank.swift");
});

test("parseMoneySave: ranges, types, keys and the six together", () => {
  invalidField(() => m.parseMoneySave(null), "body");
  invalidField(() => m.parseMoneySave({}), "body");
  invalidField(() => m.parseMoneySave({ vat_percent: "5.00" }), "vat_percent");
  for (const v of [34, 43201, 60.5, "60"]) invalidField(() => m.parseMoneySave({ transfer_window_minutes: v }), "transfer_window_minutes");
  for (const v of [-1, 366, 1.5, "14"]) invalidField(() => m.parseMoneySave({ balance_due_days: v }), "balance_due_days");
  invalidField(() => m.parseMoneySave({ bank: "x" }), "bank");
  invalidField(() => m.parseMoneySave({ bank: { ...bank(), branch: "[x]" } }), "bank.branch");
  const { note_en: _omit, ...missing } = bank();
  invalidField(() => m.parseMoneySave({ bank: missing }), "bank.note_en");
  invalidField(() => m.parseMoneySave({ bank: bank({ bank_name: "" }) }), "bank.bank_name");
  invalidField(() => m.parseMoneySave({ bank: bank({ account_name: "", bank_name: "" }) }), "bank.account_name");
  invalidField(() => m.parseMoneySave({ bank: bank({ account_name: "x".repeat(121) }) }), "bank.account_name");
  invalidField(() => m.parseMoneySave({ bank: bank({ bank_address: "x".repeat(301) }) }), "bank.bank_address");
  invalidField(() => m.parseMoneySave({ bank: bank({ note_en: "x".repeat(301) }) }), "bank.note_en");
  invalidField(() => m.parseMoneySave({ bank: bank({ note_ar: "x".repeat(301) }) }), "bank.note_ar");
  invalidField(() => m.parseMoneySave({ bank: bank({ bank_name: 5 }) }), "bank.bank_name");
  assert.equal(m.parseMoneySave({ bank: bank({ note_en: "ب".repeat(300) }) }).bank.note_en.length, 300, "Arabic counted in characters");
});

// ---- handlers --------------------------------------------------------------------------------------------------------

test("getMoneyRoute: ops_get_money_settings as it answers, and terms_final from BOOKING_TERMS_IS_PLACEHOLDER", async () => {
  const db = fakeDb({ ops_get_money_settings: { data: MONEY, error: null } });
  const out = await m.getMoneyRoute({ owner: owner(db) });
  assert.deepEqual(db.calls, [{ name: "ops_get_money_settings", args: undefined }]);
  assert.deepEqual(out, { body: { ok: true, money: MONEY, terms_final: !BOOKING_TERMS_IS_PLACEHOLDER } });
});

test("getMoneyRoute: an error or an unreadable answer is { dbError } (503 through route-core)", async () => {
  assert.ok("dbError" in (await m.getMoneyRoute({ owner: owner(fakeDb({ ops_get_money_settings: { data: null, error: { code: "57014", message: "[timeout]" } } })) })));
  assert.ok("dbError" in (await m.getMoneyRoute({ owner: owner(fakeDb({ ops_get_money_settings: { data: "x", error: null } })) })));
});

test("postMoneyRoute: one ops_save_money_settings { p, p_actor }; answers the saved values; never affects_site", async () => {
  const db = fakeDb({ ops_save_money_settings: { data: MONEY, error: null } });
  const body = m.parseMoneySave({ transfer_window_minutes: 1440, bank: bank() });
  const out = await m.postMoneyRoute({ owner: owner(db), body });
  assert.deepEqual(db.calls, [{ name: "ops_save_money_settings", args: { p: body, p_actor: OWNER_ID } }]);
  assert.deepEqual(out, { body: { ok: true, money: MONEY } });
});

test("postMoneyRoute: the SQL's bank fields come back as bank.<name>; not_owner 403; others 400 / 503", async () => {
  for (const name of ["iban", "swift", "account_name", "bank_name", "bank_address", "note_en", "note_ar", "note_es"]) {
    const out = await m.postMoneyRoute({ owner: owner(fakeDb({ ops_save_money_settings: refusal("invalid", JSON.stringify({ field: name })) })), body: { bank: {} } });
    assert.equal(out.status, 400, name);
    assert.deepEqual(out.body.error, { code: "invalid", field: `bank.${name}`, locale: null, detail: null }, name);
  }
  const window = await m.postMoneyRoute({ owner: owner(fakeDb({ ops_save_money_settings: refusal("invalid", '{"field":"transfer_window_minutes"}') })), body: {} });
  assert.equal(window.body.error.field, "transfer_window_minutes");
  const notOwner = await m.postMoneyRoute({ owner: owner(fakeDb({ ops_save_money_settings: refusal("not_owner") })), body: {} });
  assert.equal(notOwner.status, 403);
  assert.equal(notOwner.body.error.code, "not_owner");
  assert.ok("dbError" in (await m.postMoneyRoute({ owner: owner(fakeDb({ ops_save_money_settings: { data: null, error: { code: "23514", message: "[check]" } } })), body: {} })));
});

test("through runOps: a bad IBAN is 400 bank.iban before any rpc; a save answers 200 no-store with no site update", async () => {
  const post = async (body, db) => {
    const res = await runOps({
      method: "POST",
      request: new Request(`${OPS}/api/ops/money`, { method: "POST", headers: { "content-type": "application/json", origin: OPS }, body: JSON.stringify(body) }),
      decide: async () => ({ ok: true, owner: owner(db) }),
      parse: m.parseMoneySave,
      handler: m.postMoneyRoute,
      nodeEnv: "production",
    });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  const none = fakeDb();
  const bad = await post({ bank: bank({ iban: "AE08 0331 2345 6789 0123 456" }) }, none);
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.error, { code: "invalid", field: "bank.iban", locale: null, detail: null });
  assert.deepEqual(none.calls, []);

  const db = fakeDb({ ops_save_money_settings: { data: MONEY, error: null } });
  const good = await post({ balance_due_days: 14 }, db);
  assert.equal(good.status, 200);
  assert.equal(good.headers.get("cache-control"), "no-store");
  assert.equal("site" in good.body, false);
});

// ---- source rules ----------------------------------------------------------------------------------------------------

test("source: money-settings logs nothing, writes by RPC only, reads no environment; the route is the eight-line shape", () => {
  assert.equal(/console\./.test(SOURCE), false, "no logging");
  assert.equal(/\.from\(/.test(SOURCE), false, "no table read or write");
  assert.equal(/\.(insert|update|upsert|delete)\(/.test(SOURCE), false);
  assert.equal(/process\.env|SERVICE_ROLE|createSupabaseAdmin/.test(SOURCE), false);
  assert.equal(/from "next|from "react|from "@supabase/.test(SOURCE), false);
  assert.equal(/affects_site/.test(SOURCE), false);
  const f09 = ["r", "e_"].join("");
  assert.equal(SOURCE.includes(f09) || ROUTE.includes(f09), false, "F-09");
  assert.match(ROUTE, /^export const dynamic = "force-dynamic";$/m);
  assert.match(ROUTE, /^export const GET = opsGet\(getMoneyRoute\);$/m);
  assert.match(ROUTE, /^export const POST = opsPost\(parseMoneySave, postMoneyRoute\);$/m);
});
