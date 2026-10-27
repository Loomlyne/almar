// /api/ops/pages, /api/ops/page-items, /api/ops/nav (plan 06-02): the validators refuse what the database refuses, the
// section checks follow lib/data/page-sections.ts, and each handler calls the right function of migration
// 20261025120000_site_cms.sql with the right arguments. Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const v = await loadTs("lib/ops/validate-site-pages.ts");
const h = await loadTs("lib/ops/site-pages-handlers.ts");
const sections = await loadTs("lib/data/page-sections.ts");

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

function invalid(fn, field, locale) {
  assert.throws(fn, (e) => {
    assert.equal(e.field, field);
    if (locale !== undefined) assert.equal(e.locale, locale);
    return true;
  });
}

// ---- parsePageSave / checkSectionSave ----------------------------------------------------------------------------------

test("parsePageSave: id, is_shown, an https video (or null / blank to clear), media slots, translations", () => {
  const out = v.parsePageSave({ id: ID, is_shown: false, video_url: " https://media.example/a.mp4 ", media: { poster: [ID2] }, translations: { en: { headline: "X" } } });
  assert.deepEqual(out, { id: ID, is_shown: false, video_url: "https://media.example/a.mp4", media: { poster: [ID2] }, translations: { en: { headline: "X" } } });
  assert.equal(v.parsePageSave({ id: ID, video_url: null }).video_url, null);
  assert.equal(v.parsePageSave({ id: ID, video_url: "  " }).video_url, null);
});

test("parsePageSave: http, javascript:, a space, a 501-character address and an unknown key are refused", () => {
  for (const url of ["http://a.example/v.mp4", "javascript:alert(1)", "https://a b", `https://${"a".repeat(493)}`]) {
    invalid(() => v.parsePageSave({ id: ID, video_url: url }), "video_url");
  }
  invalid(() => v.parsePageSave({ id: ID, colour: "red" }), "colour");
  invalid(() => v.parsePageSave({ id: ID, translations: { en: { paragraphs: Array(21).fill("p") } } }), "translations.en.paragraphs", "en");
});

test("checkSectionSave: only the section's text columns, slots and video; one photo on a single slot", () => {
  const hero = sections.sectionSpec("home", "hero");
  const welcome = sections.sectionSpec("home", "welcome");
  v.checkSectionSave({ id: ID, translations: { en: { headline: "X" }, ar: { headline: "س", locked_fields: ["headline"] } } }, hero, { heroFixed: false });
  invalid(() => v.checkSectionSave({ id: ID, translations: { en: { heading: "X" } } }, hero, { heroFixed: false }), "translations.en.heading", "en");
  invalid(() => v.checkSectionSave({ id: ID, translations: { ar: { locked_fields: ["heading"] } } }, hero, { heroFixed: false }), "translations.ar.locked_fields", "ar");
  invalid(() => v.checkSectionSave({ id: ID, media: { images: [ID] } }, hero, { heroFixed: false }), "media.images");
  invalid(() => v.checkSectionSave({ id: ID, media: { poster: [ID, ID2] } }, hero, { heroFixed: false }), "media.poster");
  v.checkSectionSave({ id: ID, media: { images: [ID, ID2] } }, welcome, { heroFixed: false });
  invalid(() => v.checkSectionSave({ id: ID, video_url: null }, welcome, { heroFixed: false }), "video_url");
});

test("checkSectionSave: with heroes fixed (owner's answer A), Show on site is refused on a hero only", () => {
  const hero = sections.sectionSpec("about", "hero");
  invalid(() => v.checkSectionSave({ id: ID, is_shown: false }, hero, { heroFixed: true }), "is_shown");
  v.checkSectionSave({ id: ID, is_shown: false }, hero, { heroFixed: false });
  v.checkSectionSave({ id: ID, is_shown: false }, sections.sectionSpec("about", "values"), { heroFixed: true });
});

test("parsePagesQuery: one of the five pages, or an id", () => {
  assert.deepEqual(v.parsePagesQuery(new URLSearchParams("page=about")), { page: "about", id: null });
  assert.deepEqual(v.parsePagesQuery(new URLSearchParams("")), { page: null, id: null });
  invalid(() => v.parsePagesQuery(new URLSearchParams("page=blog")), "page");
});

// ---- parsePageItemAction ---------------------------------------------------------------------------------------------

test("parsePageItemAction: a new card needs its section, slug and English title; delete and reorder", () => {
  const save = v.parsePageItemAction({ action: "save", section_id: ID, slug: "new-card", is_shown: true, translations: { en: { title: "T" }, ar: { title: "ع", locked_fields: ["title"] } } });
  assert.equal(save.slug, "new-card");
  assert.deepEqual(save.translations.ar.locked_fields, ["title"]);
  invalid(() => v.parsePageItemAction({ action: "save", slug: "x", translations: { en: { title: "T" } } }), "section_id");
  invalid(() => v.parsePageItemAction({ action: "save", section_id: ID, translations: { en: { title: "T" } } }), "slug");
  invalid(() => v.parsePageItemAction({ action: "save", section_id: ID, slug: "x" }), "translations.en", "en");
  assert.deepEqual(v.parsePageItemAction({ action: "delete", id: ID }), { action: "delete", id: ID });
  assert.deepEqual(v.parsePageItemAction({ action: "reorder", section_id: ID, ids: [ID, ID2] }).ids, [ID, ID2]);
  invalid(() => v.parsePageItemAction({ action: "move" }), "action");
});

// ---- parseNavSave ------------------------------------------------------------------------------------------------------

const label = (en) => ({ en: { label: en } });

test("parseNavSave: page keys, journey:<slug>, a page not on the site yet, https addresses", () => {
  const out = v.parseNavSave({
    area: "header",
    links: [
      { link_kind: "internal", target: "about", is_shown: true, translations: label("About") },
      { link_kind: "internal", target: "list-with-us", translations: label("List with us") },
      { link_kind: "internal", target: "journey:the-explorer", translations: label("The Explorer") },
      { id: ID, link_kind: "external", target: "https://example.com/a", is_shown: false, translations: { ar: { label: "س", locked_fields: ["label"] } } },
    ],
  });
  assert.equal(out.links.length, 4);
  assert.equal(out.links[1].is_shown, true, "absent is_shown = shown");
  assert.equal(out.links[3].id, ID);
});

test("parseNavSave: login, mailto:, tel:, http:, javascript:, an unknown key, 21 links, an English label missing", () => {
  const link = (target, kind = "internal") => ({ area: "footer", links: [{ link_kind: kind, target, translations: label("x") }] });
  invalid(() => v.parseNavSave(link("login")), "links.0.target");
  invalid(() => v.parseNavSave(link("nope")), "links.0.target");
  for (const target of ["mailto:a@b.c", "tel:+971", "http://example.com", "javascript:alert(1)"]) {
    invalid(() => v.parseNavSave(link(target, "external")), "links.0.target");
  }
  invalid(() => v.parseNavSave({ area: "side", links: [] }), "area");
  invalid(() => v.parseNavSave({ area: "header", links: Array(21).fill({ link_kind: "internal", target: "about", translations: label("x") }) }), "links");
  invalid(() => v.parseNavSave({ area: "header", links: [{ link_kind: "internal", target: "about", translations: { en: {} } }] }), "translations.en.label", "en");
  invalid(() => v.parseNavSave({ area: "header", links: [{ id: ID, link_kind: "internal", target: "about", translations: {} }, { id: ID, link_kind: "internal", target: "contact", translations: {} }] }), "links");
});

// ---- handlers with a fake admin client --------------------------------------------------------------------------------

function fakeAdmin({ rpc = {}, section = { page: "home", section: "hero" } } = {}) {
  const calls = [];
  return {
    calls,
    rpc(fn, args) {
      calls.push([fn, args]);
      const answer = rpc[fn];
      return Promise.resolve(typeof answer === "function" ? answer(args) : { data: answer ?? null, error: null });
    },
    from(table) {
      calls.push(["from", table]);
      const q = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve({ data: section, error: null }) };
      return q;
    },
  };
}
const owner = (admin) => ({ profile: { id: ID }, admin });

test("postPages reads the section, checks it, and calls ops_save_page_section with the body", async () => {
  const admin = fakeAdmin({ rpc: { ops_save_page_section: { id: ID, affects_site: true } } });
  const body = { id: ID, video_url: "https://a.example/v.mp4", translations: { en: { headline: "X" } } };
  const res = await h.postPages({ owner: owner(admin), body });
  assert.deepEqual(res.body, { ok: true, id: ID, affects_site: true });
  assert.deepEqual(admin.calls.at(-1), ["ops_save_page_section", { p: body }]);
  await assert.rejects(h.postPages({ owner: owner(fakeAdmin()), body: { id: ID, translations: { en: { heading: "X" } } } }));
  const gone = await h.postPages({ owner: owner(fakeAdmin({ section: null })), body: { id: ID } });
  assert.equal(gone.status, 404);
});

test("getPages: the five pages with shown / total; ?page= calls ops_list_page; ?id= calls ops_get", async () => {
  const list = [
    { page: "home", is_shown: true },
    { page: "home", is_shown: false },
    { page: "about", is_shown: true },
  ];
  const admin = fakeAdmin({ rpc: { ops_list: list, ops_list_page: { page: "about", sections: [] }, ops_get: { id: ID } } });
  const all = await h.getPages({ owner: owner(admin), url: new URL("https://x/api/ops/pages") });
  assert.deepEqual(all.body.items[0], { page: "home", shown: 1, total: 2 });
  assert.equal(all.body.items.length, 5);
  await h.getPages({ owner: owner(admin), url: new URL("https://x/api/ops/pages?page=about") });
  assert.deepEqual(admin.calls.at(-1), ["ops_list_page", { p_page: "about" }]);
  await h.getPages({ owner: owner(admin), url: new URL(`https://x/api/ops/pages?id=${ID}`) });
  assert.deepEqual(admin.calls.at(-1), ["ops_get", { p_entity: "page_section", p_id: ID }]);
});

test("postPageItems: save without the action key, delete and reorder through ops_delete / ops_reorder", async () => {
  const admin = fakeAdmin({ rpc: { ops_save_page_item: { id: ID2 } } });
  const saved = await h.postPageItems({ owner: owner(admin), body: { action: "save", id: ID2, is_shown: false } });
  assert.deepEqual(admin.calls.at(-1), ["ops_save_page_item", { p: { id: ID2, is_shown: false } }]);
  assert.equal(saved.body.affects_site, true);
  await h.postPageItems({ owner: owner(admin), body: { action: "delete", id: ID2 } });
  assert.deepEqual(admin.calls.at(-1), ["ops_delete", { p_entity: "page_item", p_id: ID2 }]);
  await h.postPageItems({ owner: owner(admin), body: { action: "reorder", section_id: ID, ids: [ID2, ID] } });
  assert.deepEqual(admin.calls.at(-1), ["ops_reorder", { p_entity: "page_item", p_ids: [ID2, ID] }]);
});

test("postNav calls ops_save_nav(p_area, p_links); getNav groups links and offers every target with its availability", async () => {
  const admin = fakeAdmin({
    rpc: {
      ops_save_nav: { area: "footer", ids: [ID], affects_site: true },
      ops_list: (args) => ({
        data: {
          nav_link: [{ id: ID, area: "header" }, { id: ID2, area: "footer" }],
          legal_page: [{ kind: "privacy", is_published: true, translation_state: { en: "published", ar: "published", es: "published" } }],
          journey_tier: [{ slug: "the-explorer", name_en: "The Explorer", is_published: true }],
        }[args.p_entity],
        error: null,
      }),
    },
  });
  const links = [{ link_kind: "internal", target: "about", is_shown: true, translations: label("About") }];
  const res = await h.postNav({ owner: owner(admin), body: { area: "footer", links } });
  assert.deepEqual(admin.calls.at(-1), ["ops_save_nav", { p_area: "footer", p_links: links }]);
  assert.deepEqual(res.body, { ok: true, area: "footer", ids: [ID], affects_site: true });
  const got = await h.getNav({ owner: owner(admin), url: new URL("https://x/api/ops/nav") });
  assert.equal(got.body.header.length, 1);
  assert.equal(got.body.footer.length, 1);
  const byKey = Object.fromEntries(got.body.targets.map((t) => [t.key, t]));
  assert.equal(byKey.about.available, true);
  assert.equal(byKey["list-with-us"].available, false);
  assert.equal(byKey["legal-privacy"].available, false, "no /legal route on the site yet");
  assert.equal(byKey["journey:the-explorer"].name, "The Explorer");
});

test("the three route files are in the ops route shape (tests/ops-route.test.mjs source guard)", () => {
  for (const [file, methods] of [["pages", ["GET", "POST"]], ["page-items", ["POST"]], ["nav", ["GET", "POST"]]]) {
    const src = readFileSync(`app/api/ops/${file}/route.ts`, "utf8");
    assert.match(src, /^export const dynamic = "force-dynamic";$/m);
    for (const m of methods) assert.match(src, new RegExp(`^export const ${m} = ops${m === "GET" ? "Get" : "Post"}\\(`, "m"));
  }
  assert.match(readFileSync("lib/ops/site-pages-handlers.ts", "utf8"), /ops_save_nav/);
});
