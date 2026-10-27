// /api/ops/posts (plan 06-03): the validator refuses what ops_save_post refuses, the handlers call the right functions,
// and chunkedSend keeps a long post within the translate route's limits. Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const v = await loadTs("lib/ops/validate-posts.ts");
const h = await loadTs("lib/ops/posts-handlers.ts");
const c = await loadTs("lib/ops/translate-chunks.ts");
const { TRANSLATE_LIMITS } = await loadTs("lib/ops/translate.ts");

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const TODAY = "2026-10-27";

function invalid(fn, field, locale) {
  assert.throws(fn, (e) => {
    assert.equal(e.field, field);
    if (locale !== undefined) assert.equal(e.locale, locale);
    return true;
  });
}

const en = (title = "T", excerpt = "E") => ({ en: { title, excerpt } });
const text = (t) => ({ en: { text: t } });

test("parsePostsQuery: no id -> list; a uuid -> detail; anything else refused", () => {
  assert.deepEqual(v.parsePostsQuery(new URLSearchParams("")), { id: null });
  assert.deepEqual(v.parsePostsQuery(new URLSearchParams(`id=${ID}`)), { id: ID });
  invalid(() => v.parsePostsQuery(new URLSearchParams("id=1")), "id");
});

test("save: a new post needs slug and English title + excerpt; the date is not after today in Dubai", () => {
  const out = v.parsePostAction({ action: "save", slug: "a-post", published_at: TODAY, cover_media_id: ID, destination_id: null, translations: en() }, TODAY);
  assert.equal(out.slug, "a-post");
  assert.equal(out.published_at, TODAY);
  invalid(() => v.parsePostAction({ action: "save", translations: en() }, TODAY), "slug");
  invalid(() => v.parsePostAction({ action: "save", slug: "a" }, TODAY), "translations.en", "en");
  invalid(() => v.parsePostAction({ action: "save", slug: "a", translations: { en: { title: "T" } } }, TODAY), "translations.en.excerpt", "en");
  invalid(() => v.parsePostAction({ action: "save", slug: "a".repeat(81), translations: en() }, TODAY), "slug");
  invalid(() => v.parsePostAction({ action: "save", slug: "Bad Slug", translations: en() }, TODAY), "slug");
  invalid(() => v.parsePostAction({ action: "save", id: ID, published_at: "2026-10-28" }, TODAY), "published_at");
  invalid(() => v.parsePostAction({ action: "save", id: ID, is_sample: true }, TODAY), "is_sample");
  invalid(() => v.parsePostAction({ action: "save", id: ID, translations: { en: { title: "x".repeat(301) } } }, TODAY), "translations.en.title", "en");
});

test("save: locked_fields on ar/es only, the post's own fields", () => {
  const out = v.parsePostAction({ action: "save", id: ID, translations: { ar: { title: "ع", locked_fields: ["title"] } } }, TODAY);
  assert.deepEqual(out.translations.ar.locked_fields, ["title"]);
  invalid(() => v.parsePostAction({ action: "save", id: ID, translations: { ar: { locked_fields: ["text"] } } }, TODAY), "translations.ar.locked_fields", "ar");
});

test("blocks: kinds, a photo with a media id and no text, text blocks with English text and no media id, at most 100", () => {
  const out = v.parsePostAction(
    {
      action: "save",
      id: ID,
      blocks: [
        { kind: "heading", translations: text("H") },
        { kind: "photo", media_id: ID2 },
        { kind: "quote", translations: { en: { text: "Q" }, es: { text: "C", locked_fields: ["text"] } } },
      ],
    },
    TODAY,
  );
  assert.deepEqual(out.blocks[1], { kind: "photo", media_id: ID2 });
  assert.deepEqual(out.blocks[2].translations.es.locked_fields, ["text"]);
  invalid(() => v.parsePostAction({ action: "save", id: ID, blocks: [{ kind: "video" }] }, TODAY), "blocks.0.kind");
  invalid(() => v.parsePostAction({ action: "save", id: ID, blocks: [{ kind: "photo" }] }, TODAY), "blocks.0.media_id");
  invalid(() => v.parsePostAction({ action: "save", id: ID, blocks: [{ kind: "photo", media_id: ID2, translations: text("x") }] }, TODAY), "blocks.0.translations");
  invalid(() => v.parsePostAction({ action: "save", id: ID, blocks: [{ kind: "paragraph", media_id: ID2, translations: text("x") }] }, TODAY), "blocks.0.media_id");
  invalid(() => v.parsePostAction({ action: "save", id: ID, blocks: [{ kind: "paragraph", translations: { en: { text: " " } } }] }, TODAY), "blocks.0.translations.en.text", "en");
  invalid(() => v.parsePostAction({ action: "save", id: ID, blocks: [{ kind: "paragraph", translations: { ar: { text: "س", locked_fields: ["title"] } , en: { text: "x" } } }] }, TODAY), "blocks.0.translations.ar.locked_fields", "ar");
  invalid(() => v.parsePostAction({ action: "save", id: ID, blocks: Array(101).fill({ kind: "photo", media_id: ID2 }) }, TODAY), "blocks");
});

test("delete: { action, id } only; any other action or a non-object is refused", () => {
  assert.deepEqual(v.parsePostAction({ action: "delete", id: ID }, TODAY), { action: "delete", id: ID });
  invalid(() => v.parsePostAction({ action: "delete", id: ID, slug: "x" }, TODAY), "slug");
  invalid(() => v.parsePostAction({ action: "publish", id: ID }, TODAY), "action");
  invalid(() => v.parsePostAction("x", TODAY), "body");
});

function fakeAdmin(answers) {
  const calls = [];
  return {
    calls,
    rpc(fn, args) {
      calls.push([fn, args]);
      const a = answers[fn];
      return Promise.resolve(a && a.error ? a : { data: a ?? null, error: null });
    },
  };
}
const owner = (admin) => ({ profile: { id: ID }, admin });

test("handlers: list, detail, 404, save without the action key, delete, a database refusal passed on", async () => {
  const admin = fakeAdmin({ ops_list: [{ id: ID }], ops_get: { id: ID }, ops_save_post: { id: ID, affects_site: true } });
  assert.deepEqual((await h.getPosts({ owner: owner(admin), url: new URL("https://x/api/ops/posts") })).body.items, [{ id: ID }]);
  assert.deepEqual(admin.calls.at(-1), ["ops_list", { p_entity: "post" }]);
  await h.getPosts({ owner: owner(admin), url: new URL(`https://x/api/ops/posts?id=${ID}`) });
  assert.deepEqual(admin.calls.at(-1), ["ops_get", { p_entity: "post", p_id: ID }]);
  const missing = await h.getPosts({ owner: owner(fakeAdmin({})), url: new URL(`https://x/api/ops/posts?id=${ID}`) });
  assert.equal(missing.status, 404);
  const saved = await h.postPosts({ owner: owner(admin), body: { action: "save", id: ID, slug: "a" } });
  assert.deepEqual(admin.calls.at(-1), ["ops_save_post", { p: { id: ID, slug: "a" } }]);
  assert.deepEqual(saved.body, { ok: true, id: ID, affects_site: true });
  await h.postPosts({ owner: owner(admin), body: { action: "delete", id: ID } });
  assert.deepEqual(admin.calls.at(-1), ["ops_delete", { p_entity: "post", p_id: ID }]);
  const refusal = { error: { code: "P0001", message: "almar:published" } };
  const refused = await h.postPosts({ owner: owner(fakeAdmin({ ops_delete: refusal })), body: { action: "delete", id: ID } });
  assert.deepEqual(refused, { dbError: refusal.error });
});

test("the route file: dynamic, GET = opsGet(getPosts), POST = opsPost(parsePostAction, postPosts), nothing else", () => {
  const src = readFileSync("app/api/ops/posts/route.ts", "utf8");
  const exported = [...src.matchAll(/^export\s+const\s+(\w+)/gm)].map((m) => m[1]);
  assert.deepEqual(exported, ["dynamic", "GET", "POST"]);
  assert.match(src, /^export const POST = opsPost\(parsePostAction, postPosts\);$/m);
});

// ---- chunkedSend ---------------------------------------------------------------------------------------------------

function fakeSend(fail = () => false) {
  const calls = [];
  const send = async (path, body) => {
    calls.push(body);
    if (fail(body)) return { ok: false, status: 503, error: { code: "translate_busy", field: null, locale: null, detail: null } };
    return { ok: true, target: body.target, fields: Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, `[${k}]`])) };
  };
  return { calls, send };
}

test("chunkedSend's limits are the translate route's (copied so the browser never imports the route)", () => {
  assert.deepEqual(c.CHUNK_LIMITS, { fields: TRANSLATE_LIMITS.fields, json: TRANSLATE_LIMITS.json });
});

test("chunkedSend: a body that fits is sent exactly once", async () => {
  const { calls, send } = fakeSend();
  const reply = await c.chunkedSend(send)("/api/ops/translate", { target: "ar", fields: { title: "T", block_1: "B" } }, { timeoutMs: 1 });
  assert.equal(calls.length, 1);
  assert.equal(reply.fields.block_1, "[block_1]");
});

test("chunkedSend: a long post is split within the limits, in order, and the answers merged", async () => {
  const fields = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`block_${i + 1}`, "x".repeat(300)]));
  const { calls, send } = fakeSend();
  const reply = await c.chunkedSend(send)("/api/ops/translate", { target: "es", fields }, { timeoutMs: 1 });
  assert.ok(calls.length > 1);
  for (const call of calls) {
    assert.ok(Object.keys(call.fields).length <= TRANSLATE_LIMITS.fields);
    assert.ok(JSON.stringify(call.fields).length <= TRANSLATE_LIMITS.json);
  }
  assert.deepEqual(calls.flatMap((call) => Object.keys(call.fields)), Object.keys(fields));
  assert.equal(Object.keys(reply.fields).length, 60);
  assert.equal("left" in reply, false);
});

test("chunkedSend: a failed chunk adds its names to left; every chunk failing returns the first failure", async () => {
  const fields = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`block_${i + 1}`, "x".repeat(300)]));
  const half = fakeSend((body) => "block_1" in body.fields);
  const reply = await c.chunkedSend(half.send)("/api/ops/translate", { target: "ar", fields }, { timeoutMs: 1 });
  assert.equal(reply.ok, true);
  assert.ok(reply.left.includes("block_1"));
  assert.equal("block_1" in reply.fields, false);
  const none = fakeSend(() => true);
  const failed = await c.chunkedSend(none.send)("/api/ops/translate", { target: "ar", fields }, { timeoutMs: 1 });
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, "translate_busy");
});

test("chunkedSend: the daily limit stops the loop and is the reply, so the kit shows its reason", async () => {
  const fields = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`block_${i + 1}`, "x".repeat(300)]));
  const calls = [];
  let n = 0;
  const send = async (path, body) => {
    calls.push(body);
    n += 1;
    if (n === 2) return { ok: false, status: 429, error: { code: "translate_limit", field: null, locale: null, detail: null } };
    return { ok: true, target: body.target, fields: Object.fromEntries(Object.keys(body.fields).map((k) => [k, `[${k}]`])) };
  };
  const reply = await c.chunkedSend(send)("/api/ops/translate", { target: "ar", fields }, { timeoutMs: 1 });
  assert.equal(calls.length, 2, "no chunk is sent after the limit");
  assert.equal(reply.ok, false);
  assert.equal(reply.error.code, "translate_limit");
});
