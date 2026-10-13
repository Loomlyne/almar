// Plan 02-06: POST/GET /api/ops/settings handlers with a fake admin client (no Supabase). The route itself is the
// wrapper's (owner first, Origin, JSON): tests/ops-route.test.mjs covers that order for every route.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const v = await loadTs("lib/settings/validate.ts");
const h = await loadTs("lib/settings/handlers.ts");

const LOGO = "11111111-1111-4111-8111-111111111111";
const SAVE = {
  colors: { teal: "#1f3b40", charcoal: "#262626", gold: "#d4ba8a", ivory: "#fffaf0", white: "#ffffff" },
  title_face: "Questa",
  body_face: "Lato",
  vat_percent: "5.00",
  deposit_percent: "30.00",
  maintenance: false,
  logo_media_id: null,
  locale: "en",
  currency: "AED",
};

function fakeAdmin({ row = { vat_percent: 5, deposit_percent: 30, maintenance: false, title_face: "Questa", body_face: "Lato", logo_media_id: null }, media = {}, failOn = null } = {}) {
  const writes = [];
  const admin = {
    from(table) {
      const q = { table, filters: [] };
      const chain = {
        select() { return chain; },
        eq(column, value) { q.filters.push([column, value]); return chain; },
        update(values) { q.update = values; return chain; },
        async maybeSingle() {
          if (failOn === `read:${table}`) return { data: null, error: { code: "XX000", message: "boom" } };
          if (table === "site_settings") return { data: row, error: null };
          if (table === "media") return { data: media[q.filters[0][1]] ?? null, error: null };
          return { data: null, error: null };
        },
        then(resolve) {
          if (failOn === `write:${table}`) return resolve({ error: { code: "XX000", message: "boom" } });
          writes.push({ table, values: q.update, filters: q.filters });
          return resolve({ error: null });
        },
      };
      return chain;
    },
  };
  return { admin, writes };
}

const owner = (admin) => ({ profile: { id: "owner-id", locale: "en", currency: "AED" }, admin });

test("parseSettingsSave: the whole form, exact values; percents two places, empty allowed, 0 allowed", () => {
  const parsed = v.parseSettingsSave({ ...SAVE, colors: { ...SAVE.colors, teal: "#1F3B40" }, vat_percent: "5", deposit_percent: "" });
  assert.equal(parsed.colors.teal, "#1f3b40");
  assert.equal(parsed.vat_percent, "5.00");
  assert.equal(parsed.deposit_percent, null);
  assert.equal(v.parseSettingsSave({ ...SAVE, vat_percent: "0" }).vat_percent, "0.00");
  assert.equal(v.parseSettingsSave({ ...SAVE, vat_percent: null }).vat_percent, null);
  const bad = [
    { ...SAVE, vat_percent: "5.125" }, { ...SAVE, vat_percent: "5,00" }, { ...SAVE, vat_percent: "101" }, { ...SAVE, vat_percent: "-1" },
    { ...SAVE, vat_percent: 5 }, { ...SAVE, deposit_percent: "٣٠" }, { ...SAVE, colors: { ...SAVE.colors, gold: "gold" } },
    { ...SAVE, colors: { ...SAVE.colors, extra: "#000000" } }, { ...SAVE, title_face: "Arial" }, { ...SAVE, body_face: "Questa" },
    { ...SAVE, maintenance: "true" }, { ...SAVE, logo_media_id: "x" }, { ...SAVE, locale: "fr" }, { ...SAVE, currency: "GBP" },
    { ...SAVE, radius: 4 }, { ...SAVE, fx_rate: "3.67" }, [], null,
  ];
  for (const body of bad) assert.throws(() => v.parseSettingsSave(body), (e) => e.name === "OpsInvalid", JSON.stringify(body)?.slice(0, 80));
  assert.throws(() => v.parseSettingsSave({ ...SAVE, vat_percent: "5.125" }), (e) => e.field === "vat_percent");
});

test("postSettings: writes the singleton and her language/currency; tokens stored as null; no rebuild when only VAT changes", async () => {
  const { admin, writes } = fakeAdmin();
  let rebuilds = 0;
  const out = await h.postSettings({ owner: owner(admin), body: { ...SAVE, vat_percent: "7.50", locale: "ar", currency: "USD" }, requestRebuild: async () => { rebuilds += 1; } });
  assert.deepEqual(out.body, { ok: true, affects_site: false });
  assert.equal(rebuilds, 0);
  const settings = writes.find((w) => w.table === "site_settings");
  assert.deepEqual(settings.filters, [["id", 1]]);
  assert.equal(settings.values.teal, null);
  assert.equal(settings.values.vat_percent, "7.50");
  assert.equal("radius" in settings.values, false);
  const profile = writes.find((w) => w.table === "profiles");
  assert.deepEqual(profile, { table: "profiles", values: { locale: "ar", currency: "USD" }, filters: [["id", "owner-id"]] });
});

test("postSettings: maintenance, a colour or the logo affects the site and asks for one rebuild", async () => {
  for (const body of [{ ...SAVE, maintenance: true }, { ...SAVE, colors: { ...SAVE.colors, teal: "#123456" } }]) {
    const { admin } = fakeAdmin();
    let rebuilds = 0;
    const out = await h.postSettings({ owner: owner(admin), body, requestRebuild: async () => { rebuilds += 1; } });
    assert.equal(out.body.affects_site, true);
    assert.equal(rebuilds, 1);
  }
  const { admin } = fakeAdmin({ media: { [LOGO]: { id: LOGO, key: "brand/l.png", width: 512, height: 512, bytes: 2048, content_type: "image/png" } } });
  const out = await h.postSettings({ owner: owner(admin), body: { ...SAVE, logo_media_id: LOGO }, requestRebuild: async () => {} });
  assert.equal(out.body.affects_site, true);
});

test("postSettings: a failing contrast is refused on the server, charged to the changed colour; nothing written", async () => {
  const { admin, writes } = fakeAdmin();
  await assert.rejects(
    h.postSettings({ owner: owner(admin), body: { ...SAVE, colors: { ...SAVE.colors, teal: "#9fb8bb" } }, requestRebuild: async () => {} }),
    (e) => e.name === "OpsInvalid" && e.field === "colors.teal",
  );
  assert.equal(writes.length, 0);
});

test("postSettings: a logo that is missing, too big or not PNG/JPEG/WebP is refused", async () => {
  const cases = {
    missing: null,
    big: { id: LOGO, key: "brand/l.png", bytes: 1024 * 1024 + 1, content_type: "image/png" },
    svg: { id: LOGO, key: "brand/l.png", bytes: 10, content_type: "image/svg+xml" },
  };
  for (const [name, row] of Object.entries(cases)) {
    const { admin, writes } = fakeAdmin({ media: row ? { [LOGO]: row } : {} });
    await assert.rejects(
      h.postSettings({ owner: owner(admin), body: { ...SAVE, logo_media_id: LOGO }, requestRebuild: async () => {} }),
      (e) => e.field === "logo_media_id",
      name,
    );
    assert.equal(writes.length, 0, name);
  }
});

test("postSettings / getSettings: a database error is handed back for the wrapper to map (503), never echoed", async () => {
  const { admin } = fakeAdmin({ failOn: "write:site_settings" });
  const out = await h.postSettings({ owner: owner(admin), body: SAVE, requestRebuild: async () => {} });
  assert.ok("dbError" in out);
  const read = await h.getSettings({ owner: owner(fakeAdmin({ failOn: "read:site_settings" }).admin), loadRates: async () => null });
  assert.ok("dbError" in read);
});

test("getSettings: the row's VAT and deposit, design-system colours for nulls, live FX or null, her preferences", async () => {
  const { admin } = fakeAdmin({ row: { teal: "#123456", vat_percent: "5.00", deposit_percent: 30, maintenance: true, logo_media_id: LOGO, title_face: "Questa", body_face: "Lato" },
    media: { [LOGO]: { id: LOGO, key: "brand/l.png", width: 512, height: 512, bytes: 10, content_type: "image/png" } } });
  const out = await h.getSettings({ owner: owner(admin), loadRates: async () => ({ aed: 3.6725, eur: 0.86, date: "2026-10-13" }) });
  const s = out.body.settings;
  assert.equal(s.colors.teal, "#123456");
  assert.equal(s.colors.gold, "#d4ba8a");
  assert.equal(s.vat_percent, "5.00");
  assert.equal(s.deposit_percent, "30.00");
  assert.equal(s.maintenance, true);
  assert.equal(s.logo.url, "https://media.almarprivatejourney.com/brand/l.png");
  assert.deepEqual(s.fx, { aed: 3.6725, eur: 0.86, date: "2026-10-13" });
  const none = await h.getSettings({ owner: owner(fakeAdmin({ row: {} }).admin), loadRates: async () => { throw new Error("feed down"); } });
  assert.equal(none.body.settings.fx, null);
  assert.equal(none.body.settings.vat_percent, null);
});
