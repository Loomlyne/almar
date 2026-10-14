// Plan 03.2-15 (owner, 2026-10-15): the stay's private access Notes in English with the Arabic and Spanish the AI fills
// (migration 20261015120000_stay_access_notes_i18n.sql). The validator takes notes_ar and notes_es like notes; the
// handlers read and pass them through. No server, no database: the owner client is a fake. The database side (columns,
// checks, absent-untouched, grants) is supabase/tests/stay_access_notes.test.sql.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const p = await loadTs("lib/ops/validate-catalog.ts");
const h = await loadTs("lib/ops/catalog-handlers.ts");

const STAY = "11111111-1111-4111-8111-111111111111";

function invalid(fn, field) {
  assert.throws(fn, (e) => {
    assert.equal(e.name, "OpsInvalid", String(e));
    assert.equal(e.field, field);
    return true;
  });
}

test("validator: notes_ar and notes_es are taken like notes (trimmed, blank to null, at most 2,000)", () => {
  const out = p.parseAccessSave({ action: "save", stay_id: STAY, access: { notes: " [en] ", notes_ar: " [ar] ", notes_es: "  " } });
  assert.deepEqual(out, { action: "save", stay_id: STAY, access: { notes: "[en]", notes_ar: "[ar]", notes_es: null } });
  invalid(() => p.parseAccessSave({ action: "save", stay_id: STAY, access: { notes_ar: "n".repeat(2001) } }), "access.notes_ar");
  invalid(() => p.parseAccessSave({ action: "save", stay_id: STAY, access: { notes_es: "n".repeat(2001) } }), "access.notes_es");
  // A key not sent stays out of the payload, so the database leaves that column alone.
  assert.deepEqual(p.parseAccessSave({ action: "save", stay_id: STAY, access: { notes_es: "[es]" } }).access, { notes_es: "[es]" });
  // Still no other key.
  invalid(() => p.parseAccessSave({ action: "save", stay_id: STAY, access: { notes_fr: "x" } }), "access.notes_fr");
});

/** The owner's client, faked: the stays row, the access row and every rpc call recorded. */
function fakeOwner(accessRow) {
  const calls = { selects: [], rpcs: [] };
  const admin = {
    from(table) {
      return {
        select(columns) {
          calls.selects.push({ table, columns });
          return {
            eq: () => ({
              maybeSingle: async () => ({ data: table === "stays" ? { id: STAY, destination_id: null, base_nightly_rate_aed: null } : accessRow, error: null }),
            }),
          };
        },
      };
    },
    rpc: async (name, args) => {
      calls.rpcs.push({ name, args });
      return { data: { stay_id: STAY }, error: null };
    },
  };
  return { owner: { profile: { id: "00000000-0000-4000-8000-000000000001" }, admin }, calls };
}

const outcomeBody = (outcome) => (outcome.body ?? outcome.json ?? outcome);

test("handler: the access GET reads notes_ar and notes_es and returns them", async () => {
  const { owner, calls } = fakeOwner({
    address: null,
    wifi_name: null,
    wifi_password: null,
    door_code: null,
    notes: "[en]",
    notes_ar: "[ar]",
    notes_es: "[es]",
    updated_at: "2026-10-15T00:00:00Z",
  });
  const outcome = await h.getStayAccess({ owner, url: new URL(`https://ops.test/api/ops/stay-access?stay_id=${STAY}`) });
  const access = calls.selects.find((select) => select.table === "stay_access");
  assert.ok(access, "stay_access is read");
  assert.match(access.columns, /\bnotes_ar\b/);
  assert.match(access.columns, /\bnotes_es\b/);
  const body = JSON.stringify(outcomeBody(outcome));
  assert.match(body, /"notes_ar":"\[ar\]"/);
  assert.match(body, /"notes_es":"\[es\]"/);
});

test("handler: the access POST passes notes_ar and notes_es to ops_save_stay_access as parsed", async () => {
  const { owner, calls } = fakeOwner(null);
  const body = p.parseAccessSave({ action: "save", stay_id: STAY, access: { notes: "[en]", notes_ar: "[ar]", notes_es: null } });
  await h.postStayAccess({ owner, body });
  assert.deepEqual(calls.rpcs, [{ name: "ops_save_stay_access", args: { p: { stay_id: STAY, access: { notes: "[en]", notes_ar: "[ar]", notes_es: null } } } }]);
});

// ---- the Access card's Notes translation (access-notes.ts, the kit's plan) -----------------------------------------------

const n = await loadTs("app/dashboard/(ops)/catalog/stays/access-notes.ts");
const filled = (text) => ({ ok: true, target: "x", fields: { notes: text } });
const refused = { ok: false, status: 502, error: { code: "translate_failed", field: null, locale: null, detail: null } };
const base = { english: "[en 2]", savedEnglish: "[en 1]", notes: { ar: "[ar 1]", es: "[es 1]" }, savedNotes: { ar: "[ar 1]", es: "[es 1]" }, touched: new Set() };

test("notes: a changed English asks both; both filled are sent and shown", () => {
  const out = n.notesForSave({ ...base, replies: { ar: filled("[ar 2]"), es: filled("[es 2]") } });
  assert.deepEqual(out.asked, ["ar", "es"]);
  assert.deepEqual(out.send, { notes_ar: "[ar 2]", notes_es: "[es 2]" });
  assert.deepEqual(out.after, { ar: "[ar 2]", es: "[es 2]" });
  assert.equal(out.failed, false);
});

test("notes: a language the AI did not fill stays out of the save and keeps its stored text (owner rule)", () => {
  const out = n.notesForSave({ ...base, replies: { ar: refused, es: filled("[es 2]") } });
  assert.deepEqual(out.send, { notes_es: "[es 2]" });
  assert.deepEqual(out.after, { ar: "[ar 1]", es: "[es 2]" });
  assert.equal(out.failed, true);
  const none = n.notesForSave({ ...base, replies: { ar: null, es: null } });
  assert.deepEqual(none.send, {});
  assert.deepEqual(none.after, base.savedNotes);
  assert.equal(none.failed, true);
});

test("notes: an AI answer over 2,000 characters counts as not filled", () => {
  const out = n.notesForSave({ ...base, replies: { ar: filled("ن".repeat(2001)), es: filled("[es 2]") } });
  assert.deepEqual(out.send, { notes_es: "[es 2]" });
  assert.equal(out.failed, true);
});

test("notes: Arabic typed by the owner is sent as typed and the AI is not asked for it", () => {
  const out = n.notesForSave({ ...base, english: "[en 1]", notes: { ar: "[ar typed]", es: "[es 1]" }, touched: new Set(["ar:notes"]), replies: {} });
  assert.deepEqual(out.asked, []);
  assert.deepEqual(out.send, { notes_ar: "[ar typed]" });
  assert.equal(out.failed, false);
});

test("notes: an English emptied empties both translations; an English kept with a blank Spanish asks for Spanish only", () => {
  const cleared = n.notesForSave({ ...base, english: "", replies: {} });
  assert.deepEqual(cleared.send, { notes_ar: null, notes_es: null });
  assert.deepEqual(cleared.after, { ar: "", es: "" });
  const gap = n.notesForSave({ ...base, english: "[en 1]", notes: { ar: "[ar 1]", es: "" }, savedNotes: { ar: "[ar 1]", es: "" }, replies: { es: filled("[es 1]") } });
  assert.deepEqual(gap.asked, ["es"]);
  assert.deepEqual(gap.send, { notes_es: "[es 1]" });
});
