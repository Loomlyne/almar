// Plan 06-05 Task 3: the one validation of a site request. Written, not run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { validateSiteRequest, slotStart, REQUEST_FIELD: F, UAE_AIRPORTS, SITE_REQUEST_HONEYPOTS, SITE_REQUEST_BODY_LIMIT } = await loadTs("lib/site-requests/validate.ts");
const { HONEYPOT_FIELDS, honeypotTripped, INQUIRY_LIMITS } = await loadTs("lib/contact-inquiry.ts");

const form = (values) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    for (const one of Array.isArray(value) ? value : [value]) params.append(key, one);
  }
  return params;
};
const CONTACT = { [F.name]: "Ana", [F.email]: "ana@example.com" };

test("plan: name and email alone are enough", () => {
  assert.deepEqual(validateSiteRequest("plan", form(CONTACT)), { ok: true, payload: { name: "Ana", email: "ana@example.com" } });
});

test("plan: refuses from >= to, guests 0 or 100, an airport not listed, budget over 120, notes over 2000", () => {
  const errors = (extra) => {
    const out = validateSiteRequest("plan", form({ ...CONTACT, ...extra }));
    assert.equal(out.ok, false);
    return out.errors;
  };
  assert.equal(errors({ [F.from]: "2026-12-12", [F.to]: "2026-12-12" }).to, "invalid");
  assert.equal(errors({ [F.from]: "2026-12-12", [F.to]: "2026-12-05" }).to, "invalid");
  assert.equal(errors({ [F.from]: "2026-02-31" }).from, "invalid");
  assert.equal(errors({ [F.guests]: "0" }).guests, "invalid");
  assert.equal(errors({ [F.guests]: "100" }).guests, "invalid");
  assert.equal(errors({ [F.phone]: "-------" }).phone, "invalid");
  assert.equal(errors({ [F.airport]: "CDG" }).airport, "invalid");
  assert.equal(errors({ [F.budget]: "x".repeat(121) }).budget, "tooLong");
  assert.equal(errors({ [F.tripNotes]: "x".repeat(2001) }).notes, "tooLong");
});

test("plan: every field, in the 06-01 keys; budget stays the guest's words; UAE airports only", () => {
  assert.deepEqual([...UAE_AIRPORTS], ["DXB", "AUH", "SHJ"]);
  const out = validateSiteRequest(
    "plan",
    form({ ...CONTACT, [F.destination]: "Cartagena", [F.from]: "2026-12-12", [F.to]: "2026-12-19", [F.guests]: "2", [F.budget]: "around 20k", [F.airport]: "DXB", [F.tripNotes]: "line one\nline two", [F.phone]: "+971 50 000 0000" }),
  );
  assert.deepEqual(out, {
    ok: true,
    payload: { name: "Ana", email: "ana@example.com", phone: "+971 50 000 0000", notes: "line one\nline two", destination: "Cartagena", from: "2026-12-12", to: "2026-12-19", guests: 2, budget: "around 20k", airport: "DXB" },
  });
});

test("Arabic-Indic digits in phone and guests become ASCII", () => {
  const out = validateSiteRequest("plan", form({ ...CONTACT, [F.phone]: "٠٥٠١٢٣٤٥٦٧", [F.guests]: "٣" }));
  assert.equal(out.payload.phone, "0501234567");
  assert.equal(out.payload.guests, 3);
});

test("list: property type, city and message are required; phone optional", () => {
  const bare = validateSiteRequest("list", form(CONTACT));
  assert.deepEqual(bare.errors, { property_type: "required", city: "required", message: "required" });
  const good = validateSiteRequest("list", form({ ...CONTACT, [F.propertyType]: "Villa", [F.city]: "Cartagena", [F.propertyDetails]: "Four rooms" }));
  assert.deepEqual(good.payload, { name: "Ana", email: "ana@example.com", property_type: "Villa", city: "Cartagena", message: "Four rooms" });
});

test("consultation: name, email, phone, a :00 or :30 UTC start and a real zone", () => {
  const good = { ...CONTACT, [F.phone]: "+34 600 000 000", [F.slot]: "2026-11-03T10:30:00.000Z", [F.timeZone]: "Europe/Madrid", [F.callNotes]: "Hello" };
  assert.deepEqual(validateSiteRequest("consultation", form(good)).payload, {
    name: "Ana",
    email: "ana@example.com",
    phone: "+34 600 000 000",
    notes: "Hello",
    slot_start: "2026-11-03T10:30:00.000Z",
    time_zone: "Europe/Madrid",
  });
  assert.equal(validateSiteRequest("consultation", form({ ...good, [F.phone]: "" })).errors.phone, "required");
  assert.equal(validateSiteRequest("consultation", form({ ...good, [F.slot]: "2026-11-03T10:15:00.000Z" })).errors.slot_start, "invalid");
  assert.equal(validateSiteRequest("consultation", form({ ...good, [F.slot]: "tomorrow" })).errors.slot_start, "invalid");
  assert.equal(validateSiteRequest("consultation", form({ ...good, [F.timeZone]: "Mars/Olympus" })).errors.time_zone, "invalid");
  assert.equal(slotStart("2026-11-03T14:00:00+04:00"), "2026-11-03T10:00:00.000Z");
});

test("package: Tier becomes tier_slug by the slug rule; repeated Cities become cities, at most 50 of at most 120", () => {
  const good = validateSiteRequest("package", form({ ...CONTACT, [F.tier]: "grand-tour", [F.cities]: ["Bogotá", "Cartagena"] }));
  assert.deepEqual(good.payload, { name: "Ana", email: "ana@example.com", tier_slug: "grand-tour", cities: ["Bogotá", "Cartagena"] });
  assert.equal(validateSiteRequest("package", form(CONTACT)).errors.tier_slug, "required");
  assert.equal(validateSiteRequest("package", form({ ...CONTACT, [F.tier]: "Bad Slug" })).errors.tier_slug, "invalid");
  assert.equal(validateSiteRequest("package", form({ ...CONTACT, [F.tier]: "a", [F.cities]: Array(51).fill("x") })).errors.cities, "invalid");
  assert.equal(validateSiteRequest("package", form({ ...CONTACT, [F.tier]: "a", [F.cities]: Array(50).fill("x") })).ok, true);
  assert.equal(validateSiteRequest("package", form({ ...CONTACT, [F.tier]: "a", [F.cities]: ["x".repeat(121)] })).errors.cities, "tooLong");
});

test("SITE-12: no field name is a honeypot name, by any case; each of the 11 traps refuses", () => {
  assert.equal(SITE_REQUEST_HONEYPOTS, HONEYPOT_FIELDS);
  const traps = new Set(HONEYPOT_FIELDS);
  for (const name of Object.values(F)) assert.equal(traps.has(name.toLowerCase()), false, name);
  for (const trap of HONEYPOT_FIELDS) assert.equal(honeypotTripped((name) => (name === trap ? "x" : null)), true, trap);
});

test("the body cap is the contact route's", () => {
  assert.equal(SITE_REQUEST_BODY_LIMIT, INQUIRY_LIMITS.body);
});
