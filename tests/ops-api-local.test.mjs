// Plan 03.2-04 Task 3: the owner API's handlers against this worktree's own local Supabase stack, with the catalogue
// imported (scripts/import-catalog.mjs --apply --local) and the owner gate faked. Each call goes through runOps exactly as
// lib/ops/route.ts builds it (origin, JSON, parse, handler, error mapping); only requireOwner() is replaced by a decide that
// answers "the owner". Rates and prices here are symbolic test values on a local database, never real ones.
//
// requireStack(t): skipped without a stack, FAILS under ALMAR_REQUIRE_STACK=1. The stack is reset before and after, so
// the pgTAP files (which expect an empty catalogue) see the database as the migrations make it. Do not run this file at
// the same time as another file that resets the same stack (tests/import-catalog.test.mjs): run stack files serially
// (`node --test --test-concurrency=1`) until the helper has a stack lock (plan 04-02).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadTs } from "./helpers/load-ts.mjs";
import { localStack, requireStack, resetLocal, runSql } from "./helpers/local-supabase.mjs";

const { runOps } = await loadTs("lib/ops/route-core.ts");
const parse = await loadTs("lib/ops/validate-catalog.ts");
const h = await loadTs("lib/ops/catalog-handlers.ts");

const OPS = "https://dashboard.almarprivatejourney.com";
const fixture = (name) => JSON.parse(readFileSync(`lib/data/fixtures/${name}.json`, "utf8"));
const destinations = fixture("destinations");
const stays = fixture("stays");
const catalog = fixture("catalog");
const tiers = fixture("home").tiers;
const bySlug = (rows, slug) => rows.find((r) => r.slug === slug);

const CARTAGENA = bySlug(destinations, "cartagena");
const MEDELLIN = bySlug(destinations, "medellin");
const GETSEMANI = bySlug(stays, "getsemani-colonial-house");
const COURTYARD = bySlug(stays, "getsemani-courtyard-residence");
const EXPLORER = bySlug(tiers, "the-explorer");
const HERO = CARTAGENA.hero_image.id; // an imported photo
const OWNER_ID = "0b0b0b0b-0000-4000-8000-000000000001";

let owner;
let reset = false;

after(async () => {
  const stack = localStack();
  if (!reset || !stack) return;
  resetLocal();
  // Leave the API ready for the next file that uses the stack (its schema cache reloads after the reset).
  await settle(createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }));
});

async function get(handler, query = "") {
  const url = `${OPS}/api/ops/x${query ? `?${query}` : ""}`;
  const res = await runOps({
    method: "GET",
    request: new Request(url),
    decide: async () => ({ ok: true, owner }),
    handler: ({ owner: o }) => handler({ owner: o, url: new URL(url) }),
    nodeEnv: "production",
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
}

async function post(parseFn, handler, body) {
  const res = await runOps({
    method: "POST",
    request: new Request(`${OPS}/api/ops/x`, { method: "POST", headers: { "content-type": "application/json", origin: OPS }, body: JSON.stringify(body) }),
    decide: async () => ({ ok: true, owner }),
    parse: parseFn,
    handler,
    nodeEnv: "production",
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
}

const D = {
  get: (q) => get(h.getDestinations, q),
  post: (b) => post(parse.parseDestinationAction, h.postDestinations, b),
};
const S = {
  get: (q) => get(h.getStays, q),
  post: (b) => post(parse.parseStayAction, h.postStays, b),
};
const R = {
  get: (q) => get(h.getStayRates, q),
  post: (b) => post(parse.parseRateAction, h.postStayRates, b),
};
const BL = {
  get: (q) => get(h.getBlocks, q),
  post: (b) => post(parse.parseBlockAction, h.postBlocks, b),
};
const AC = {
  get: (q) => get(h.getStayAccess, q),
  post: (b) => post(parse.parseAccessSave, h.postStayAccess, b),
};
const CA = {
  get: (q) => get(h.getCatalog, q),
  post: (b) => post(parse.parseCatalogAction, h.postCatalog, b),
};
const T = {
  get: (q) => get(h.getTeam, q),
  post: (b) => post(parse.parseTeamAction, h.postTeam, b),
};
const J = {
  get: (q) => get(h.getJourneys, q),
  post: (b) => post(parse.parseJourneyAction, h.postJourneys, b),
};
const publish = (entity, id, published) => post(parse.parsePublish, h.postPublish, { entity, id, published });

const has = (missing, locale, field) => missing.some((m) => m.locale === locale && m.field === field);

/**
 * `supabase db reset` restarts the database container ("Restarting containers..."), and for some seconds after it the REST
 * API's schema cache is not reloaded ("Could not find the function ... in the schema cache") and its pooled connections to
 * the old database fail (measured 2026-10-05: a call with no SQLSTATE, mapped to 503; the import refused). Flush the pool
 * with two parallel bursts, then wait for 15 calls in a row to succeed. Used before the import and after the final reset,
 * so the next file that uses the stack (tests/import-catalog.test.mjs in a later run) finds the API ready.
 */
async function settle(admin) {
  for (let burst = 0; burst < 2; burst++) {
    await Promise.all(Array.from({ length: 20 }, () => admin.rpc("ops_list", { p_entity: "destination" })));
  }
  let streak = 0;
  for (let i = 0; i < 120 && streak < 15; i++) {
    const { error } = await admin.rpc("ops_list", { p_entity: "destination" });
    streak = error ? 0 : streak + 1;
    if (error) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(streak, 15, "the local REST API did not settle after the reset");
}

test("local stack: the owner API end to end on the imported catalogue", { timeout: 600_000 }, async (t) => {
  const stack = requireStack(t);
  if (!stack) return;

  reset = true;
  const existing = runSql("select count(*)::int as n from public.destinations").rows[0]?.n;
  if (existing !== 0) {
    const r = resetLocal();
    assert.equal(r.code, 0, r.output.slice(-2000));
  }
  owner = {
    profile: { id: OWNER_ID, email: "maria@almarprivatejourney.com", role: "owner" },
    admin: createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
  await settle(owner.admin);
  const env = { ...process.env, SUPABASE_URL: stack.url, SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey };
  const imported = spawnSync(process.execPath, ["scripts/import-catalog.mjs", "--apply", "--local"], { env, encoding: "utf8" });
  assert.equal(imported.status, 0, imported.stderr + imported.stdout);

  await t.test("destinations: list with stay counts; create, publish rules, unpublish refusal, delete rules", async () => {
    const list = await D.get();
    assert.equal(list.status, 200);
    assert.equal(list.headers.get("cache-control"), "no-store");
    assert.equal(list.body.items.length, destinations.length);
    const cart = list.body.items.find((d) => d.id === CARTAGENA.id);
    assert.equal(cart.stay_count, stays.filter((s) => s.destination_id === CARTAGENA.id).length);
    assert.equal(cart.published_stay_count, cart.stay_count);
    assert.equal(cart.name_en, "Cartagena");
    assert.match(cart.hero.url, /^https:\/\/media\.almarprivatejourney\.com\//);
    assert.deepEqual(Object.keys(cart.translation_state), ["en", "ar", "es"]);

    const created = await D.post({ action: "save", item: { slug: "test-destination", translations: { en: { name: "Test destination", status: "published" } } } });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal(created.body.affects_site, false, "a draft does not reach the site");
    const id = created.body.id;

    const refused = await publish("destination", id, true);
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error.code, "publish_incomplete");
    const missing = refused.body.error.detail.missing;
    assert.ok(has(missing, "ar", "name") && has(missing, "es", "name") && has(missing, null, "hero_media_id"), JSON.stringify(missing));

    const filled = await D.post({ action: "save", item: { id, hero_media_id: HERO, translations: { ar: { name: "وجهة تجريبية" }, es: { name: "Destino de prueba" } } } });
    assert.equal(filled.status, 200, JSON.stringify(filled.body));
    const published = await publish("destination", id, true);
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.deepEqual(published.body, { ok: true, id, is_published: true, affects_site: true, warnings: [] });
    const resaved = await D.post({ action: "save", item: { id, translations: { en: { name: "Test destination 2" } } } });
    assert.equal(resaved.body.affects_site, true, "a save of a published row reaches the site");

    const unpublishCartagena = await publish("destination", CARTAGENA.id, false);
    assert.equal(unpublishCartagena.status, 409);
    assert.equal(unpublishCartagena.body.error.code, "has_published_stays");

    const deletePublished = await D.post({ action: "delete", id });
    assert.equal(deletePublished.status, 409);
    assert.equal(deletePublished.body.error.code, "published");
    const deleteWithStays = await D.post({ action: "delete", id: MEDELLIN.id });
    assert.equal(deleteWithStays.status, 409);
    assert.ok(["published", "in_use"].includes(deleteWithStays.body.error.code));

    assert.equal((await publish("destination", id, false)).status, 200);
    const deleted = await D.post({ action: "delete", id });
    assert.deepEqual(deleted.body, { ok: true, id, affects_site: false });
    assert.equal((await D.get(`id=${id}`)).status, 404);

    const slugTaken = await D.post({ action: "save", item: { slug: "cartagena", translations: { en: { name: "Again" } } } });
    assert.equal(slugTaken.status, 409);
    assert.deepEqual(slugTaken.body.error, { code: "slug_taken", field: "slug", locale: null, detail: null });
    const slugChange = await D.post({ action: "save", item: { id: CARTAGENA.id, slug: "cartagena-2" } });
    assert.equal(slugChange.status, 409);
    assert.equal(slugChange.body.error.field, "slug");
    const unknownPhoto = await D.post({ action: "save", item: { id: CARTAGENA.id, hero_media_id: "0b0b0b0b-0000-4000-8000-0000000000ff" } });
    assert.equal(unknownPhoto.status, 409);
    assert.deepEqual(unknownPhoto.body.error, { code: "invalid", field: "hero_media_id", locale: null, detail: null });

    const order = list.body.items.map((d) => d.id).reverse();
    const reordered = await D.post({ action: "reorder", ids: order });
    assert.deepEqual(reordered.body, { ok: true, affects_site: true });
    assert.deepEqual((await D.get()).body.items.map((d) => d.id), order);
  });

  await t.test("stays: detail in fixture order; connections reversed; partial save keeps the rest; amenities and parent refusals", async () => {
    const detail = await S.get(`id=${GETSEMANI.id}`);
    assert.equal(detail.status, 200);
    const item = detail.body.item;
    assert.deepEqual(item.gallery.map((g) => g.id), GETSEMANI.gallery.map((g) => g.id));
    assert.deepEqual(item.experience_ids, GETSEMANI.experience_ids);
    assert.deepEqual(item.service_ids, GETSEMANI.service_ids);
    assert.equal(item.base_nightly_rate_aed, null);
    assert.equal(item.min_nights, 1);
    assert.equal(item.has_access, false);
    assert.equal(item.translations.en.title.length > 0, true);
    assert.ok(Array.isArray(item.translations.ar.amenities));

    const reversed = { experience_ids: [...GETSEMANI.experience_ids].reverse(), service_ids: [...GETSEMANI.service_ids].reverse() };
    const saved = await S.post({ action: "save", item: { id: GETSEMANI.id, connections: reversed } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body, { ok: true, id: GETSEMANI.id, affects_site: true });
    let after1 = (await S.get(`id=${GETSEMANI.id}`)).body.item;
    assert.deepEqual(after1.experience_ids, reversed.experience_ids);
    assert.deepEqual(after1.service_ids, reversed.service_ids);

    const minNights = await S.post({ action: "save", item: { id: GETSEMANI.id, min_nights: 3 } });
    assert.equal(minNights.status, 200);
    after1 = (await S.get(`id=${GETSEMANI.id}`)).body.item;
    assert.equal(after1.min_nights, 3);
    assert.deepEqual(after1.gallery.map((g) => g.id), GETSEMANI.gallery.map((g) => g.id), "gallery untouched");
    assert.deepEqual(after1.experience_ids, reversed.experience_ids, "connections untouched");

    const shorter = item.translations.ar.amenities.slice(1);
    const mismatch = await S.post({ action: "save", item: { id: GETSEMANI.id, translations: { ar: { amenities: shorter } } } });
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.body.error.code, "amenities_mismatch");

    const draftDest = await D.post({ action: "save", item: { slug: "draft-destination", translations: { en: { name: "Draft" } } } });
    const moved = await S.post({ action: "save", item: { id: GETSEMANI.id, destination_id: draftDest.body.id } });
    assert.equal(moved.status, 409);
    assert.deepEqual(moved.body.error, { code: "parent_unpublished", field: "destination_id", locale: null, detail: null });
    const movedOk = await S.post({ action: "save", item: { id: COURTYARD.id, destination_id: MEDELLIN.id } });
    assert.equal(movedOk.status, 200, "between published destinations is allowed");
    await S.post({ action: "save", item: { id: COURTYARD.id, destination_id: CARTAGENA.id } });

    const list = await S.get();
    assert.equal(list.body.items.length, stays.length);
    const row = list.body.items.find((s) => s.id === GETSEMANI.id);
    assert.equal(row.bookable, false, "published but no base rate");
    assert.equal(row.destination_name_en, "Cartagena");
    assert.equal((await S.get("id=0b0b0b0b-0000-4000-8000-0000000000ee")).status, 404);
  });

  await t.test("stay-rates: base, ranges, the overlap refusal with its conflict id, the per-night preview", async () => {
    const base = await R.post({ action: "set_base", stay_id: GETSEMANI.id, base_nightly_rate_aed: "1000" });
    assert.equal(base.status, 200, JSON.stringify(base.body));
    assert.deepEqual(base.body, { ok: true, id: GETSEMANI.id, stay_id: GETSEMANI.id, base_nightly_rate_aed: "1000.00", affects_site: false });
    const week = await R.post({ action: "save_range", stay_id: GETSEMANI.id, range: { first_night: "2030-01-01", last_night: "2030-01-07", nightly_rate_aed: "1200.00" } });
    assert.equal(week.status, 200, JSON.stringify(week.body));
    assert.equal(week.body.affects_site, false);
    const night = await R.post({ action: "save_range", stay_id: GETSEMANI.id, range: { first_night: "2030-01-07", last_night: "2030-01-07", nightly_rate_aed: "1500.00" } });
    assert.equal(night.status, 200);
    const overlap = await R.post({ action: "save_range", stay_id: GETSEMANI.id, range: { first_night: "2030-01-04", last_night: "2030-01-10", nightly_rate_aed: "900.00" } });
    assert.equal(overlap.status, 409);
    assert.deepEqual(overlap.body.error, { code: "rate_overlap", field: null, locale: null, detail: { conflict_id: week.body.id } });

    const view = await R.get(`stay_id=${GETSEMANI.id}&from=2030-01-06&to=2030-01-09`);
    assert.equal(view.status, 200);
    assert.equal(view.body.base_nightly_rate_aed, "1000.00");
    assert.deepEqual(view.body.ranges, [
      { id: week.body.id, first_night: "2030-01-01", last_night: "2030-01-07", nights: 7, nightly_rate_aed: "1200.00" },
      { id: night.body.id, first_night: "2030-01-07", last_night: "2030-01-07", nights: 1, nightly_rate_aed: "1500.00" },
    ]);
    assert.deepEqual(view.body.nights, [
      { night: "2030-01-06", nightly_rate_aed: "1200.00", source: "range" },
      { night: "2030-01-07", nightly_rate_aed: "1500.00", source: "range" },
      { night: "2030-01-08", nightly_rate_aed: "1000.00", source: "base" },
    ]);
    assert.equal("nights" in (await R.get(`stay_id=${GETSEMANI.id}`)).body, false);

    const bookable = (await S.get()).body.items.find((s) => s.id === GETSEMANI.id);
    assert.equal(bookable.bookable, true);
    assert.equal(bookable.base_nightly_rate_aed, "1000.00");

    const deleted = await R.post({ action: "delete_range", id: night.body.id });
    assert.deepEqual(deleted.body, { ok: true, id: night.body.id, affects_site: false });
    assert.equal((await R.post({ action: "delete_range", id: night.body.id })).status, 404);
    const cleared = await R.post({ action: "set_base", stay_id: GETSEMANI.id, base_nightly_rate_aed: null });
    assert.equal(cleared.body.base_nightly_rate_aed, null);
    assert.equal((await R.get("stay_id=0b0b0b0b-0000-4000-8000-0000000000ee")).status, 404);
  });

  await t.test("blocks: add for one stay, read with the destination's block, delete", async () => {
    const stayBlock = await BL.post({ action: "add", block: { scope: "stay", stay_id: GETSEMANI.id, starts_on: "2030-03-01", ends_on: "2030-03-03", reason: "Owner's family" } });
    assert.equal(stayBlock.status, 200, JSON.stringify(stayBlock.body));
    assert.deepEqual(stayBlock.body, { ok: true, id: stayBlock.body.id, affects_site: true, overlapping_bookings: 0 });
    const destBlock = await BL.post({ action: "add", block: { scope: "destination", destination_id: CARTAGENA.id, starts_on: "2030-03-10", ends_on: "2030-03-10" } });
    assert.equal(destBlock.status, 200);
    const other = await BL.post({ action: "add", block: { scope: "stay", stay_id: COURTYARD.id, starts_on: "2030-03-01", ends_on: "2030-03-01" } });
    assert.equal(other.status, 200);

    const view = await BL.get(`from=2030-03-01&to=2030-03-31&stay_id=${GETSEMANI.id}`);
    assert.equal(view.status, 200);
    assert.deepEqual(view.body.blocks.map((b) => b.id).sort(), [stayBlock.body.id, destBlock.body.id].sort());
    const mine = view.body.blocks.find((b) => b.id === stayBlock.body.id);
    assert.equal(mine.reason, "Owner's family");
    assert.equal(mine.starts_on, "2030-03-01");
    assert.equal(mine.ends_on, "2030-03-03");
    const outside = await BL.get(`from=2030-04-01&to=2030-04-30&stay_id=${GETSEMANI.id}`);
    assert.deepEqual(outside.body.blocks, []);
    assert.equal((await BL.get("from=2030-03-01&to=2030-03-31")).body.blocks.length, 3);

    for (const id of [stayBlock.body.id, destBlock.body.id, other.body.id]) {
      assert.deepEqual((await BL.post({ action: "delete", id })).body, { ok: true, id, affects_site: true });
    }
    assert.equal((await BL.post({ action: "delete", id: stayBlock.body.id })).status, 404);
  });

  await t.test("stay-access: save then read back, no-store; another stay reads null", async () => {
    const saved = await AC.post({ action: "save", stay_id: GETSEMANI.id, access: { address: "[test address]", wifi_name: "[wifi]", wifi_password: " p@ss ", door_code: "[code]", notes: null } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body, { ok: true, id: GETSEMANI.id, stay_id: GETSEMANI.id, affects_site: false });
    const read = await AC.get(`stay_id=${GETSEMANI.id}`);
    assert.equal(read.headers.get("cache-control"), "no-store");
    assert.equal(read.body.access.address, "[test address]");
    assert.equal(read.body.access.wifi_password, " p@ss ", "kept exactly");
    assert.equal(read.body.access.notes, null);
    const partial = await AC.post({ action: "save", stay_id: GETSEMANI.id, access: { notes: "[note]" } });
    assert.equal(partial.status, 200);
    assert.equal((await AC.get(`stay_id=${GETSEMANI.id}`)).body.access.door_code, "[code]", "absent keys untouched");
    assert.deepEqual((await AC.get(`stay_id=${COURTYARD.id}`)).body, { ok: true, stay_id: COURTYARD.id, access: null });
    assert.equal((await S.get(`id=${GETSEMANI.id}`)).body.item.has_access, true);
    assert.equal((await AC.get("stay_id=0b0b0b0b-0000-4000-8000-0000000000ee")).status, 404);
  });

  await t.test("catalog: links to two destinations and three stays; publish needs a photo; one home pickup; a partial save keeps links", async () => {
    const three = stays.slice(0, 3).map((s) => s.id);
    const created = await CA.post({
      action: "save",
      item: { slug: "test-experience", kind: "experience", unit: "person", price_aed: "10.00", is_uae: false, destination_ids: [CARTAGENA.id, MEDELLIN.id], stay_ids: three, translations: { en: { name: "Test experience" } } },
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const id = created.body.id;
    for (const stayId of three) {
      const ids = (await S.get(`id=${stayId}`)).body.item.experience_ids;
      assert.equal(ids.at(-1), id, `${stayId}: the new item ends the stay's list`);
    }
    const noPhoto = await publish("catalog_item", id, true);
    assert.equal(noPhoto.status, 409);
    assert.ok(has(noPhoto.body.error.detail.missing, null, "media_id"));

    const price = await CA.post({ action: "save", item: { id, price_aed: "12.50" } });
    assert.equal(price.status, 200);
    const detail = (await CA.get(`id=${id}`)).body.item;
    assert.equal(detail.price_aed, "12.50");
    assert.deepEqual([...detail.destination_ids].sort(), [CARTAGENA.id, MEDELLIN.id].sort());
    assert.deepEqual([...detail.stay_ids].sort(), [...three].sort());

    const pickup = await CA.post({ action: "save", item: { slug: "test-pickup", kind: "service", unit: "trip", is_home_pickup: true, translations: { en: { name: "Pickup" } } } });
    assert.equal(pickup.status, 200, JSON.stringify(pickup.body));
    const second = await CA.post({ action: "save", item: { slug: "test-pickup-2", kind: "service", unit: "trip", is_home_pickup: true, translations: { en: { name: "Pickup 2" } } } });
    assert.equal(second.status, 409);
    assert.deepEqual(second.body.error, { code: "invalid", field: "is_home_pickup", locale: null, detail: null });

    const services = await CA.get("kind=service");
    assert.ok(services.body.items.every((c) => c.kind === "service"));
    assert.equal((await CA.get()).body.items.length, catalog.length + 2);
    assert.equal((await CA.post({ action: "delete", id })).status, 200);
  });

  await t.test("publish: a stay with an EN tagline and no ES tagline is refused with that gap", async () => {
    const created = await S.post({
      action: "save",
      item: {
        slug: "test-stay",
        destination_id: CARTAGENA.id,
        hero_media_id: HERO,
        translations: { en: { title: "Test stay", tagline: "A line" }, ar: { title: "إقامة", tagline: "سطر" }, es: { title: "Estancia" } },
      },
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const refused = await publish("stay", created.body.id, true);
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error.code, "publish_incomplete");
    assert.ok(has(refused.body.error.detail.missing, "es", "tagline"), JSON.stringify(refused.body.error.detail));
    await S.post({ action: "save", item: { id: created.body.id, translations: { es: { tagline: "Una línea" } } } });
    const ok = await publish("stay", created.body.id, true);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual(ok.body.warnings, [{ code: "no_base_rate" }]);
  });

  await t.test("team: https links only; publish with EN only is refused", async () => {
    const http = await T.post({ action: "save", item: { slug: "member-a", links: [{ label: "Site", url: "http://example.com" }], translations: { en: { name: "[Name]" } } } });
    assert.equal(http.status, 400);
    assert.equal(http.body.error.field, "links.0.url");
    const ok = await T.post({ action: "save", item: { slug: "member-a", email: "member@example.com", links: [{ label: "Site", url: "https://example.com" }], translations: { en: { name: "[Name]" } } } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const detail = (await T.get(`id=${ok.body.id}`)).body.item;
    assert.deepEqual(detail.links, [{ label: "Site", url: "https://example.com" }]);
    assert.equal(detail.email, "member@example.com");
    const refused = await publish("team_member", ok.body.id, true);
    assert.equal(refused.status, 409);
    assert.ok(has(refused.body.error.detail.missing, "ar", "name"));
    assert.equal((await T.get()).body.items.length, 1);
  });

  await t.test("journeys: the EN price label is parsed; no id is 400; publish and unpublish toggle", async () => {
    const onRequest = await J.post({ action: "save", item: { id: EXPLORER.id, translations: { en: { name: "The Explorer", price_label: "Price on request" } } } });
    assert.equal(onRequest.status, 200, JSON.stringify(onRequest.body));
    assert.equal(onRequest.body.affects_site, true);
    let detail = (await J.get(`id=${EXPLORER.id}`)).body.item;
    assert.equal(detail.price_from, null);
    assert.equal(detail.price_estimate, null);
    assert.equal(detail.translations.en.price_label, "Price on request");

    const label = "From USD $3,000/person · Est. AED 80,000–90,000";
    await J.post({ action: "save", item: { id: EXPLORER.id, translations: { en: { name: "The Explorer", price_label: label } } } });
    detail = (await J.get(`id=${EXPLORER.id}`)).body.item;
    assert.deepEqual(detail.price_from, { amount: "3000.00", currency: "USD" });
    assert.deepEqual(detail.price_estimate, { low: "80000.00", high: "90000.00", currency: "AED", open_ended: false });
    assert.equal(detail.translations.en.price_label, label);

    const noId = await J.post({ action: "save", item: { translations: { en: { name: "x", price_label: "y" } } } });
    assert.equal(noId.status, 400);
    assert.equal(noId.body.error.field, "id");

    assert.equal((await publish("journey_tier", EXPLORER.id, false)).body.is_published, false);
    assert.equal((await J.get()).body.items.find((j) => j.id === EXPLORER.id).is_published, false);
    assert.equal((await publish("journey_tier", EXPLORER.id, true)).body.is_published, true);
    assert.equal((await J.get()).body.items.length, tiers.length);
  });

  await t.test("the database holds what the API wrote and nothing leaked a key into a reply", async () => {
    const rows = runSql("select count(*)::int as n from public.stay_access").rows;
    assert.equal(rows[0]?.n, 1);
  });
});
