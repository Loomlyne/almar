// /api/ops/legal (plan 06-04): the validator's caps and kinds, the handlers on a fake rpc, and the form's pure side.
// Bracketed stand-ins only: no legal text is written by us (F-07). Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const v = await loadTs("lib/ops/validate-legal.ts");
const h = await loadTs("lib/ops/legal-handlers.ts");
const f = await loadTs("app/dashboard/(ops)/content/legal/legal-forms.ts");

const ID = "11111111-1111-4111-8111-111111111111";

function invalid(fn, field, locale) {
  assert.throws(fn, (e) => {
    assert.equal(e.field, field);
    if (locale !== undefined) assert.equal(e.locale, locale);
    return true;
  });
}

const en = (extra = {}) => ({ en: { title: "[T]", ...extra } });
const block = (kind = "paragraph", text = "[x]") => ({ kind, translations: { en: { text } } });

test("parseLegalSave: every kind is accepted; an unknown kind is refused", () => {
  for (const kind of v.LEGAL_KINDS) assert.equal(v.parseLegalSave({ kind, translations: en() }).kind, kind);
  invalid(() => v.parseLegalSave({ kind: "cookies", translations: en() }), "kind");
  invalid(() => v.parseLegalSave({ translations: en() }), "kind");
  invalid(() => v.parseLegalSave({ kind: "terms", extra: 1 }), "extra");
  invalid(() => v.parseLegalSave("x"), "body");
});

test("parseLegalSave: blocks: heading, paragraph and quote; at most 200; at most 6000 characters; English required", () => {
  const out = v.parseLegalSave({ kind: "terms", blocks: [block("heading"), block("paragraph"), block("quote")] });
  assert.deepEqual(out.blocks.map((b) => b.kind), ["heading", "paragraph", "quote"]);
  invalid(() => v.parseLegalSave({ kind: "terms", blocks: [block("photo")] }), "blocks.0.kind");
  invalid(() => v.parseLegalSave({ kind: "terms", blocks: Array.from({ length: 201 }, () => block()) }), "blocks");
  assert.equal(v.parseLegalSave({ kind: "terms", blocks: Array.from({ length: 200 }, () => block()) }).blocks.length, 200);
  invalid(() => v.parseLegalSave({ kind: "terms", blocks: [block("paragraph", "x".repeat(6001))] }), "blocks.0.translations.en.text", "en");
  invalid(() => v.parseLegalSave({ kind: "terms", blocks: [{ kind: "paragraph", translations: { ar: { text: "[x]" } } }] }), "blocks.0.translations.en", "en");
  invalid(() => v.parseLegalSave({ kind: "terms", blocks: [{ kind: "paragraph", media_id: ID, translations: { en: { text: "[x]" } } }] }), "blocks.0.media_id");
  invalid(() => v.parseLegalSave({ kind: "terms", blocks: "x" }), "blocks");
});

test("parseLegalSave: the caps of the text fields", () => {
  invalid(() => v.parseLegalSave({ kind: "terms", translations: { en: { title: "x".repeat(161) } } }), "translations.en.title", "en");
  invalid(() => v.parseLegalSave({ kind: "terms", translations: en({ seo_title: "x".repeat(71) }) }), "translations.en.seo_title", "en");
  invalid(() => v.parseLegalSave({ kind: "terms", translations: en({ seo_description: "x".repeat(171) }) }), "translations.en.seo_description", "en");
  assert.equal(v.parseLegalSave({ kind: "terms", translations: { en: { title: "ب".repeat(160) } } }).translations.en.title.length, 160, "characters, not bytes");
  invalid(() => v.parseLegalSave({ kind: "terms", translations: { en: { title: "" } } }), "translations.en.title", "en");
});

test("parseLegalSave: the banner columns on cookie_banner only; its record has no search engine fields", () => {
  for (const column of ["necessary_label", "necessary_body", "analytics_label", "analytics_body"]) {
    invalid(() => v.parseLegalSave({ kind: "privacy", translations: en({ [column]: "[x]" }) }), `translations.en.${column}`, "en");
    assert.equal(v.parseLegalSave({ kind: "cookie_banner", translations: en({ [column]: "[x]" }) }).translations.en[column], "[x]");
  }
  invalid(() => v.parseLegalSave({ kind: "cookie_banner", translations: en({ seo_title: "[x]" }) }), "translations.en.seo_title", "en");
});

test("parseLegalSave: locked_fields on Arabic and Spanish, refused on English, its names from the kind's own fields", () => {
  const out = v.parseLegalSave({ kind: "privacy", translations: { ...en(), ar: { title: "[x]", locked_fields: ["title"] } } });
  assert.deepEqual(out.translations.ar.locked_fields, ["title"]);
  invalid(() => v.parseLegalSave({ kind: "privacy", translations: { en: { title: "[x]", locked_fields: ["title"] } } }), "translations.en.locked_fields", "en");
  invalid(() => v.parseLegalSave({ kind: "privacy", translations: { ...en(), ar: { title: "[x]", locked_fields: ["necessary_label"] } } }), "translations.ar.locked_fields", "ar");
});

function fakeOwner(answers) {
  const calls = [];
  return {
    calls,
    owner: {
      profile: { id: "owner" },
      admin: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          return answers[name] ?? { data: null, error: { code: "XX", message: "unexpected" } };
        },
      },
    },
  };
}

const LIST = [{ id: ID, kind: "terms", title_en: null, is_published: false, translation_state: {}, updated_at: "x" }];
const url = (search = "") => new URL(`https://dashboard.almarprivatejourney.com/api/ops/legal${search}`);

test("getLegal: without a kind, the summaries; with a kind, the detail by its id", async () => {
  const list = fakeOwner({ ops_list: { data: LIST, error: null } });
  assert.deepEqual(await h.getLegal({ owner: list.owner, url: url() }), { body: { ok: true, items: LIST } });
  assert.deepEqual(list.calls, [{ name: "ops_list", args: { p_entity: "legal_page" } }]);

  const detail = fakeOwner({ ops_list: { data: LIST, error: null }, ops_get: { data: { id: ID, kind: "terms", blocks: [] }, error: null } });
  const out = await h.getLegal({ owner: detail.owner, url: url("?kind=terms") });
  assert.deepEqual(out, { body: { ok: true, item: { id: ID, kind: "terms", blocks: [] } } });
  assert.deepEqual(detail.calls[1], { name: "ops_get", args: { p_entity: "legal_page", p_id: ID } });
});

test("getLegal: an unknown kind is refused; a missing row is not_found; a database error goes to mapDbError", async () => {
  await assert.rejects(() => h.getLegal({ owner: fakeOwner({}).owner, url: url("?kind=x") }), (e) => e.field === "kind");
  const none = await h.getLegal({ owner: fakeOwner({ ops_list: { data: [], error: null } }).owner, url: url("?kind=terms") });
  assert.equal(none.status, 404);
  const failed = await h.getLegal({ owner: fakeOwner({ ops_list: { data: null, error: { code: "57014", message: "[t]" } } }).owner, url: url() });
  assert.ok("dbError" in failed);
});

test("postLegal: one ops_save_legal_page; answers its id and affects_site", async () => {
  const body = v.parseLegalSave({ kind: "terms", translations: en() });
  const save = fakeOwner({ ops_save_legal_page: { data: { id: ID, kind: "terms", affects_site: true }, error: null } });
  assert.deepEqual(await h.postLegal({ owner: save.owner, body }), { body: { ok: true, id: ID, affects_site: true } });
  assert.deepEqual(save.calls, [{ name: "ops_save_legal_page", args: { p: body } }]);
  const refused = await h.postLegal({ owner: fakeOwner({ ops_save_legal_page: { data: null, error: { message: "almar:invalid" } } }).owner, body });
  assert.ok("dbError" in refused);
});

test("the route is force-dynamic and built with opsGet and opsPost", () => {
  const src = readFileSync("app/api/ops/legal/route.ts", "utf8");
  assert.match(src, /^export const dynamic = "force-dynamic";$/m);
  assert.match(src, /^export const GET = opsGet\(getLegal\);$/m);
  assert.match(src, /^export const POST = opsPost\(parseLegalSave, postLegal/m);
});

// ---- the form ------------------------------------------------------------------------------------------------------

const record = (extra) => ({ title: "[T]", seo_title: null, seo_description: null, status: "published", locked_fields: [], ...extra });
function detail(kind = "privacy", opts = {}) {
  return {
    id: ID,
    kind,
    is_published: opts.published ?? false,
    updated_at: "x",
    translation_state: {},
    blocks: opts.blocks ?? [],
    translations: { en: record(), ar: opts.ar === undefined ? record() : opts.ar, es: opts.es === undefined ? record() : opts.es },
  };
}
const dbBlock = (position, kind, text, arLocked = false) => ({
  id: `b${position}`,
  position,
  kind,
  translations: {
    en: { text, status: "published", locked_fields: [] },
    ar: { text: `${text} ar`, status: "published", locked_fields: arLocked ? ["text"] : [] },
    es: { text: `${text} es`, status: "published", locked_fields: [] },
  },
});

test("legalStatus: Not written, Draft, Published", () => {
  assert.equal(f.legalStatus({ title_en: null, is_published: false }), "none");
  assert.equal(f.legalStatus({ title_en: " ", is_published: false }), "none");
  assert.equal(f.legalStatus({ title_en: "[T]", is_published: false }), "draft");
  assert.equal(f.legalStatus({ title_en: "[T]", is_published: true }), "published");
});

test("legalPayload: an empty English title is refused before any request", () => {
  const form = f.legalForm(detail("privacy", { ar: null, es: null }));
  assert.deepEqual(f.legalPayload({ ...form, text: { ...form.text, en: { ...form.text.en, title: " " } } }, { publish: false }), { ok: false, field: "translations.en.title" });
});

test("legalPayload: blocks in order with their locks; an empty row is not sent; ar/es published on Publish", () => {
  const form = f.legalForm(detail("privacy", { blocks: [dbBlock(2, "quote", "[q]"), dbBlock(1, "heading", "[h]", true)] }));
  assert.deepEqual(form.blocks.map((b) => b.kind), ["heading", "quote"]);
  const withEmpty = { ...form, blocks: [...form.blocks, { key: "block_x", kind: "paragraph", text: { en: "  ", ar: "", es: "" }, locked: { ar: false, es: false } }] };
  const { body } = f.legalPayload(withEmpty, { publish: true });
  assert.equal(body.kind, "privacy");
  assert.equal(body.blocks.length, 2);
  assert.deepEqual(body.blocks[0].translations.ar, { text: "[h] ar", status: "published", locked_fields: ["text"] });
  assert.deepEqual(body.blocks[1].translations.ar.locked_fields, []);
  assert.equal(body.translations.ar.status, "published");
  assert.deepEqual(f.sentBlockKeys(withEmpty), form.blocks.map((b) => b.key));
});

test("legalForm: the block keys are reused on a read-back, so a lock stays on its block", () => {
  const form = f.legalForm(detail("privacy", { blocks: [dbBlock(1, "heading", "[h]", true)] }), ["block_kept"]);
  assert.equal(form.blocks[0].key, "block_kept");
  assert.deepEqual(f.legalLocks(form).ar, ["block_kept"]);
});

test("legalPayload: an empty Arabic title: a stored record goes without the key, a new one is held back and its text kept", () => {
  const blank = { title: "", seo_title: "[S ar]", seo_description: "", necessary_label: "", necessary_body: "", analytics_label: "", analytics_body: "" };
  const stored = f.legalForm(detail());
  const asStored = f.legalPayload({ ...stored, text: { ...stored.text, ar: blank } }, { publish: false }).body;
  assert.equal("title" in asStored.translations.ar, false);
  assert.equal(asStored.translations.ar.seo_title, "[S ar]");

  const fresh = f.legalForm(detail("privacy", { ar: null }));
  const held = { ...fresh, text: { ...fresh.text, ar: blank } };
  assert.equal("ar" in f.legalPayload(held, { publish: false }).body.translations, false);
  assert.equal(f.keepHeldText(fresh, held).text.ar.seo_title, "[S ar]");
});

test("legalPayload: a language with nothing written is null", () => {
  const form = f.legalForm(detail("privacy", { ar: null, es: null }));
  const { body } = f.legalPayload(form, { publish: false });
  assert.equal(body.translations.ar, null);
  assert.equal(body.translations.es, null);
});

test("cookie banner: only its own fields; its text is paragraph blocks", () => {
  const form = f.legalForm(detail("cookie_banner"));
  assert.deepEqual([...f.legalBlockKinds("cookie_banner")], ["paragraph"]);
  const { body } = f.legalPayload(form, { publish: false });
  assert.equal("blocks" in body, true);
  assert.equal("seo_title" in body.translations.en, false);
  assert.equal("necessary_label" in body.translations.en, true);
  assert.equal("necessary_label" in f.legalPayload(f.legalForm(detail("terms")), { publish: false }).body.translations.en, false);
});

test("missingForLegal: a page needs a block; each block's text in three languages; the banner both labels", () => {
  const noBlocks = f.legalForm(detail());
  assert.deepEqual(f.missingForLegal(noBlocks), [{ locale: null, field: "blocks" }]);
  const full = f.legalForm(detail("privacy", { blocks: [dbBlock(1, "paragraph", "[p]")] }));
  assert.deepEqual(f.missingForLegal(full), []);
  const gap = { ...full, blocks: [{ ...full.blocks[0], text: { ...full.blocks[0].text, es: "" } }] };
  assert.deepEqual(f.missingForLegal(gap), [{ locale: "es", field: full.blocks[0].key }]);
  const banner = f.legalForm(detail("cookie_banner"));
  const fields = f.missingForLegal(banner).map((item) => `${item.locale}.${item.field}`);
  assert.ok(fields.includes("en.necessary_label") && fields.includes("ar.analytics_label"));
  assert.equal(fields.includes("null.blocks"), false, "the banner needs no block");
});

test("liveLegalFields: only a published page's published languages", () => {
  assert.deepEqual(f.liveLegalFields(f.legalForm(detail())), {});
  const live = f.liveLegalFields(f.legalForm(detail("privacy", { published: true, es: record({ status: "draft" }) })));
  assert.deepEqual(live.ar, ["title"]);
  assert.equal("es" in live, false);
});

test("no legal wording in the editor's own files (F-07): every label comes from lib/copy/ops-legal.ts", () => {
  for (const file of ["legal-forms.ts", "legal-screen.tsx"]) {
    const src = readFileSync(`app/dashboard/(ops)/content/legal/${file}`, "utf8");
    assert.doesNotMatch(src, /placeholder=/);
  }
});
