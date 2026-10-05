// Plan 04-02, Tasks 2 and 3: the request parsers, the booking access rule, and (Task 3) the quote and hold helpers on a
// fake rpc. Every amount is a symbolic test value in fils (1 AED = 100 fils), not a real price, rate or fee.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const validate = await loadTs("lib/booking/validate.ts");
const access = await loadTs("lib/booking/access.ts");

const { parseQuoteRequest, parseHoldRequest, parseReleaseRequest, needsPickupAddress } = validate;
const { authorizeBookingAccess } = access;

const ADDON = "3f1c2a3e-1111-4222-8333-444455556666";
const REF = "ALMAR-7K3QH9";
const TOKEN = "A".repeat(43);

const quote = (over = {}) => ({
  stay: "stay-one", from: "2026-11-10", to: "2026-11-13", adults: 2, children: 0, infants: 0, addons: [], plan: "deposit", locale: "en", ...over,
});
const adult = (name, booker = false) => ({ kind: "adult", fullName: name, isBooker: booker, notStaying: false });
const hold = (over = {}) => ({
  ...quote(),
  contact: { name: "Ann Guest", email: "Ann@Example.com", phone: "+971 50 123 4567" },
  travellers: [adult("Ann Guest", true), adult("Bob Guest")],
  airport: "DXB",
  termsAccepted: true,
  ...over,
});

function refused(result, field) {
  assert.equal(result.ok, false, `expected a refusal for ${field}`);
  assert.deepEqual(result.reasons, [{ code: "invalid", field }]);
}

// ---------------------------------------------------------------- parseQuoteRequest

test("parseQuoteRequest: a good body is accepted as it is", () => {
  const body = quote({ addons: [{ id: ADDON, qty: 2 }, { id: "9f1c2a3e-1111-4222-8333-444455556666", qty: 0 }] });
  const r = parseQuoteRequest(body);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, body);
});

test("parseQuoteRequest: the trip page's own hold (ref and token) is part of a quote", () => {
  const r = parseQuoteRequest(quote({ hold: { ref: REF, t: TOKEN } }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.hold, { ref: REF, t: TOKEN });
  refused(parseQuoteRequest(quote({ hold: { ref: "almar-7k3qh9", t: TOKEN } })), "hold.ref");
  refused(parseQuoteRequest(quote({ hold: { ref: REF, t: "short" } })), "hold.t");
  refused(parseQuoteRequest(quote({ hold: { ref: REF, t: "has spaces and is long enough to pass a length check" } })), "hold.t");
  refused(parseQuoteRequest(quote({ hold: { ref: REF, t: TOKEN, extra: 1 } })), "hold.extra");
  refused(parseQuoteRequest(quote({ hold: "ALMAR-7K3QH9" })), "hold");
});

test("parseQuoteRequest: anything that is not a plain object is refused", () => {
  for (const bad of [null, undefined, [], "x", 5, true]) refused(parseQuoteRequest(bad), "body");
});

test("parseQuoteRequest: unknown keys are refused, naming the key", () => {
  refused(parseQuoteRequest({ ...quote(), surprise: 1 }), "surprise");
  refused(parseQuoteRequest({ ...quote(), amount: 100 }), "amount");
  refused(parseQuoteRequest({ ...quote(), contact: { name: "x" } }), "contact");
});

test("parseQuoteRequest: every field is required", () => {
  for (const key of ["stay", "from", "to", "adults", "children", "infants", "addons", "plan", "locale"]) {
    const body = quote();
    delete body[key];
    refused(parseQuoteRequest(body), key);
  }
});

test("parseQuoteRequest: the stay is a slug of at most 80 characters", () => {
  assert.equal(parseQuoteRequest(quote({ stay: "a1-b2-c3" })).ok, true);
  assert.equal(parseQuoteRequest(quote({ stay: "a".repeat(80) })).ok, true);
  for (const bad of ["", "Stay-One", "stay one", "-stay", "stay-", "stay--one", "stay/one", "a".repeat(81), 5, null, "stay_one", "estancia-ñ"]) {
    refused(parseQuoteRequest(quote({ stay: bad })), "stay");
  }
});

test("parseQuoteRequest: dates are real ISO days (the engine judges order and the past)", () => {
  assert.equal(parseQuoteRequest(quote({ from: "2026-11-13", to: "2026-11-10" })).ok, true, "the order is the engine's reason, not a parse error");
  for (const bad of ["2026-02-30", "2026-13-01", "26-11-10", "2026-11-10T00:00:00Z", "10/11/2026", "", null, 20261110, "2026-1-1"]) {
    refused(parseQuoteRequest(quote({ from: bad })), "from");
    refused(parseQuoteRequest(quote({ to: bad })), "to");
  }
});

test("parseQuoteRequest: guest counts are integers, adults 1..99, children and infants 0..99", () => {
  assert.equal(parseQuoteRequest(quote({ adults: 99, children: 99, infants: 99 })).ok, true);
  assert.equal(parseQuoteRequest(quote({ adults: 1, children: 0, infants: 0 })).ok, true);
  for (const bad of [0, 100, -1, 1.5, "2", Number.NaN, Infinity, null, 1e9]) refused(parseQuoteRequest(quote({ adults: bad })), "adults");
  for (const bad of [-1, 100, 0.5, "0", null]) {
    refused(parseQuoteRequest(quote({ children: bad })), "children");
    refused(parseQuoteRequest(quote({ infants: bad })), "infants");
  }
});

test("parseQuoteRequest: add-ons are at most 100 of {uuid, integer quantity >= 0}", () => {
  assert.equal(parseQuoteRequest(quote({ addons: Array.from({ length: 100 }, (_, i) => ({ id: `3f1c2a3e-1111-4222-8333-${String(i).padStart(12, "0")}`, qty: 1 })) })).ok, true);
  refused(parseQuoteRequest(quote({ addons: Array.from({ length: 101 }, () => ({ id: ADDON, qty: 1 })) })), "addons");
  refused(parseQuoteRequest(quote({ addons: "none" })), "addons");
  refused(parseQuoteRequest(quote({ addons: [null] })), "addons.0");
  refused(parseQuoteRequest(quote({ addons: [{ id: "not-a-uuid", qty: 1 }] })), "addons.0.id");
  refused(parseQuoteRequest(quote({ addons: [{ id: ADDON, qty: -1 }] })), "addons.0.qty");
  refused(parseQuoteRequest(quote({ addons: [{ id: ADDON, qty: 1.5 }] })), "addons.0.qty");
  refused(parseQuoteRequest(quote({ addons: [{ id: ADDON, qty: "1" }] })), "addons.0.qty");
  refused(parseQuoteRequest(quote({ addons: [{ id: ADDON, qty: 1e300 }] })), "addons.0.qty");
  refused(parseQuoteRequest(quote({ addons: [{ id: ADDON }] })), "addons.0.qty");
  refused(parseQuoteRequest(quote({ addons: [{ id: ADDON, qty: 1, price: 5 }] })), "addons.0.price");
  assert.equal(parseQuoteRequest(quote({ addons: [{ id: ADDON, qty: 1 }, { id: ADDON, qty: 1 }] })).ok, true, "a repeated id is the engine's reason, not a parse error");
});

test("parseQuoteRequest: plan and locale come from fixed lists", () => {
  for (const plan of ["deposit", "full"]) assert.equal(parseQuoteRequest(quote({ plan })).ok, true);
  for (const locale of ["en", "ar", "es"]) assert.equal(parseQuoteRequest(quote({ locale })).ok, true);
  for (const bad of ["Deposit", "balance", "", null, 1]) refused(parseQuoteRequest(quote({ plan: bad })), "plan");
  for (const bad of ["fr", "EN", "", null]) refused(parseQuoteRequest(quote({ locale: bad })), "locale");
});

test("parseQuoteRequest never throws on hostile input", () => {
  const hostile = [
    JSON.parse('{"__proto__": {"x": 1}, "stay": "a"}'),
    { ...quote(), addons: [{ id: ADDON, qty: 1, toString: 1 }] },
    Object.create({ stay: "inherited" }),
    { stay: { toString() { throw new Error("boom"); } } },
  ];
  for (const body of hostile) assert.doesNotThrow(() => parseQuoteRequest(body));
});

// ---------------------------------------------------------------- parseHoldRequest

test("parseHoldRequest: a good body is accepted, the email lower-cased and the strings trimmed", () => {
  const r = parseHoldRequest(hold({
    contact: { name: "  Ann Guest ", email: "  Ann@Example.com ", phone: " +971 50 123 4567 ", nationality: " Swiss ", specialRequests: " Late arrival ", emergencyName: " Eve ", emergencyPhone: "+41 79 123 45 67" },
    pickupAddress: "  Villa 1, Dubai ",
  }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.contact, {
    name: "Ann Guest", email: "ann@example.com", phone: "+971 50 123 4567", nationality: "Swiss", specialRequests: "Late arrival", emergencyName: "Eve", emergencyPhone: "+41 79 123 45 67",
  });
  assert.equal(r.value.pickupAddress, "Villa 1, Dubai");
  assert.equal(r.value.airport, "DXB");
  assert.equal(r.value.termsAccepted, true);
  assert.equal(r.value.stay, "stay-one");
});

test("parseHoldRequest: empty optional fields are left out, never stored as empty text", () => {
  const r = parseHoldRequest(hold({ contact: { name: "Ann", email: "a@b.co", phone: "1234567", nationality: "", specialRequests: "  ", emergencyName: "", emergencyPhone: "" }, pickupAddress: "" }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.contact, { name: "Ann", email: "a@b.co", phone: "1234567" });
  assert.equal("pickupAddress" in r.value, false);
});

test("parseHoldRequest: it includes every quote rule", () => {
  refused(parseHoldRequest(hold({ stay: "Bad Slug" })), "stay");
  refused(parseHoldRequest(hold({ adults: 0 })), "adults");
  refused(parseHoldRequest(hold({ plan: "x" })), "plan");
  refused(parseHoldRequest(hold({ surprise: 1 })), "surprise");
  assert.equal(parseHoldRequest(hold({ hold: { ref: REF, t: TOKEN } })).ok, true, "a hold request may carry the page's old hold; the server ignores it");
});

test("parseHoldRequest: the contact (IDEN-01)", () => {
  refused(parseHoldRequest(hold({ contact: undefined })), "contact");
  refused(parseHoldRequest(hold({ contact: [] })), "contact");
  refused(parseHoldRequest(hold({ contact: { name: "", email: "a@b.co", phone: "1234567" } })), "contact.name");
  refused(parseHoldRequest(hold({ contact: { name: "   ", email: "a@b.co", phone: "1234567" } })), "contact.name");
  refused(parseHoldRequest(hold({ contact: { name: "x".repeat(121), email: "a@b.co", phone: "1234567" } })), "contact.name");
  assert.equal(parseHoldRequest(hold({ contact: { name: "x".repeat(120), email: "a@b.co", phone: "1234567" } })).ok, true);
  for (const bad of ["", "no-at-sign", "a@b", "a b@c.de", "@b.co", `${"x".repeat(250)}@b.co`, 5, null]) {
    refused(parseHoldRequest(hold({ contact: { name: "Ann", email: bad, phone: "1234567" } })), "contact.email");
  }
  for (const bad of ["", "123456", "+".repeat(3), "phone", "12345678901234567890123", "+971 50 123 4567 ext 9", 5]) {
    refused(parseHoldRequest(hold({ contact: { name: "Ann", email: "a@b.co", phone: bad } })), "contact.phone");
  }
  for (const good of ["+971 50 123 4567", "(04) 123-4567", "0501234567", "+41791234567"]) {
    assert.equal(parseHoldRequest(hold({ contact: { name: "Ann", email: "a@b.co", phone: good } })).ok, true, good);
  }
  refused(parseHoldRequest(hold({ contact: { name: "Ann", email: "a@b.co", phone: "1234567", nationality: "x".repeat(61) } })), "contact.nationality");
  refused(parseHoldRequest(hold({ contact: { name: "Ann", email: "a@b.co", phone: "1234567", specialRequests: "x".repeat(1001) } })), "contact.specialRequests");
  assert.equal(parseHoldRequest(hold({ contact: { name: "Ann", email: "a@b.co", phone: "1234567", specialRequests: "x".repeat(1000) } })).ok, true);
  refused(parseHoldRequest(hold({ contact: { name: "Ann", email: "a@b.co", phone: "1234567", emergencyName: "x".repeat(121) } })), "contact.emergencyName");
  refused(parseHoldRequest(hold({ contact: { name: "Ann", email: "a@b.co", phone: "1234567", emergencyPhone: "abc" } })), "contact.emergencyPhone");
  refused(parseHoldRequest(hold({ contact: { name: "Ann", email: "a@b.co", phone: "1234567", passport: "X1" } })), "contact.passport");
});

test("parseHoldRequest: one traveller per guest, kinds matching, ages in range, one booker (IDEN-02)", () => {
  const family = hold({
    adults: 1, children: 1, infants: 1,
    travellers: [adult("Ann", true), { kind: "child", fullName: "Kid", age: 7, isBooker: false, notStaying: false }, { kind: "infant", fullName: "Baby", age: 1, isBooker: false, notStaying: false }],
  });
  assert.equal(parseHoldRequest(family).ok, true);
  refused(parseHoldRequest(hold({ travellers: [adult("Ann", true)] })), "travellers");
  refused(parseHoldRequest(hold({ travellers: "none" })), "travellers");
  refused(parseHoldRequest(hold({ travellers: [adult("A", true), adult("B"), adult("C")] })), "travellers");
  refused(parseHoldRequest(hold({ adults: 1, children: 1, infants: 0, travellers: [adult("A", true), adult("B")] })), "travellers", "kinds must match the counts");
  for (const age of [2, 13, 0, 7.5, "7", null]) {
    refused(parseHoldRequest({ ...family, travellers: [adult("Ann", true), { kind: "child", fullName: "Kid", age, isBooker: false, notStaying: false }, family.travellers[2]] }), "travellers.1.age");
  }
  for (const age of [3, -1, 1.5, null]) {
    refused(parseHoldRequest({ ...family, travellers: [adult("Ann", true), family.travellers[1], { kind: "infant", fullName: "Baby", age, isBooker: false, notStaying: false }] }), "travellers.2.age");
  }
  refused(parseHoldRequest(hold({ travellers: [{ ...adult("Ann", true), age: 30 }, adult("Bob")] })), "travellers.0.age");
  assert.equal(parseHoldRequest(hold({ travellers: [{ ...adult("Ann", true), age: null }, adult("Bob")] })).ok, true, "an adult age of null is the same as none");
  refused(parseHoldRequest(hold({ travellers: [adult("Ann", true), adult("Bob", true)] })), "travellers.1.isBooker");
  refused(parseHoldRequest(hold({ travellers: [adult("Ann", true), { ...adult("Bob"), notStaying: true }] })), "travellers.1.notStaying");
  assert.equal(parseHoldRequest(hold({ travellers: [{ ...adult("Ann", true), notStaying: true }, adult("Bob")] })).ok, true, "the booker can mark 'I am not staying'");
  refused(parseHoldRequest(hold({ travellers: [adult("", true), adult("Bob")] })), "travellers.0.fullName");
  refused(parseHoldRequest(hold({ travellers: [adult("x".repeat(121), true), adult("Bob")] })), "travellers.0.fullName");
  refused(parseHoldRequest(hold({ travellers: [{ ...adult("Ann", true), kind: "pet" }, adult("Bob")] })), "travellers.0.kind");
  refused(parseHoldRequest(hold({ travellers: [{ ...adult("Ann", true), passport: "X" }, adult("Bob")] })), "travellers.0.passport");
  refused(parseHoldRequest(hold({ travellers: [{ ...adult("Ann"), isBooker: "yes" }, adult("Bob")] })), "travellers.0.isBooker");
  refused(parseHoldRequest(hold({ travellers: [null, adult("Bob")] })), "travellers.0");
  assert.equal(parseHoldRequest(hold({ travellers: [{ kind: "adult", fullName: "Ann" }, { kind: "adult", fullName: "Bob" }] })).ok, true, "booker and notStaying default to false");
  const none = parseHoldRequest(hold({ travellers: [{ kind: "adult", fullName: "Ann" }, { kind: "adult", fullName: "Bob" }] }));
  assert.deepEqual(none.value.travellers, [
    { kind: "adult", fullName: "Ann", isBooker: false, notStaying: false },
    { kind: "adult", fullName: "Bob", isBooker: false, notStaying: false },
  ]);
});

test("parseHoldRequest: airport, pickup address and terms (B-11, B-13)", () => {
  for (const airport of ["DXB", "AUH", "SHJ"]) assert.equal(parseHoldRequest(hold({ airport })).ok, true, airport);
  for (const bad of ["LHR", "dxb", "", null, undefined]) refused(parseHoldRequest(hold({ airport: bad })), "airport");
  refused(parseHoldRequest(hold({ pickupAddress: "x".repeat(301) })), "pickupAddress");
  assert.equal(parseHoldRequest(hold({ pickupAddress: "x".repeat(300) })).ok, true);
  refused(parseHoldRequest(hold({ pickupAddress: 5 })), "pickupAddress");
  for (const bad of [false, "true", 1, null, undefined]) refused(parseHoldRequest(hold({ termsAccepted: bad })), "termsAccepted");
});

test("parseHoldRequest: the first problem is named, and never a throw", () => {
  const r = parseHoldRequest(hold({ airport: "x", termsAccepted: false, contact: null }));
  assert.equal(r.ok, false);
  assert.equal(r.reasons.length, 1);
  assert.equal(r.reasons[0].code, "invalid");
  for (const bad of [null, 5, "x", [], { stay: {} }]) assert.doesNotThrow(() => parseHoldRequest(bad));
});

// ---------------------------------------------------------------- parseReleaseRequest

test("parseReleaseRequest: { ref, t } and nothing else", () => {
  const r = parseReleaseRequest({ ref: REF, t: TOKEN });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { ref: REF, t: TOKEN });
  refused(parseReleaseRequest({ ref: "nope", t: TOKEN }), "ref");
  refused(parseReleaseRequest({ ref: REF, t: "short" }), "t");
  refused(parseReleaseRequest({ ref: REF }), "t");
  refused(parseReleaseRequest({ ref: REF, t: TOKEN, extra: 1 }), "extra");
  refused(parseReleaseRequest(null), "body");
});

// ---------------------------------------------------------------- needsPickupAddress (B-11)

test("needsPickupAddress: true when the home-pickup line has a quantity (the explicit flag, never is_uae or a slug)", () => {
  assert.equal(needsPickupAddress([{ isHomePickup: true, quantity: 1 }]), true);
  assert.equal(needsPickupAddress([{ isHomePickup: false, quantity: 1 }, { isHomePickup: true, quantity: 2 }]), true);
  assert.equal(needsPickupAddress([{ isHomePickup: true, quantity: 0 }]), false);
  assert.equal(needsPickupAddress([{ isHomePickup: false, quantity: 3 }]), false);
  assert.equal(needsPickupAddress([]), false);
});

// ---------------------------------------------------------------- authorizeBookingAccess (B-16, AUTH-01)

function deps({ booking = { id: "b-1", email: "ann@example.com", linkVersion: 2 }, valid = true, session = null } = {}) {
  const calls = { find: [], verify: [], session: 0 };
  return {
    calls,
    findByRef: async (ref) => { calls.find.push(ref); return booking && ref === REF ? booking : null; },
    verify: async (id, version, token) => { calls.verify.push([id, version, token]); return valid && token === TOKEN; },
    readSession: async () => { calls.session += 1; return session; },
  };
}

test("access with a token: the token decides, with the booking's own id and link version", async () => {
  const d = deps();
  assert.deepEqual(await authorizeBookingAccess({ ref: REF, t: TOKEN }, d), { ok: true, bookingId: "b-1", via: "link" });
  assert.deepEqual(d.calls.verify, [["b-1", 2, TOKEN]]);
  assert.equal(d.calls.session, 0, "the session is not even read when a token is given");
});

test("access with a wrong token is refused, and a matching signed-in email does not rescue it", async () => {
  const d = deps({ session: { email: "ann@example.com" } });
  assert.deepEqual(await authorizeBookingAccess({ ref: REF, t: "B".repeat(43) }, d), { ok: false });
  assert.equal(d.calls.session, 0);
});

test("access: a bad ref, an unknown ref and a wrong token all get the identical refusal", async () => {
  const wrongToken = await authorizeBookingAccess({ ref: REF, t: "B".repeat(43) }, deps());
  const unknown = await authorizeBookingAccess({ ref: "ALMAR-AAAAAA", t: TOKEN }, deps());
  const badShape = await authorizeBookingAccess({ ref: "nope", t: TOKEN }, deps());
  const notString = await authorizeBookingAccess({ ref: 5, t: TOKEN }, deps());
  assert.deepEqual(wrongToken, { ok: false });
  assert.deepEqual(unknown, { ok: false });
  assert.deepEqual(badShape, { ok: false });
  assert.deepEqual(notString, { ok: false });
  const d = deps();
  await authorizeBookingAccess({ ref: "nope", t: TOKEN }, d);
  assert.deepEqual(d.calls.find, [], "a malformed ref never reaches the database");
});

test("access without a token: the signed-in email must equal the booking's (case does not matter)", async () => {
  assert.deepEqual(await authorizeBookingAccess({ ref: REF }, deps({ session: { email: "Ann@Example.COM" } })), { ok: true, bookingId: "b-1", via: "session" });
  assert.deepEqual(await authorizeBookingAccess({ ref: REF, t: undefined }, deps({ session: { email: "ann@example.com" } })), { ok: true, bookingId: "b-1", via: "session" });
  assert.deepEqual(await authorizeBookingAccess({ ref: REF, t: null }, deps({ session: { email: "ann@example.com" } })), { ok: true, bookingId: "b-1", via: "session" });
  assert.deepEqual(await authorizeBookingAccess({ ref: REF }, deps({ session: { email: "bob@example.com" } })), { ok: false });
  assert.deepEqual(await authorizeBookingAccess({ ref: REF }, deps({ session: null })), { ok: false });
  assert.deepEqual(await authorizeBookingAccess({ ref: REF }, deps({ session: { email: "" } })), { ok: false });
  assert.deepEqual(await authorizeBookingAccess({ ref: REF }, deps({ booking: { id: "b-1", email: "", linkVersion: 1 }, session: { email: "" } })), { ok: false });
  assert.deepEqual(await authorizeBookingAccess({ ref: "ALMAR-AAAAAA" }, deps({ session: { email: "ann@example.com" } })), { ok: false });
});

test("access: knowing the email is not a key. A token that is empty or not a string is a token, and it fails", async () => {
  const session = { email: "ann@example.com" };
  assert.deepEqual(await authorizeBookingAccess({ ref: REF, t: "" }, deps({ session })), { ok: false });
  assert.deepEqual(await authorizeBookingAccess({ ref: REF, t: 123 }, deps({ session })), { ok: false });
  assert.deepEqual(await authorizeBookingAccess({ ref: REF, t: {} }, deps({ session })), { ok: false });
});

test("access.ts takes its dependencies as arguments (no environment, no database import)", () => {
  const source = readFileSync("lib/booking/access.ts", "utf8");
  assert.doesNotMatch(source, /process\.env|supabase|next\//i);
});

// ================================================================ Task 3: quote, hold and release on a fake rpc
// Every amount is a symbolic test value in fils: 1000.00 AED a night = 100000, VAT 500 bp, deposit 3000 bp, due 30 days
// before arrival. The fake database answers canned booking_context JSON; nothing here is a real price or rate.

process.env.BOOKING_LINK_SECRET = "test-secret-".padEnd(48, "x");
const server = await loadTs("lib/booking/server.ts");
const linkModule = await loadTs("lib/booking/link.ts");
const { quoteBooking, createWebHold, releaseWebHold, snapshotRow, holdStatus, liveGate } = server;
const { signBookingLink } = linkModule;

const NOW = new Date("2026-10-05T10:00:00Z"); // 14:00 in Dubai, so "today" is 2026-10-05
const STAY_ID = "11111111-1111-4111-8111-111111111111";
const PERSON_ITEM = "aaaaaaaa-1111-4222-8333-444455556666"; // per person, 10000 fils
const HOME_ITEM = "bbbbbbbb-1111-4222-8333-444455556666"; // per trip, 25000 fils, the home-pickup flag
const OWN_ID = "99999999-9999-4999-8999-999999999999";
const OWN_REF = "ALMAR-7K3QH9";

function nightsBetween(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t < Date.parse(`${to}T00:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

const OFFERS = [
  { id: PERSON_ITEM, slug: "breakfast", kind: "service", unit: "person", is_uae: false, is_home_pickup: false, price_fils: 10000, name: "Breakfast", image_key: "catalog/breakfast.webp", image_alt: "A breakfast" },
  { id: HOME_ITEM, slug: "home-pickup", kind: "service", unit: "trip", is_uae: true, is_home_pickup: true, price_fils: 25000, name: "Pickup at home", image_key: null, image_alt: null },
];

// The booking_context answer for the dates asked, with overrides for the case under test.
function ctx(args, over = {}) {
  const nights = nightsBetween(args.p_from, args.p_to);
  const stay = over.stay === null ? null : {
    id: STAY_ID, slug: args.p_stay_slug, destination_id: "d-1", is_published: true, max_guests: 6, min_nights: 2, infants_count: false,
    base_rate_fils: 100000, title: "Stay one", destination_name: "Destination one", image_key: "stays/stay-one/hero.webp", image_alt: "A hero", ...over.stay,
  };
  return {
    stay,
    night_rates: over.night_rates ?? nights.map((night) => ({ night, rate_fils: 100000, source: "base", rate_id: null })),
    blocked: over.blocked ?? [],
    taken: over.taken ?? [],
    offers: over.offers ?? OFFERS,
    inclusions: over.inclusions ?? [{ id: "c-1", label: "Daily cleaning" }],
    settings: over.settings ?? { vat_bp: 500, deposit_bp: 3000, balance_due_days: 30 },
    today: "2026-10-05",
  };
}

function fakeDb(handlers = {}, over = {}) {
  const calls = [];
  const all = {
    booking_context: (a) => ctx(a, typeof over === "function" ? over(a) : over),
    claim_hold_slot: () => true,
    ...handlers,
  };
  return {
    calls,
    names: () => calls.map((c) => c.name),
    rpc: async (name, args) => {
      calls.push({ name, args });
      const h = all[name];
      if (!h) throw new Error(`unexpected rpc ${name}`);
      const out = await h(args);
      if (out && out.__error) return { data: null, error: out.__error };
      return { data: out, error: null };
    },
  };
}

const q = (over = {}) => ({ stay: "stay-one", from: "2026-12-10", to: "2026-12-13", adults: 2, children: 0, infants: 0, addons: [], plan: "deposit", locale: "en", ...over });
const codes = (r) => r.reasons.map((x) => x.code);

// ---------------------------------------------------------------- quoteBooking

test("quote: one booking_context call, the server's money, the stay card and the offers", async () => {
  const db = fakeDb();
  const r = await quoteBooking(db, q(), { now: NOW });
  assert.deepEqual(db.names(), ["booking_context"]);
  assert.deepEqual(db.calls[0].args, { p_stay_slug: "stay-one", p_from: "2026-12-10", p_to: "2026-12-13", p_locale: "en", p_own_booking: null });
  assert.equal(r.ok, true);
  assert.deepEqual(r.reasons, []);
  const b = r.breakdown;
  assert.equal(b.nightsFils, 300000);
  assert.equal(b.subtotalFils, 300000);
  assert.equal(b.vatFils, 15000);
  assert.equal(b.grandFils, 315000);
  assert.equal(b.dueNowFils, 94500);
  assert.equal(b.balanceFils, 220500);
  assert.equal(b.balanceDueDate, "2026-11-10");
  assert.equal(b.plan, "deposit");
  assert.deepEqual(r.stay, {
    slug: "stay-one", title: "Stay one", destinationName: "Destination one",
    image: { src: "https://media.almarprivatejourney.com/stays/stay-one/hero.webp", alt: "A hero" },
    maxGuests: 6, minNights: 2, infantsCount: false,
  });
  assert.equal(r.offers.length, 2);
  assert.deepEqual(r.offers[0], {
    id: PERSON_ITEM, slug: "breakfast", kind: "service", unit: "person", isUae: false, isHomePickup: false, name: "Breakfast",
    image: { src: "https://media.almarprivatejourney.com/catalog/breakfast.webp", alt: "A breakfast" }, priceFils: 10000,
  });
  assert.equal(r.offers[1].image, null, "an offer without an image key has no image, never a broken URL");
  assert.deepEqual(r.inclusions, [{ id: "c-1", label: "Daily cleaning" }]);
});

test("quote: the locale is passed through to the context", async () => {
  const db = fakeDb();
  await quoteBooking(db, q({ locale: "es" }), { now: NOW });
  assert.equal(db.calls[0].args.p_locale, "es");
});

test("quote: add-ons become priced lines; the engine's unit and quantity rules apply", async () => {
  const db = fakeDb();
  const r = await quoteBooking(db, q({ addons: [{ id: PERSON_ITEM, qty: 2 }, { id: HOME_ITEM, qty: 0 }] }), { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.breakdown.addonsFils, 20000);
  assert.equal(r.breakdown.subtotalFils, 320000);
  assert.equal(r.breakdown.vatFils, 16000);
  assert.equal(r.breakdown.grandFils, 336000);
  assert.equal(r.breakdown.dueNowFils, 100800);
  assert.equal(r.breakdown.balanceFils, 235200);
  assert.deepEqual(r.breakdown.lines, [{ id: PERSON_ITEM, unit: "person", unitPriceFils: 10000, quantity: 2, lineFils: 20000 }]);
  const unknown = await quoteBooking(db, q({ addons: [{ id: "cccccccc-1111-4222-8333-444455556666", qty: 1 }] }), { now: NOW });
  assert.deepEqual(unknown.reasons, [{ code: "addon_unavailable", id: "cccccccc-1111-4222-8333-444455556666" }]);
  const tooMany = await quoteBooking(db, q({ addons: [{ id: PERSON_ITEM, qty: 3 }] }), { now: NOW });
  assert.deepEqual(tooMany.reasons, [{ code: "addon_quantity", id: PERSON_ITEM, max: 2 }]);
  assert.equal(tooMany.ok, false);
});

test("quote: a missing or unpublished stay is stay_unavailable and nothing else", async () => {
  for (const stay of [null, { id: STAY_ID, slug: "stay-one", is_published: false }]) {
    const db = fakeDb({ booking_context: (a) => ({ ...ctx(a), stay }) });
    const r = await quoteBooking(db, q(), { now: NOW });
    assert.deepEqual(r.reasons, [{ code: "stay_unavailable" }]);
    assert.equal(r.ok, false);
    assert.equal(r.stay, null);
    assert.deepEqual(r.offers, []);
    assert.equal(r.breakdown, null);
  }
});

test("quote: blocked nights are named (STAY-03, B-02)", async () => {
  const db = fakeDb({}, { blocked: ["2026-12-11"] });
  const r = await quoteBooking(db, q(), { now: NOW });
  assert.equal(r.ok, false);
  assert.deepEqual(r.reasons, [{ code: "blocked", nights: ["2026-12-11"] }]);
  assert.ok(r.breakdown, "the price still shows");
});

test("quote: taken nights are sold_out with the nights", async () => {
  const db = fakeDb({}, { taken: ["2026-12-10", "2026-12-12"] });
  const r = await quoteBooking(db, q(), { now: NOW });
  assert.deepEqual(r.reasons, [{ code: "sold_out", nights: ["2026-12-10", "2026-12-12"] }]);
});

test("quote: blocked and taken are both reported when both apply", async () => {
  const db = fakeDb({}, { blocked: ["2026-12-10"], taken: ["2026-12-12"] });
  const r = await quoteBooking(db, q(), { now: NOW });
  assert.deepEqual(codes(r), ["blocked", "sold_out"]);
});

test("quote: fewer nights than the stay's minimum is below_min_nights with the minimum (STAY-02)", async () => {
  const db = fakeDb();
  const r = await quoteBooking(db, q({ to: "2026-12-11" }), { now: NOW });
  assert.deepEqual(r.reasons, [{ code: "below_min_nights", min: 2 }]);
});

test("quote: too many guests is over_max_guests; infants count only when the stay says so (STAY-02)", async () => {
  const db = fakeDb();
  const six = await quoteBooking(db, q({ adults: 4, children: 2, infants: 1 }), { now: NOW });
  assert.equal(six.ok, true, "six guests plus an infant that does not count");
  const seven = await quoteBooking(db, q({ adults: 4, children: 3 }), { now: NOW });
  assert.deepEqual(seven.reasons, [{ code: "over_max_guests", max: 6 }]);
  const counted = fakeDb({}, { stay: { infants_count: true } });
  const withInfant = await quoteBooking(counted, q({ adults: 4, children: 2, infants: 1 }), { now: NOW });
  assert.deepEqual(withInfant.reasons, [{ code: "over_max_guests", max: 6 }]);
  const noLimit = fakeDb({}, { stay: { max_guests: null } });
  assert.equal((await quoteBooking(noLimit, q({ adults: 20 }), { now: NOW })).ok, true, "a stay without a maximum takes any count");
});

test("quote: a stay without a base rate, or a night without a rate, is no_rate and has no price", async () => {
  const noBase = await quoteBooking(fakeDb({}, { stay: { base_rate_fils: null } }), q(), { now: NOW });
  assert.deepEqual(codes(noBase), ["no_rate"]);
  assert.equal(noBase.breakdown, null);
  const gap = await quoteBooking(fakeDb({}, (a) => ({
    night_rates: nightsBetween(a.p_from, a.p_to).map((night, i) => ({ night, rate_fils: i === 1 ? null : 100000, source: i === 1 ? null : "base", rate_id: null })),
  })), q(), { now: NOW });
  assert.deepEqual(codes(gap), ["no_rate"]);
});

test("quote: owner settings that are not set are settings_missing, never a default", async () => {
  const none = await quoteBooking(fakeDb({}, { settings: { vat_bp: null, deposit_bp: null, balance_due_days: null } }), q(), { now: NOW });
  assert.deepEqual(codes(none), ["settings_missing"]);
  assert.equal(none.breakdown, null);
  const noVat = await quoteBooking(fakeDb({}, { settings: { vat_bp: null, deposit_bp: 3000, balance_due_days: 30 } }), q({ plan: "full" }), { now: NOW });
  assert.deepEqual(codes(noVat), ["settings_missing"]);
});

test("quote: balance days not set refuses the deposit but not full payment (B-21)", async () => {
  const settings = { vat_bp: 500, deposit_bp: 3000, balance_due_days: null };
  const dep = await quoteBooking(fakeDb({}, { settings }), q({ plan: "deposit" }), { now: NOW });
  assert.equal(dep.ok, false);
  assert.deepEqual(dep.reasons, [{ code: "deposit_unavailable", cause: "no_due_days" }]);
  assert.equal(dep.breakdown.plan, "full", "the shown price is the payable plan");
  const full = await quoteBooking(fakeDb({}, { settings }), q({ plan: "full" }), { now: NOW });
  assert.equal(full.ok, true);
  assert.equal(full.breakdown.depositBlock, "no_due_days");
  assert.equal(full.breakdown.dueNowFils, 315000);
});

test("quote: arrival sooner than the balance days: deposit refused with the cause, full accepted (B-21)", async () => {
  const soon = q({ from: "2026-10-20", to: "2026-10-23" }); // 15 days away, the balance is due 30 days before
  const dep = await quoteBooking(fakeDb(), soon, { now: NOW });
  assert.deepEqual(dep.reasons, [{ code: "deposit_unavailable", cause: "too_close_to_arrival" }]);
  assert.equal(dep.ok, false);
  const full = await quoteBooking(fakeDb(), { ...soon, plan: "full" }, { now: NOW });
  assert.equal(full.ok, true);
  assert.equal(full.breakdown.depositBlock, "too_close_to_arrival");
  assert.equal(full.breakdown.balanceFils, 0);
  assert.equal(full.breakdown.balanceDueDate, null);
});

test("quote: bad dates are dates_invalid alone, and a stay over 366 nights never reaches the engine", async () => {
  const db = fakeDb();
  for (const bad of [{ from: "2026-10-04", to: "2026-10-07" }, { from: "2026-12-13", to: "2026-12-10" }, { from: "2026-12-10", to: "2026-12-10" }]) {
    const r = await quoteBooking(db, q(bad), { now: NOW });
    assert.deepEqual(r.reasons, [{ code: "dates_invalid" }], JSON.stringify(bad));
    assert.equal(r.breakdown, null);
  }
  const long = await quoteBooking(fakeDb({ booking_context: (a) => ({ ...ctx(a), night_rates: [] }) }), q({ from: "2026-12-10", to: "2028-01-10" }), { now: NOW });
  assert.deepEqual(long.reasons, [{ code: "dates_invalid" }]);
  assert.equal(long.stay.slug, "stay-one", "the stay card still shows");
});

test("quote: an amount past the engine's bound is reported as invalid, never a throw", async () => {
  const huge = fakeDb({}, (a) => ({ night_rates: nightsBetween(a.p_from, a.p_to).map((night) => ({ night, rate_fils: 450359962736, source: "base", rate_id: null })) }));
  const r = await quoteBooking(huge, q(), { now: NOW });
  assert.equal(r.ok, false);
  assert.deepEqual(r.reasons, [{ code: "invalid", field: "amount", max: 450359962736 }]);
  assert.equal(r.breakdown, null);
});

test("quote: the guest's own hold is skipped only when its signed link verifies (B-16)", async () => {
  const byRef = (a) => (a.p_ref === OWN_REF ? { id: OWN_ID, email: "ann@example.com", link_version: 3, status: "held" } : null);
  const taken = (a) => ({ ...ctx(a), taken: a.p_own_booking === OWN_ID ? [] : ["2026-12-11"] });
  const good = await signBookingLink(OWN_ID, 3);

  const own = fakeDb({ booking_by_ref: byRef, booking_context: taken });
  const ok = await quoteBooking(own, q({ hold: { ref: OWN_REF, t: good } }), { now: NOW });
  assert.equal(ok.ok, true, "the guest's own nights do not count against them");
  assert.equal(own.calls.find((c) => c.name === "booking_context").args.p_own_booking, OWN_ID);
  assert.deepEqual(own.calls.find((c) => c.name === "booking_by_ref").args, { p_ref: OWN_REF });

  const cases = {
    "a token for an older link version": await signBookingLink(OWN_ID, 2),
    "a token for another booking": await signBookingLink("88888888-8888-4888-8888-888888888888", 3),
    "a made-up token": "A".repeat(43),
  };
  for (const [label, token] of Object.entries(cases)) {
    const db = fakeDb({ booking_by_ref: byRef, booking_context: taken });
    const r = await quoteBooking(db, q({ hold: { ref: OWN_REF, t: token } }), { now: NOW });
    assert.deepEqual(r.reasons, [{ code: "sold_out", nights: ["2026-12-11"] }], label);
    assert.equal(db.calls.find((c) => c.name === "booking_context").args.p_own_booking, null, label);
  }

  const unknownRef = fakeDb({ booking_by_ref: () => null, booking_context: taken });
  const u = await quoteBooking(unknownRef, q({ hold: { ref: "ALMAR-AAAAAA", t: good } }), { now: NOW });
  assert.equal(u.ok, false, "an unknown reference skips nothing");

  const bare = fakeDb({ booking_by_ref: byRef, booking_context: taken });
  const b = await quoteBooking(bare, q(), { now: NOW });
  assert.equal(b.ok, false, "a quote without a hold skips nothing");
  assert.equal(bare.names().includes("booking_by_ref"), false, "and does not look anything up");
});

test("quote: without the link secret no hold is ever skipped", async () => {
  const saved = process.env.BOOKING_LINK_SECRET;
  const good = await signBookingLink(OWN_ID, 3);
  delete process.env.BOOKING_LINK_SECRET;
  try {
    const db = fakeDb({ booking_by_ref: () => ({ id: OWN_ID, email: "a@b.co", link_version: 3, status: "held" }), booking_context: (a) => ({ ...ctx(a), taken: a.p_own_booking ? [] : ["2026-12-11"] }) });
    const r = await quoteBooking(db, q({ hold: { ref: OWN_REF, t: good } }), { now: NOW });
    assert.equal(r.ok, false);
  } finally {
    process.env.BOOKING_LINK_SECRET = saved;
  }
});

test("quote: a database error is thrown for the route to answer 503; the message names no input", async () => {
  const db = fakeDb({ booking_context: () => ({ __error: { message: "boom", details: "secret detail" } }) });
  await assert.rejects(() => quoteBooking(db, q({ from: "2026-12-10", to: "2026-12-13" }), { now: NOW }), (e) => {
    assert.match(e.message, /booking_context/);
    assert.doesNotMatch(e.message, /stay-one|2026-12|secret detail/);
    return true;
  });
});

// ---------------------------------------------------------------- snapshotRow

test("snapshotRow: the snake_case payload the SQL functions read, add-on lines with their names and flags", async () => {
  const db = fakeDb();
  const quoted = await quoteBooking(db, q({ addons: [{ id: PERSON_ITEM, qty: 2 }, { id: HOME_ITEM, qty: 1 }] }), { now: NOW });
  const row = snapshotRow(quoted.breakdown, quoted.offers);
  assert.deepEqual(row, {
    nights_fils: 300000, addons_fils: 45000, subtotal_fils: 345000, vat_bp: 500, vat_fils: 17250, grand_fils: 362250,
    deposit_bp: 3000, deposit_fils: 108675, balance_fils: 253575, due_now_fils: 108675, plan: "deposit",
    nights_snapshot: [
      { night: "2026-12-10", rate_fils: 100000, source: "base", rate_id: null },
      { night: "2026-12-11", rate_fils: 100000, source: "base", rate_id: null },
      { night: "2026-12-12", rate_fils: 100000, source: "base", rate_id: null },
    ],
    balance_due_date: "2026-11-10",
    lines: [
      { catalog_item_id: PERSON_ITEM, name: "Breakfast", unit: "person", is_uae: false, is_home_pickup: false, unit_price_fils: 10000, quantity: 2, line_fils: 20000 },
      { catalog_item_id: HOME_ITEM, name: "Pickup at home", unit: "trip", is_uae: true, is_home_pickup: true, unit_price_fils: 25000, quantity: 1, line_fils: 25000 },
    ],
  });
});

test("snapshotRow: plan full stores no deposit and no balance, due now is the grand total", async () => {
  const quoted = await quoteBooking(fakeDb(), q({ plan: "full" }), { now: NOW });
  const row = snapshotRow(quoted.breakdown, quoted.offers);
  assert.equal(row.plan, "full");
  assert.equal(row.deposit_fils, 0);
  assert.equal(row.balance_fils, 0);
  assert.equal(row.due_now_fils, 315000);
  assert.equal(row.balance_due_date, null);
  assert.equal(row.deposit_bp, 3000, "the percentage in force is stored either way (O-08)");
  assert.deepEqual(row.lines, []);
});

test("snapshotRow: a line whose offer is not in the list is a caller error", async () => {
  const quoted = await quoteBooking(fakeDb(), q({ addons: [{ id: PERSON_ITEM, qty: 1 }] }), { now: NOW });
  assert.throws(() => snapshotRow(quoted.breakdown, []), /offer/);
});

// ---------------------------------------------------------------- createWebHold

const guest = (over = {}) => ({
  ...q(),
  contact: { name: "Ann Guest", email: "ann@example.com", phone: "+971 50 123 4567", nationality: "Swiss", specialRequests: "Late arrival", emergencyName: "Eve", emergencyPhone: "+41 79 123 45 67" },
  travellers: [
    { kind: "adult", fullName: "Bob Guest", isBooker: false, notStaying: false },
    { kind: "adult", fullName: "Ann Guest", isBooker: true, notStaying: true },
  ],
  airport: "AUH",
  termsAccepted: true,
  ...over,
});
const CTX = { ipHash: "iphash", emailHash: (email) => `h:${email}`, isTest: true, now: NOW };
const created = { ok: true, booking_id: OWN_ID, ref: OWN_REF, hold_expires_at: "2026-10-05T10:30:00.000Z", link_version: 1 };

test("hold: limiter, quote, then create_web_booking, in that order; the answer carries a signed link and no booking id", async () => {
  const db = fakeDb({ create_web_booking: () => created });
  const out = await createWebHold(db, guest(), CTX);
  assert.deepEqual(db.names(), ["claim_hold_slot", "booking_context", "create_web_booking"]);
  assert.deepEqual(db.calls[0].args, { p_email_hash: "h:ann@example.com", p_ip_hash: "iphash" });
  assert.equal(out.response.ok, true);
  assert.equal(out.response.ref, OWN_REF);
  assert.equal(out.response.holdExpiresAt, "2026-10-05T10:30:00.000Z");
  assert.equal(out.response.breakdown.grandFils, 315000);
  assert.equal(await linkModule.verifyBookingLink(OWN_ID, 1, out.response.linkToken), true, "the link token belongs to this booking at its link version");
  assert.equal(await linkModule.verifyBookingLink(OWN_ID, 2, out.response.linkToken), false);
  assert.equal(out.bookingId, OWN_ID, "the booking id is returned for 04-04");
  assert.equal(JSON.stringify(out.response).includes(OWN_ID), false, "and is never part of what the browser gets");
});

test("hold: the payload is the snapshot plus the guest, booker first, no price taken from the browser", async () => {
  const db = fakeDb({ create_web_booking: () => created });
  await createWebHold(db, guest({ locale: "ar", pickupAddress: "Villa 1" }), CTX);
  const p = db.calls.find((c) => c.name === "create_web_booking").args.p;
  assert.equal(p.stay_slug, "stay-one");
  assert.equal(p.arrive, "2026-12-10");
  assert.equal(p.leave, "2026-12-13");
  assert.deepEqual([p.adults, p.children, p.infants], [2, 0, 0]);
  assert.equal(p.guest_name, "Ann Guest");
  assert.equal(p.email, "ann@example.com");
  assert.equal(p.phone, "+971 50 123 4567");
  assert.equal(p.nationality, "Swiss");
  assert.equal(p.special_requests, "Late arrival");
  assert.equal(p.emergency_name, "Eve");
  assert.equal(p.emergency_phone, "+41 79 123 45 67");
  assert.equal(p.locale, "ar");
  assert.equal(p.airport, "AUH");
  assert.equal("pickup_address" in p, false, "an address nobody needs is not stored");
  assert.equal(p.terms_version, "placeholder");
  assert.equal(p.is_test, true);
  assert.equal(p.grand_fils, 315000);
  assert.equal(p.plan, "deposit");
  assert.deepEqual(p.travellers, [
    { kind: "adult", full_name: "Ann Guest", is_booker: true, not_staying: true },
    { kind: "adult", full_name: "Bob Guest", is_booker: false, not_staying: false },
  ]);
  assert.equal("contact" in p, false);
  assert.equal("hold" in p, false);
});

test("hold: children and infants carry their ages, adults carry none", async () => {
  const db = fakeDb({ create_web_booking: () => created });
  await createWebHold(db, guest({
    adults: 1, children: 1, infants: 1,
    travellers: [
      { kind: "infant", fullName: "Baby", age: 1, isBooker: false, notStaying: false },
      { kind: "adult", fullName: "Ann", isBooker: true, notStaying: false },
      { kind: "child", fullName: "Kid", age: 7, isBooker: false, notStaying: false },
    ],
  }), CTX);
  const p = db.calls.find((c) => c.name === "create_web_booking").args.p;
  assert.deepEqual(p.travellers, [
    { kind: "adult", full_name: "Ann", is_booker: true, not_staying: false },
    { kind: "infant", full_name: "Baby", age: 1, is_booker: false, not_staying: false },
    { kind: "child", full_name: "Kid", age: 7, is_booker: false, not_staying: false },
  ]);
});

test("hold: optional contact fields that were left out are not sent", async () => {
  const db = fakeDb({ create_web_booking: () => created });
  await createWebHold(db, guest({ contact: { name: "Ann", email: "ann@example.com", phone: "+971 50 123 4567" } }), CTX);
  const p = db.calls.find((c) => c.name === "create_web_booking").args.p;
  for (const key of ["nationality", "special_requests", "emergency_name", "emergency_phone", "pickup_address"]) assert.equal(key in p, false, key);
});

test("hold: the page's old hold is ignored: the re-quote never skips an own booking", async () => {
  const db = fakeDb({ create_web_booking: () => created, booking_by_ref: () => ({ id: OWN_ID, email: "ann@example.com", link_version: 3, status: "held" }) });
  const token = await signBookingLink(OWN_ID, 3);
  await createWebHold(db, guest({ hold: { ref: OWN_REF, t: token } }), CTX);
  assert.equal(db.names().includes("booking_by_ref"), false);
  assert.equal(db.calls.find((c) => c.name === "booking_context").args.p_own_booking, null);
});

test("hold: the limiter says no: hold_limit, and nothing else is called", async () => {
  const db = fakeDb({ claim_hold_slot: () => false, create_web_booking: () => created });
  const out = await createWebHold(db, guest(), CTX);
  assert.deepEqual(out.response, { ok: false, reasons: [{ code: "hold_limit" }] });
  assert.equal(out.bookingId, null);
  assert.deepEqual(db.names(), ["claim_hold_slot"]);
});

test("hold: a limiter answer that is not a boolean fails closed (thrown)", async () => {
  const db = fakeDb({ claim_hold_slot: () => null });
  await assert.rejects(() => createWebHold(db, guest(), CTX), /claim_hold_slot/);
});

test("hold: any quote reason refuses the hold with those reasons, and nothing is created", async () => {
  const db = fakeDb({ create_web_booking: () => created }, { blocked: ["2026-12-11"] });
  const out = await createWebHold(db, guest(), CTX);
  assert.deepEqual(out.response, { ok: false, reasons: [{ code: "blocked", nights: ["2026-12-11"] }] });
  assert.equal(db.names().includes("create_web_booking"), false);
  const noRate = fakeDb({ create_web_booking: () => created }, { stay: { base_rate_fils: null } });
  assert.deepEqual((await createWebHold(noRate, guest(), CTX)).response.reasons, [{ code: "no_rate" }]);
});

test("hold: a home pickup add-on needs the address (B-11); with it, it is stored", async () => {
  const withPickup = guest({ addons: [{ id: HOME_ITEM, qty: 1 }] });
  const db = fakeDb({ create_web_booking: () => created });
  const missing = await createWebHold(db, withPickup, CTX);
  assert.deepEqual(missing.response, { ok: false, reasons: [{ code: "invalid", field: "pickupAddress" }] });
  assert.equal(db.names().includes("create_web_booking"), false);

  const ok = fakeDb({ create_web_booking: () => created });
  const out = await createWebHold(ok, { ...withPickup, pickupAddress: "Villa 1, Dubai" }, CTX);
  assert.equal(out.response.ok, true);
  const p = ok.calls.find((c) => c.name === "create_web_booking").args.p;
  assert.equal(p.pickup_address, "Villa 1, Dubai");
  assert.deepEqual(p.lines.map((l) => [l.catalog_item_id, l.is_home_pickup, l.quantity]), [[HOME_ITEM, true, 1]]);
});

test("hold: the database's own refusals come back as reasons", async () => {
  for (const reason of ["sold_out", "blocked", "stay_unavailable", "settings_missing", "settings_changed", "below_minimum_charge"]) {
    const db = fakeDb({ create_web_booking: () => ({ ok: false, reason }) });
    const out = await createWebHold(db, guest(), CTX);
    assert.deepEqual(out.response, { ok: false, reasons: [{ code: reason }] }, reason);
    assert.equal(out.bookingId, null);
  }
  const odd = fakeDb({ create_web_booking: () => ({ ok: false, reason: "something_new" }) });
  assert.deepEqual((await createWebHold(odd, guest(), CTX)).response.reasons, [{ code: "unavailable" }]);
});

test("hold: a payload the database calls invalid is invalid with its field; any other error is thrown", async () => {
  const invalid = fakeDb({ create_web_booking: () => ({ __error: { message: "almar:invalid", details: '{"field":"travellers"}' } }) });
  const out = await createWebHold(invalid, guest(), CTX);
  assert.deepEqual(out.response, { ok: false, reasons: [{ code: "invalid", field: "travellers" }] });
  const noField = fakeDb({ create_web_booking: () => ({ __error: { message: "almar:invalid", details: "not json" } }) });
  assert.deepEqual((await createWebHold(noField, guest(), CTX)).response.reasons, [{ code: "invalid" }]);
  const broken = fakeDb({ create_web_booking: () => ({ __error: { message: "connection reset" } }) });
  await assert.rejects(() => createWebHold(broken, guest(), CTX), /create_web_booking/);
});

test("hold: a malformed success answer is thrown, never signed", async () => {
  for (const bad of [{ ok: true }, { ...created, ref: "nope" }, { ...created, booking_id: 5 }, { ...created, link_version: "1" }, null]) {
    const db = fakeDb({ create_web_booking: () => bad });
    await assert.rejects(() => createWebHold(db, guest(), CTX), /create_web_booking/);
  }
});

test("hold: a hold without the link secret is refused rather than answered without a link", async () => {
  const saved = process.env.BOOKING_LINK_SECRET;
  delete process.env.BOOKING_LINK_SECRET;
  try {
    const db = fakeDb({ create_web_booking: () => created });
    await assert.rejects(() => createWebHold(db, guest(), CTX), /secret/);
  } finally {
    process.env.BOOKING_LINK_SECRET = saved;
  }
});

// ---------------------------------------------------------------- holdStatus, liveGate

test("holdStatus: the HTTP status of a hold answer", () => {
  assert.equal(holdStatus({ ok: true, ref: OWN_REF, holdExpiresAt: "x", linkToken: "y", breakdown: {} }), 200);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "sold_out" }] }), 409);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "blocked" }] }), 409);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "hold_limit" }] }), 429);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "invalid", field: "x" }] }), 400);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "unavailable" }] }), 503);
});

test("liveGate: Stripe is TEST unless the key says live, and live stays closed while the terms are a placeholder (B-13)", () => {
  assert.deepEqual(liveGate(undefined, true), { isTest: true, open: true });
  assert.deepEqual(liveGate("sk_test_abc", true), { isTest: true, open: true });
  assert.deepEqual(liveGate("rk_live_abc", true), { isTest: true, open: true }, "only sk_live_ is live; anything else is TEST");
  assert.deepEqual(liveGate("sk_live_abc", true), { isTest: false, open: false });
  assert.deepEqual(liveGate("sk_live_abc", false), { isTest: false, open: true });
  assert.deepEqual(liveGate("  sk_live_abc ", true), { isTest: false, open: false }, "a key with spaces is still read as live");
});

// ---------------------------------------------------------------- releaseWebHold

const heldRow = { id: OWN_ID, email: "ann@example.com", link_version: 3, status: "held" };

test("release: a valid token drops the held booking as the guest and returns the sessions to close", async () => {
  const token = await signBookingLink(OWN_ID, 3);
  const db = fakeDb({ booking_by_ref: () => heldRow, booking_drop_hold: () => ({ dropped: true, closed_sessions: ["cs_1", "cs_2"] }) });
  const out = await releaseWebHold(db, { ref: OWN_REF, t: token });
  assert.deepEqual(out, { ok: true, dropped: true, sessionIds: ["cs_1", "cs_2"] });
  assert.deepEqual(db.calls.find((c) => c.name === "booking_drop_hold").args, { p_booking: OWN_ID, p_actor: "guest" });
});

test("release: a booking that is not held has nothing to release: still ok, no sessions", async () => {
  const token = await signBookingLink(OWN_ID, 3);
  const db = fakeDb({ booking_by_ref: () => ({ ...heldRow, status: "deposit_paid" }), booking_drop_hold: () => ({ dropped: false, closed_sessions: [] }) });
  assert.deepEqual(await releaseWebHold(db, { ref: OWN_REF, t: token }), { ok: true, dropped: false, sessionIds: [] });
});

test("release: no token, a wrong token or an unknown reference is refused and drops nothing", async () => {
  const wrongVersion = await signBookingLink(OWN_ID, 2);
  for (const input of [
    { ref: OWN_REF },
    { ref: OWN_REF, t: "A".repeat(43) },
    { ref: OWN_REF, t: wrongVersion },
    { ref: "ALMAR-AAAAAA", t: await signBookingLink(OWN_ID, 3) },
    { ref: "nope", t: "A".repeat(43) },
  ]) {
    const db = fakeDb({ booking_by_ref: (a) => (a.p_ref === OWN_REF ? heldRow : null), booking_drop_hold: () => ({ dropped: true, closed_sessions: [] }) });
    assert.deepEqual(await releaseWebHold(db, input), { ok: false }, JSON.stringify(input));
    assert.equal(db.names().includes("booking_drop_hold"), false, JSON.stringify(input));
  }
});

test("release: without a token, a signed-in guest with the booking's email may release it", async () => {
  const db = fakeDb({ booking_by_ref: () => heldRow, booking_drop_hold: () => ({ dropped: true, closed_sessions: [] }) });
  assert.deepEqual(await releaseWebHold(db, { ref: OWN_REF }, { readSession: async () => ({ email: "Ann@Example.com" }) }), { ok: true, dropped: true, sessionIds: [] });
  const other = fakeDb({ booking_by_ref: () => heldRow, booking_drop_hold: () => ({ dropped: true, closed_sessions: [] }) });
  assert.deepEqual(await releaseWebHold(other, { ref: OWN_REF }, { readSession: async () => ({ email: "bob@example.com" }) }), { ok: false });
});

test("release: without the link secret nothing verifies, and a lookup error is thrown for a 503", async () => {
  const token = await signBookingLink(OWN_ID, 3);
  const saved = process.env.BOOKING_LINK_SECRET;
  delete process.env.BOOKING_LINK_SECRET;
  try {
    const db = fakeDb({ booking_by_ref: () => heldRow, booking_drop_hold: () => ({ dropped: true, closed_sessions: [] }) });
    assert.deepEqual(await releaseWebHold(db, { ref: OWN_REF, t: token }), { ok: false });
  } finally {
    process.env.BOOKING_LINK_SECRET = saved;
  }
  const broken = fakeDb({ booking_by_ref: () => ({ __error: { message: "down" } }) });
  await assert.rejects(() => releaseWebHold(broken, { ref: OWN_REF, t: token }), /booking_by_ref/);
  const dropBroken = fakeDb({ booking_by_ref: () => heldRow, booking_drop_hold: () => ({ __error: { message: "down" } }) });
  await assert.rejects(() => releaseWebHold(dropBroken, { ref: OWN_REF, t: token }), /booking_drop_hold/);
});

// ---------------------------------------------------------------- the files themselves

test("server.ts is database-agnostic: no environment, no Next, no Supabase import, no key name", () => {
  const source = readFileSync("lib/booking/server.ts", "utf8");
  assert.doesNotMatch(source, /process\.env|from "next|@supabase|SERVICE_ROLE/);
});

test("the three routes: POST only, dynamic, no-store, the origin check, and no logging of the body", () => {
  for (const name of ["quote", "hold", "release"]) {
    const source = readFileSync(`app/api/booking/${name}/route.ts`, "utf8");
    assert.match(source, /export const dynamic = "force-dynamic"/, name);
    assert.match(source, /export async function POST/, name);
    assert.doesNotMatch(source, /export (async )?function (GET|PUT|PATCH|DELETE|HEAD)\b/, name);
    assert.match(source, /isAllowedPostOrigin/, name);
    assert.match(source, /no-store/, name);
    assert.doesNotMatch(source, /console\./, `${name}: nothing is logged`);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/, name);
  }
});
