// The pure side of Content -> Blog (plan 06-03): detail <-> form, the flat save body, the kit's translation fields and
// locks for block texts, the Publish gaps, the search and the date rule. Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const f = await loadTs("app/dashboard/(ops)/content/blog/post-forms.ts");
const { OPS_BLOG_COPY } = await loadTs("lib/copy/ops-blog.ts");
const copy = OPS_BLOG_COPY.en;

const ID = "11111111-1111-4111-8111-111111111111";
const MEDIA = { id: "22222222-2222-4222-8222-222222222222", key: "a.webp", url: "https://x/a.webp", width: 1, height: 1, alt_en: "A" };
const tr = (t) => ({ en: t ? { ...t, status: "published" } : null, ar: null, es: null });

function detail(overrides = {}) {
  return {
    id: ID,
    slug: "a-post",
    cover_media_id: MEDIA.id,
    cover: MEDIA,
    published_at: "2026-10-01T00:00:00.000Z",
    destination_id: null,
    featured_stay_id: null,
    featured_experience_id: null,
    is_published: true,
    blocks: [
      { id: "b1", position: 2, kind: "paragraph", media_id: null, image: null, translations: { en: { text: "P", status: "published" }, ar: { text: "ف", status: "published", locked_fields: ["text"] }, es: null } },
      { id: "b0", position: 1, kind: "heading", media_id: null, image: null, translations: tr({ text: "H" }) },
      { id: "b2", position: 3, kind: "photo", media_id: MEDIA.id, image: MEDIA, translations: tr(null) },
    ],
    translations: { en: { title: "T", excerpt: "E", seo_title: null, seo_description: null, status: "published" }, ar: { title: "ع", excerpt: "م", seo_title: null, seo_description: null, status: "published", locked_fields: ["title"] }, es: null },
    translation_state: { en: "published", ar: "published", es: "missing" },
    updated_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

test("postForm: blocks in position order, the date's day, block locks per language, the post's own locks", () => {
  const form = f.postForm(detail());
  assert.deepEqual(form.blocks.map((b) => b.kind), ["heading", "paragraph", "photo"]);
  assert.equal(form.date, "2026-10-01");
  assert.deepEqual(form.blocks[1].locked, { ar: true, es: false });
  assert.deepEqual(form.locked.ar, ["title"]);
  const again = f.postForm(detail(), form.blocks.map((b) => b.key));
  assert.deepEqual(again.blocks.map((b) => b.key), form.blocks.map((b) => b.key), "a read-back keeps the block keys");
});

test("the kit's fields: the post's four, then one per text block named by its key; locks follow the block, not its place", () => {
  const form = f.postForm(detail());
  const names = f.blockTranslationFields(form.blocks, copy).map((x) => x.name);
  assert.deepEqual(names, ["title", "excerpt", "seo_title", "seo_description", form.blocks[0].key, form.blocks[1].key]);
  const locks = f.postLocks(form);
  assert.ok(locks.ar.includes(form.blocks[1].key));
  const moved = { ...form, blocks: f.movedBlocks(form.blocks, form.blocks[1].key, -1) };
  assert.ok(f.postLocks(moved).ar.includes(form.blocks[1].key), "the paragraph's lock moved with it");
  assert.equal(f.blockName(copy, moved.blocks[0], 0), "Paragraph 1");
});

test("postPayload: flat body, address only before publish, blocks in order with locks, empty rows dropped", () => {
  const form = f.postForm(detail());
  const withEmpty = { ...form, blocks: [...form.blocks, f.newBlock("quote"), f.newBlock("photo")] };
  const out = f.postPayload(withEmpty, { publish: false, today: "2026-10-27" });
  assert.equal(out.ok, true);
  assert.equal(out.body.action, "save");
  assert.equal("slug" in out.body, false, "a published post's address is never sent");
  assert.equal(out.body.blocks.length, 3, "the empty quote and photo rows are not blocks yet");
  assert.deepEqual(out.body.blocks[2], { kind: "photo", media_id: MEDIA.id });
  assert.deepEqual(out.body.blocks[1].translations.ar, { text: "ف", status: "published", locked_fields: ["text"] });
  assert.equal(out.body.blocks[1].translations.es, null);
  assert.deepEqual(out.body.translations.ar.locked_fields, ["title"]);
  assert.equal(out.body.published_at, "2026-10-01");
});

test("postPayload refuses before any request: bad address on a draft, a date after today, no English title or excerpt", () => {
  const draft = { ...f.emptyPostForm(), text: { ...f.emptyPostForm().text, en: { title: "T", excerpt: "E", seo_title: "", seo_description: "" } } };
  assert.deepEqual(f.postPayload({ ...draft, slug: "Bad Slug" }, { publish: false, today: "2026-10-27" }), { ok: false, field: "slug" });
  assert.deepEqual(f.postPayload({ ...draft, slug: "ok", date: "2026-10-28" }, { publish: false, today: "2026-10-27" }), { ok: false, field: "published_at" });
  assert.deepEqual(f.postPayload({ ...draft, slug: "ok", text: { ...draft.text, en: { ...draft.text.en, excerpt: " " } } }, { publish: false, today: "2026-10-27" }), { ok: false, field: "translations.en.excerpt" });
  const ok = f.postPayload({ ...draft, slug: "ok" }, { publish: true, today: "2026-10-27" });
  assert.equal(ok.body.slug, "ok");
  assert.equal("published_at" in ok.body, false, "no date typed: the server keeps or sets its own");
});

test("postWithTranslations: Arabic and Spanish go back to the post and to each block; block locks split from post locks", () => {
  const form = f.postForm(detail());
  const [h, p] = form.blocks;
  const next = f.postWithTranslations(
    form,
    { ar: { title: "ع", excerpt: "م", [h.key]: "ع1", [p.key]: "ف" }, es: { title: "T", excerpt: "E", [h.key]: "H1", [p.key]: "P1" } },
    { ar: ["title", p.key], es: [h.key] },
  );
  assert.equal(next.blocks[0].text.es, "H1");
  assert.deepEqual(next.blocks[0].locked, { ar: false, es: true });
  assert.deepEqual(next.locked, { ar: ["title"], es: [] });
});

test("missingForPost: cover, titles and excerpts, and each block text in Arabic and Spanish with its own field", () => {
  const form = { ...f.postForm(detail()), cover: null };
  const missing = f.missingForPost(form);
  assert.ok(missing.some((m) => m.field === "cover" && m.locale === null));
  assert.ok(missing.some((m) => m.locale === "es" && m.field === "title"));
  assert.ok(missing.some((m) => m.field === f.missingBlockField("es", form.blocks[1])));
  assert.equal(missing.some((m) => m.field === f.missingBlockField("ar", form.blocks[1])), false);
});

test("matchesPostSearch folds case and accents; futureDate compares days", () => {
  assert.equal(f.matchesPostSearch({ title_en: "Cartagena Nights" }, "cartagéna"), true);
  assert.equal(f.matchesPostSearch({ title_en: "Cartagena Nights" }, "bogota"), false);
  assert.equal(f.futureDate("2026-10-28", "2026-10-27"), true);
  assert.equal(f.futureDate("", "2026-10-27"), false);
});
