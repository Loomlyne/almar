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
