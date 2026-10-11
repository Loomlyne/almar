// Plan 03.2-04 Task 2: one parse function per endpoint action (03.2-API-CONTRACT.md §5.1-5.9). Each returns the RPC
// payload already shaped (snake_case, money as strings, days as YYYY-MM-DD) or throws OpsInvalid on the first bad field.
// Save semantics (§1.2): a key not sent is not in the payload; null and [] are kept as values.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const p = await loadTs("lib/ops/validate-catalog.ts");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

function invalid(fn, field, locale) {
  assert.throws(fn, (e) => {
    assert.equal(e.name, "OpsInvalid", String(e));
    assert.equal(e.field, field);
    if (locale !== undefined) assert.equal(e.locale, locale);
    return true;
  });
}

// ---- 5.1 destinations -------------------------------------------------------------------------------------------------

test("destination: save with no id and an EN name creates; the payload holds only what was sent", () => {
  const out = p.parseDestinationAction({ action: "save", item: { id: null, slug: "bogota", translations: { en: { name: "Bogotá" } } } });
  assert.deepEqual(out, { action: "save", item: { slug: "bogota", translations: { en: { name: "Bogotá" } } } });
  const update = p.parseDestinationAction({ action: "save", item: { id: A, hero_media_id: null } });
  assert.deepEqual(update, { action: "save", item: { id: A, hero_media_id: null } });
});

test("destination: create needs a slug and the EN name; a bad action, an unknown key, a bad id are refused", () => {
  invalid(() => p.parseDestinationAction({ action: "save", item: { translations: { en: { name: "x" } } } }), "slug");
  invalid(() => p.parseDestinationAction({ action: "save", item: { slug: "x" } }), "translations.en", "en");
  invalid(() => p.parseDestinationAction({ action: "save", item: { slug: "x", translations: { en: { summary: "y" } } } }), "translations.en.name", "en");
  invalid(() => p.parseDestinationAction({ item: {} }), "action");
  invalid(() => p.parseDestinationAction({ action: "publish", id: A }), "action");
  invalid(() => p.parseDestinationAction(null), "body");
  invalid(() => p.parseDestinationAction([]), "body");
  invalid(() => p.parseDestinationAction({ action: "save", item: { id: A, is_published: true } }), "is_published");
  invalid(() => p.parseDestinationAction({ action: "save", item: { id: A, position: 2 } }), "position");
  invalid(() => p.parseDestinationAction({ action: "save", item: { id: "nope" } }), "id");
  invalid(() => p.parseDestinationAction({ action: "save" }), "item");
  invalid(() => p.parseDestinationAction({ action: "save", item: { id: A }, extra: 1 }), "extra");
});

test("destination: delete needs a uuid; reorder needs distinct uuids", () => {
  assert.deepEqual(p.parseDestinationAction({ action: "delete", id: A }), { action: "delete", id: A });
  invalid(() => p.parseDestinationAction({ action: "delete" }), "id");
  invalid(() => p.parseDestinationAction({ action: "delete", id: "x" }), "id");
  assert.deepEqual(p.parseDestinationAction({ action: "reorder", ids: [B, A] }), { action: "reorder", ids: [B, A] });
  invalid(() => p.parseDestinationAction({ action: "reorder", ids: [A, A] }), "ids");
  invalid(() => p.parseDestinationAction({ action: "reorder", ids: [] }), "ids");
});

// ---- 5.2 stays ---------------------------------------------------------------------------------------------------------

const NEW_STAY = { slug: "casa-x", destination_id: A, translations: { en: { title: "Casa X" } } };

test("stay: min_nights 0 is refused; omitted on create is 1; omitted on update stays absent", () => {
  invalid(() => p.parseStayAction({ action: "save", item: { ...NEW_STAY, min_nights: 0 } }), "min_nights");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, min_nights: null } }), "min_nights");
  assert.equal(p.parseStayAction({ action: "save", item: NEW_STAY }).item.min_nights, 1);
  assert.equal("min_nights" in p.parseStayAction({ action: "save", item: { id: A, max_guests: 4 } }).item, false);
  assert.equal(p.parseStayAction({ action: "save", item: { id: A, min_nights: 3 } }).item.min_nights, 3);
});

test("stay: create needs slug, destination and the EN title", () => {
  invalid(() => p.parseStayAction({ action: "save", item: { ...NEW_STAY, slug: undefined } }), "slug");
  invalid(() => p.parseStayAction({ action: "save", item: { slug: "casa-x", translations: NEW_STAY.translations } }), "destination_id");
  invalid(() => p.parseStayAction({ action: "save", item: { ...NEW_STAY, translations: { en: { tagline: "x" } } } }), "translations.en.title", "en");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, destination_id: null } }), "destination_id");
});

test("stay: the pets rule and its fee go together", () => {
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, pets_rule: "fee" } }), "pets_fee_aed");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, pets_rule: "fee", pets_fee_aed: null } }), "pets_fee_aed");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, pets_rule: "fee", pets_fee_aed: "0" } }), "pets_fee_aed");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, pets_rule: "allowed", pets_fee_aed: "150.00" } }), "pets_fee_aed");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, pets_fee_aed: "150.00" } }), "pets_rule");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, pets_rule: "maybe" } }), "pets_rule");
  assert.deepEqual(p.parseStayAction({ action: "save", item: { id: A, pets_rule: "fee", pets_fee_aed: "150" } }).item, { id: A, pets_rule: "fee", pets_fee_aed: "150.00" });
  // Any other rule clears a stored fee in the same save, so the database check always holds.
  assert.deepEqual(p.parseStayAction({ action: "save", item: { id: A, pets_rule: "allowed" } }).item, { id: A, pets_rule: "allowed", pets_fee_aed: null });
  assert.deepEqual(p.parseStayAction({ action: "save", item: { id: A, pets_rule: null, pets_fee_aed: null } }).item, { id: A, pets_rule: null, pets_fee_aed: null });
});

test("stay: infants_count is a boolean or null; counts are integers >= 0 or null", () => {
  assert.equal(p.parseStayAction({ action: "save", item: { id: A, infants_count: true } }).item.infants_count, true);
  assert.equal(p.parseStayAction({ action: "save", item: { id: A, infants_count: null } }).item.infants_count, null);
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, infants_count: "yes" } }), "infants_count");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, infants_count: 1 } }), "infants_count");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, max_guests: -1 } }), "max_guests");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, bedrooms: 2.5 } }), "bedrooms");
  assert.equal(p.parseStayAction({ action: "save", item: { id: A, bathrooms: null } }).item.bathrooms, null);
});

test("stay: gallery and connections are distinct uuids; the gallery holds at most 40", () => {
  const ids = Array.from({ length: 40 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  assert.equal(p.parseStayAction({ action: "save", item: { id: A, gallery_media_ids: ids } }).item.gallery_media_ids.length, 40);
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, gallery_media_ids: [...ids, A] } }), "gallery_media_ids");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, gallery_media_ids: [A, A] } }), "gallery_media_ids");
  assert.deepEqual(p.parseStayAction({ action: "save", item: { id: A, gallery_media_ids: [] } }).item.gallery_media_ids, []);
  const conn = p.parseStayAction({ action: "save", item: { id: A, connections: { experience_ids: [B, A], service_ids: [] } } }).item.connections;
  assert.deepEqual(conn, { experience_ids: [B, A], service_ids: [] });
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, connections: { experience_ids: [A, A] } } }), "connections.experience_ids");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, connections: { service_ids: ["x"] } } }), "connections.service_ids");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, connections: { stays: [] } } }), "connections.stays");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, connections: [] } }), "connections");
  // One list sent: the other kind is left alone (absent from the payload).
  assert.deepEqual(p.parseStayAction({ action: "save", item: { id: A, connections: { service_ids: [C] } } }).item.connections, { service_ids: [C] });
});

test("stay: AR or ES amenities of another length than EN in the same save are refused (an empty list is a draft in progress)", () => {
  const en = { title: "Casa", amenities: ["Pool", "Wifi"] };
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, translations: { en, ar: { amenities: ["مسبح"] } } } }), "translations.ar.amenities", "ar");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, translations: { en, es: { amenities: ["a", "b", "c"] } } } }), "translations.es.amenities", "es");
  assert.ok(p.parseStayAction({ action: "save", item: { id: A, translations: { en, ar: { amenities: ["مسبح", "واي فاي"] }, es: { amenities: [] } } } }));
});

test("stay: text lists and texts follow the caps; Arabic and Spanish are kept as typed", () => {
  const item = p.parseStayAction({
    action: "save",
    item: { id: A, translations: { ar: { title: " بيت جيتسيماني ", description: ["فقرة"] }, es: { title: "Casa colonial en Getsemaní", status: "draft" } } },
  }).item;
  assert.deepEqual(item.translations, { ar: { title: "بيت جيتسيماني", description: ["فقرة"] }, es: { title: "Casa colonial en Getsemaní", status: "draft" } });
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, translations: { en: { title: "x".repeat(161) } } } }), "translations.en.title", "en");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, translations: { en: { description: Array(41).fill("p") } } } }), "translations.en.description", "en");
  invalid(() => p.parseStayAction({ action: "save", item: { id: A, translations: { en: { beds_label: "x".repeat(121) } } } }), "translations.en.beds_label", "en");
  assert.ok(p.parseStayAction({ action: "save", item: { id: A, translations: { en: { price_note: "x".repeat(400) } } } }));
});

// ---- 5.3 rates ----------------------------------------------------------------------------------------------------------

test("rates: set_base needs a positive money string or null", () => {
  assert.deepEqual(p.parseRateAction({ action: "set_base", stay_id: A, base_nightly_rate_aed: "1000" }), { action: "set_base", stay_id: A, base_nightly_rate_aed: "1000.00" });
  assert.deepEqual(p.parseRateAction({ action: "set_base", stay_id: A, base_nightly_rate_aed: null }), { action: "set_base", stay_id: A, base_nightly_rate_aed: null });
  invalid(() => p.parseRateAction({ action: "set_base", stay_id: A, base_nightly_rate_aed: "0" }), "base_nightly_rate_aed");
  invalid(() => p.parseRateAction({ action: "set_base", stay_id: A, base_nightly_rate_aed: 1000 }), "base_nightly_rate_aed");
  invalid(() => p.parseRateAction({ action: "set_base", stay_id: A }), "base_nightly_rate_aed");
  invalid(() => p.parseRateAction({ action: "set_base", base_nightly_rate_aed: "1" }), "stay_id");
});

test("rates: save_range is flattened for ops_save_stay_rate; last before first and over 730 nights are refused", () => {
  assert.deepEqual(p.parseRateAction({ action: "save_range", stay_id: A, range: { first_night: "2026-12-20", last_night: "2026-12-26", nightly_rate_aed: "1200" } }), {
    action: "save_range",
    rate: { stay_id: A, first_night: "2026-12-20", last_night: "2026-12-26", nightly_rate_aed: "1200.00" },
  });
  assert.equal(p.parseRateAction({ action: "save_range", stay_id: A, range: { id: B, first_night: "2026-12-20", last_night: "2026-12-20", nightly_rate_aed: "1" } }).rate.id, B);
  invalid(() => p.parseRateAction({ action: "save_range", stay_id: A, range: { first_night: "2026-12-20", last_night: "2026-12-19", nightly_rate_aed: "1" } }), "range.last_night");
  assert.ok(p.parseRateAction({ action: "save_range", stay_id: A, range: { first_night: "2026-01-01", last_night: "2027-12-31", nightly_rate_aed: "1" } }), "730 nights");
  invalid(() => p.parseRateAction({ action: "save_range", stay_id: A, range: { first_night: "2026-01-01", last_night: "2028-01-01", nightly_rate_aed: "1" } }), "range.last_night");
  invalid(() => p.parseRateAction({ action: "save_range", stay_id: A, range: { first_night: "2026-02-30", last_night: "2026-03-01", nightly_rate_aed: "1" } }), "range.first_night");
  invalid(() => p.parseRateAction({ action: "save_range", stay_id: A, range: { first_night: "2026-03-01", last_night: "2026-03-01", nightly_rate_aed: "0" } }), "range.nightly_rate_aed");
  invalid(() => p.parseRateAction({ action: "save_range", stay_id: A }), "range");
  assert.deepEqual(p.parseRateAction({ action: "delete_range", id: B }), { action: "delete_range", id: B });
  invalid(() => p.parseRateAction({ action: "delete_range" }), "id");
});

test("rates GET: stay_id required; from and to together, to after from, at most 366 nights", () => {
  const q = (s) => p.parseRatesQuery(new URLSearchParams(s));
  assert.deepEqual(q(`stay_id=${A}`), { stay_id: A, from: null, to: null });
  assert.deepEqual(q(`stay_id=${A}&from=2026-03-01&to=2026-03-04`), { stay_id: A, from: "2026-03-01", to: "2026-03-04" });
  invalid(() => q(""), "stay_id");
  invalid(() => q(`stay_id=${A}&from=2026-03-01`), "to");
  invalid(() => q(`stay_id=${A}&to=2026-03-01`), "from");
  invalid(() => q(`stay_id=${A}&from=2026-03-04&to=2026-03-04`), "to");
  assert.ok(q(`stay_id=${A}&from=2026-01-01&to=2027-01-02`), "366 nights");
  invalid(() => q(`stay_id=${A}&from=2026-01-01&to=2027-01-03`), "to");
});

// ---- 5.4 blocks ---------------------------------------------------------------------------------------------------------

test("blocks: the scope decides which target is needed; days are inclusive; reason at most 300", () => {
  assert.deepEqual(p.parseBlockAction({ action: "add", block: { scope: "stay", stay_id: A, starts_on: "2026-06-01", ends_on: "2026-06-03" } }), {
    action: "add",
    block: { scope: "stay", stay_id: A, destination_id: null, starts_on: "2026-06-01", ends_on: "2026-06-03", reason: null },
  });
  invalid(() => p.parseBlockAction({ action: "add", block: { scope: "stay", starts_on: "2026-06-01", ends_on: "2026-06-01" } }), "block.stay_id");
  invalid(() => p.parseBlockAction({ action: "add", block: { scope: "stay", stay_id: A, destination_id: B, starts_on: "2026-06-01", ends_on: "2026-06-01" } }), "block.destination_id");
  invalid(() => p.parseBlockAction({ action: "add", block: { scope: "destination", starts_on: "2026-06-01", ends_on: "2026-06-01" } }), "block.destination_id");
  invalid(() => p.parseBlockAction({ action: "add", block: { scope: "all", stay_id: A, starts_on: "2026-06-01", ends_on: "2026-06-01" } }), "block.stay_id");
  assert.equal(p.parseBlockAction({ action: "add", block: { scope: "all", starts_on: "2026-06-01", ends_on: "2026-06-01", reason: " Owner's family " } }).block.reason, "Owner's family");
  invalid(() => p.parseBlockAction({ action: "add", block: { scope: "all", starts_on: "2026-06-02", ends_on: "2026-06-01" } }), "block.ends_on");
  invalid(() => p.parseBlockAction({ action: "add", block: { scope: "all", starts_on: "2026-06-01", ends_on: "2026-06-01", reason: "r".repeat(301) } }), "block.reason");
  invalid(() => p.parseBlockAction({ action: "add", block: { scope: "everything", starts_on: "2026-06-01", ends_on: "2026-06-01" } }), "block.scope");
  invalid(() => p.parseBlockAction({ action: "add", block: { scope: "all", starts_on: "2026-06-01", ends_on: "2026-06-01", created_by: A } }), "block.created_by");
  assert.deepEqual(p.parseBlockAction({ action: "delete", id: A }), { action: "delete", id: A });
});

test("blocks GET: from and to required, a window of at most 400 days, one target at most", () => {
  const q = (s) => p.parseBlocksQuery(new URLSearchParams(s));
  assert.deepEqual(q("from=2026-01-01&to=2026-01-31"), { from: "2026-01-01", to: "2026-01-31", stay_id: null, destination_id: null });
  assert.equal(q(`from=2026-01-01&to=2026-01-31&stay_id=${A}`).stay_id, A);
  invalid(() => q("to=2026-01-31"), "from");
  invalid(() => q("from=2026-01-01"), "to");
  invalid(() => q("from=2026-01-31&to=2026-01-01"), "to");
  assert.ok(q("from=2026-01-01&to=2027-02-04"), "400 days");
  invalid(() => q("from=2026-01-01&to=2027-02-05"), "to");
  invalid(() => q(`from=2026-01-01&to=2026-01-31&stay_id=${A}&destination_id=${B}`), "destination_id");
});

// ---- 5.5 access ---------------------------------------------------------------------------------------------------------

test("access: each field at most 2,000 or null; password and door code are kept exactly", () => {
  const out = p.parseAccessSave({ action: "save", stay_id: A, access: { address: " Calle 1 ", wifi_password: " pass word ", door_code: "" } });
  assert.deepEqual(out, { action: "save", stay_id: A, access: { address: "Calle 1", wifi_password: " pass word ", door_code: null } });
  invalid(() => p.parseAccessSave({ action: "save", stay_id: A, access: { notes: "n".repeat(2001) } }), "access.notes");
  invalid(() => p.parseAccessSave({ action: "save", stay_id: A, access: { pin: "1" } }), "access.pin");
  invalid(() => p.parseAccessSave({ action: "save", stay_id: "x", access: {} }), "stay_id");
  invalid(() => p.parseAccessSave({ action: "delete", stay_id: A }), "action");
  invalid(() => p.parseAccessSave({ action: "save", stay_id: A }), "access");
});

// ---- 5.6 catalog --------------------------------------------------------------------------------------------------------

const NEW_ITEM = { slug: "salsa-night", kind: "experience", unit: "person", translations: { en: { name: "Salsa night" } } };

test("catalog: kind, unit, money, booleans and link lists", () => {
  const item = p.parseCatalogAction({ action: "save", item: { ...NEW_ITEM, price_aed: "350", is_uae: false, destination_ids: [A], stay_ids: [B, C] } }).item;
  assert.deepEqual(item, { ...NEW_ITEM, price_aed: "350.00", is_uae: false, destination_ids: [A], stay_ids: [B, C] });
  invalid(() => p.parseCatalogAction({ action: "save", item: { ...NEW_ITEM, kind: "tour" } }), "kind");
  invalid(() => p.parseCatalogAction({ action: "save", item: { ...NEW_ITEM, unit: "hour" } }), "unit");
  invalid(() => p.parseCatalogAction({ action: "save", item: { ...NEW_ITEM, price_aed: 350 } }), "price_aed");
  assert.equal(p.parseCatalogAction({ action: "save", item: { ...NEW_ITEM, price_aed: "0" } }).item.price_aed, "0.00", "a free item is allowed (>= 0)");
  invalid(() => p.parseCatalogAction({ action: "save", item: { ...NEW_ITEM, is_uae: null } }), "is_uae");
  invalid(() => p.parseCatalogAction({ action: "save", item: { ...NEW_ITEM, is_home_pickup: "true" } }), "is_home_pickup");
  invalid(() => p.parseCatalogAction({ action: "save", item: { ...NEW_ITEM, destination_ids: [A, A] } }), "destination_ids");
  invalid(() => p.parseCatalogAction({ action: "save", item: { ...NEW_ITEM, stay_ids: [B, B] } }), "stay_ids");
  invalid(() => p.parseCatalogAction({ action: "save", item: { slug: "x", unit: "person", translations: NEW_ITEM.translations } }), "kind");
  invalid(() => p.parseCatalogAction({ action: "save", item: { slug: "x", kind: "service", translations: NEW_ITEM.translations } }), "unit");
});

test("catalog: absent keys stay absent (a save of {id, price_aed} keeps the links); is_home_pickup absent is untouched", () => {
  assert.deepEqual(p.parseCatalogAction({ action: "save", item: { id: A, price_aed: "99.5" } }).item, { id: A, price_aed: "99.50" });
  assert.deepEqual(p.parseCatalogAction({ action: "save", item: { id: A, price_aed: null, destination_ids: [] } }).item, { id: A, price_aed: null, destination_ids: [] });
  assert.equal("is_home_pickup" in p.parseCatalogAction({ action: "save", item: NEW_ITEM }).item, false);
});

// ---- 5.7 team -----------------------------------------------------------------------------------------------------------

const NEW_MEMBER = { slug: "member-a", translations: { en: { name: "[Name]" } } };

test("team: at most 8 links, label at most 40, https urls only; email shape or null", () => {
  const item = p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, email: " Someone@Example.com ", links: [{ label: "Instagram", url: "https://instagram.com/x" }] } }).item;
  assert.deepEqual(item.links, [{ label: "Instagram", url: "https://instagram.com/x" }]);
  assert.equal(item.email, "Someone@Example.com");
  for (const url of ["http://instagram.com/x", "javascript:alert(1)", "/relative", "instagram.com/x", "https://", "https:// space.com", "ftp://x.com"]) {
    invalid(() => p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, links: [{ label: "x", url }] } }), "links.0.url");
  }
  invalid(() => p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, links: [{ label: "x".repeat(41), url: "https://a.co" }] } }), "links.0.label");
  invalid(() => p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, links: [{ label: " ", url: "https://a.co" }] } }), "links.0.label");
  invalid(() => p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, links: [{ label: "x", url: `https://a.co/${"p".repeat(300)}` }] } }), "links.0.url");
  invalid(() => p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, links: Array(9).fill({ label: "x", url: "https://a.co" }) } }), "links");
  invalid(() => p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, links: [{ label: "x", url: "https://a.co", icon: "y" }] } }), "links.0.icon");
  invalid(() => p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, email: "not-an-email" } }), "email");
  assert.equal(p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, email: null } }).item.email, null);
  assert.equal(p.parseTeamAction({ action: "save", item: { ...NEW_MEMBER, email: "" } }).item.email, null);
  assert.deepEqual(p.parseTeamAction({ action: "save", item: { id: A, links: [] } }).item, { id: A, links: [] });
});

// ---- 5.8 journeys -------------------------------------------------------------------------------------------------------

test("journeys: save needs an existing id (no create); the EN price label is parsed into the five price columns", () => {
  const out = p.parseJourneyAction({ action: "save", item: { id: A, translations: { en: { name: "The Explorer", price_label: "From USD $3,000/person · Est. AED 80,000–90,000" } } } });
  assert.deepEqual(out.item, {
    id: A,
    translations: { en: { name: "The Explorer", price_label: "From USD $3,000/person · Est. AED 80,000–90,000" } },
    price_from_amount: 3000,
    price_from_currency: "USD",
    est_low: 80000,
    est_high: 90000,
    est_open_ended: false,
  });
  invalid(() => p.parseJourneyAction({ action: "save", item: { translations: { en: { name: "x", price_label: "y" } } } }), "id");
  invalid(() => p.parseJourneyAction({ action: "save", item: { id: A, slug: "the-explorer" } }), "slug");
  invalid(() => p.parseJourneyAction({ action: "save", item: { id: A, translations: { en: { name: "The Explorer" } } } }), "translations.en.price_label", "en");
  invalid(() => p.parseJourneyAction({ action: "save", item: { id: A, translations: { en: { price_label: "Price on request" } } } }), "translations.en.name", "en");
  invalid(() => p.parseJourneyAction({ action: "delete", id: A }), "action");
});

test("journeys: an unparsable label stores null prices; a save without EN leaves the prices alone", () => {
  const out = p.parseJourneyAction({ action: "save", item: { id: A, translations: { en: { name: "The Explorer", price_label: "Price on request" } } } }).item;
  assert.equal(out.price_from_amount, null);
  assert.equal(out.price_from_currency, null);
  assert.equal(out.est_low, null);
  assert.equal(out.est_high, null);
  assert.equal(out.est_open_ended, null);
  const flag = p.parseJourneyAction({ action: "save", item: { id: A, is_featured: true } }).item;
  assert.deepEqual(flag, { id: A, is_featured: true });
  assert.deepEqual(p.parseJourneyAction({ action: "reorder", ids: [C, B, A] }), { action: "reorder", ids: [C, B, A] });
});

// ---- 5.9 publish --------------------------------------------------------------------------------------------------------

test("publish: one of the five entities, a uuid and a boolean", () => {
  assert.deepEqual(p.parsePublish({ entity: "stay", id: A, published: true }), { entity: "stay", id: A, published: true });
  for (const entity of ["destination", "stay", "catalog_item", "team_member", "journey_tier"]) assert.ok(p.parsePublish({ entity, id: A, published: false }));
  invalid(() => p.parsePublish({ entity: "media", id: A, published: true }), "entity");
  invalid(() => p.parsePublish({ entity: "stay", id: "x", published: true }), "id");
  invalid(() => p.parsePublish({ entity: "stay", id: A, published: "yes" }), "published");
  invalid(() => p.parsePublish({ entity: "stay", id: A, published: true, force: true }), "force");
});

test("the id query of a GET: absent -> list, a uuid -> detail, anything else invalid", () => {
  assert.equal(p.parseIdQuery(new URLSearchParams("")), null);
  assert.equal(p.parseIdQuery(new URLSearchParams(`id=${A.toUpperCase()}`)), A);
  invalid(() => p.parseIdQuery(new URLSearchParams("id=1")), "id");
  assert.deepEqual(p.parseCatalogQuery(new URLSearchParams("kind=service")), { id: null, kind: "service" });
  invalid(() => p.parseCatalogQuery(new URLSearchParams("kind=tour")), "kind");
});
