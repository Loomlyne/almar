// Plan 06-06 Task 3: the package request: the one validator with the allowed-cities check, the email lines, the prepare hook on a fake
// admin, the WhatsApp message, and the route's refusals through 06-05's handleSiteRequestPost. Written, NOT run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { PACKAGE_REQUEST_FIELD: F, parsePackageRequest, packageEmailLines, preparePackageRequest, buildPackageAskMessage } = await loadTs("lib/site-requests/package.ts");
const { REQUEST_FIELD, validateSiteRequest } = await loadTs("lib/site-requests/validate.ts");
const { HONEYPOT_FIELDS } = await loadTs("lib/contact-inquiry.ts");
const { handleSiteRequestPost } = await loadTs("lib/site-requests/submit.ts");
const { REQUEST_ROUTE_KINDS, REQUEST_PREPARE } = await loadTs("lib/site-requests/route-kinds.ts");
const { PACKAGE_PAGE_COPY } = await loadTs("lib/copy/package-page.ts");
const { SITE_REQUESTS_COPY } = await loadTs("lib/copy/site-requests.ts");

const form = (values) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) for (const one of Array.isArray(value) ? value : [value]) params.append(key, one);
  return params;
};
const GOOD = { [F.tier]: "the-explorer", [F.name]: "Ana", [F.email]: "ana@example.com" };
const allow = { allowedCities: ["Cartagena", "Medellín"] };

test("the field names are 06-05's; the notes field is not a honeypot", () => {
  for (const [key, name] of Object.entries(F)) assert.equal(name, key === "notes" ? REQUEST_FIELD.tripNotes : REQUEST_FIELD[key], key);
  assert.equal(HONEYPOT_FIELDS.map((h) => h.toLowerCase()).includes(F.notes.toLowerCase()), false);
});

test("parsePackageRequest returns validateSiteRequest's errors unchanged and holds no field rule of its own", () => {
  const cases = [
    {},
    { [F.name]: "", [F.email]: "" },
    { [F.email]: "guest@" },
    { [F.phone]: "12ab" },
    { [F.from]: "2026-12-19", [F.to]: "2026-12-12" },
    { [F.guests]: "0" },
    { [F.guests]: "100" },
    { [F.cities]: ["a", "b", "c", "d", "e", "f", "g"] },
    { [F.notes]: "x".repeat(2001) },
  ];
  for (const extra of cases) {
    const values = form({ ...GOOD, ...extra });
    const ours = parsePackageRequest(values, allow);
    const theirs = validateSiteRequest("package", values);
    if (theirs.ok) assert.equal(ours.ok, true);
    else assert.deepEqual(ours, { ok: false, errors: theirs.errors }, JSON.stringify(extra));
  }
});

test("a good request is the payload's own keys; a city not offered is refused", () => {
  const ok = parsePackageRequest(form({ ...GOOD, [F.cities]: ["Cartagena"], [F.guests]: "2", [F.notes]: "two\nlines" }), allow);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.request, { name: "Ana", email: "ana@example.com", notes: "two\nlines", tier_slug: "the-explorer", guests: 2, cities: ["Cartagena"] });
  assert.deepEqual(parsePackageRequest(form({ ...GOOD, [F.cities]: ["Bogotá"] }), allow), { ok: false, errors: { cities: "invalid" } });
});

test("packageEmailLines: the stored name and the page address, cleaned; no money line", () => {
  const lines = packageEmailLines({ packageName: "The\r\nExplorer", pageUrl: "https://almarprivatejourney.com/en/journeys/the-explorer" });
  assert.deepEqual(lines, ["Package name: The Explorer", "Page: https://almarprivatejourney.com/en/journeys/the-explorer"]);
  assert.equal(/price|amount|aed|usd|\$|pay/i.test(lines.join("\n")), false);
});

// A fake of the admin's query builder, with the answers by table.
function fakeAdmin(tables, { failOn = null } = {}) {
  const reads = [];
  const from = (table) => {
    const filters = [];
    const answer = () => {
      reads.push({ table, filters });
      if (failOn === table) return { data: null, error: { message: "boom" } };
      const rows = (tables[table] ?? []).filter((row) => filters.every(([key, value]) => (Array.isArray(value) ? value.includes(row[key]) : row[key] === value)));
      return { data: rows, error: null };
    };
    const q = {
      select: () => q,
      eq: (key, value) => {
        filters.push([key, value]);
        return q;
      },
      in: (key, value) => {
        filters.push([key, value]);
        return q;
      },
      maybeSingle: async () => {
        const { data, error } = answer();
        return { data: data?.[0] ?? null, error };
      },
      then: (resolve) => resolve(answer()),
    };
    return q;
  };
  return { from, reads, rpc: async () => ({ data: { id: "r-1" }, error: null }) };
}

const TABLES = {
  journey_tiers: [
    { id: "t1", slug: "the-explorer", is_published: true },
    { id: "t2", slug: "hidden-one", is_published: false },
  ],
  journey_tier_translations: [
    { tier_id: "t1", locale: "en", name: "The Explorer" },
    { tier_id: "t1", locale: "ar", name: "المستكشف" },
  ],
  journey_tier_legs: [
    { tier_id: "t1", destination_id: "d1" },
    { tier_id: "t1", destination_id: "d2" },
  ],
  destinations: [
    { id: "d1", is_published: true },
    { id: "d2", is_published: false },
  ],
  destination_translations: [
    { destination_id: "d1", locale: "en", name: "Cartagena" },
    { destination_id: "d1", locale: "ar", name: "كارتاخينا" },
    { destination_id: "d2", locale: "en", name: "Hidden City" },
  ],
};

const prepare = (payload, admin = fakeAdmin(TABLES)) => preparePackageRequest("package", payload, admin);

test("preparePackageRequest: an unknown or hidden package saves nothing", async () => {
  assert.equal((await prepare({ tier_slug: "nope" })).ok, false);
  assert.equal((await prepare({ tier_slug: "hidden-one" })).ok, false);
});

test("preparePackageRequest: a city outside the legs, or on a hidden destination, is refused on `cities`; any language's name of a leg passes", async () => {
  assert.deepEqual(await prepare({ tier_slug: "the-explorer", cities: ["Bogotá"] }), { ok: false, errors: { cities: "invalid" } });
  assert.deepEqual(await prepare({ tier_slug: "the-explorer", cities: ["Hidden City"] }), { ok: false, errors: { cities: "invalid" } });
  assert.equal((await prepare({ tier_slug: "the-explorer", cities: ["كارتاخينا"] })).ok, true);
});

test("preparePackageRequest: the stored English name goes in the email, never a guest's; it only reads", async () => {
  const admin = fakeAdmin(TABLES);
  const out = await prepare({ tier_slug: "the-explorer", name: "The Forged Name" }, admin);
  assert.equal(out.ok, true);
  assert.deepEqual(out.emailLines, ["Package name: The Explorer", "Page: https://almarprivatejourney.com/en/journeys/the-explorer"]);
  assert.ok(admin.reads.every((read) => ["journey_tiers", "journey_tier_translations", "journey_tier_legs", "destinations", "destination_translations"].includes(read.table)));
});

test("preparePackageRequest: a failed read is a refusal, never a pass", async () => {
  for (const table of ["journey_tiers", "journey_tier_translations", "journey_tier_legs", "destinations", "destination_translations"]) {
    const out = await prepare({ tier_slug: "the-explorer", cities: ["Cartagena"] }, fakeAdmin(TABLES, { failOn: table }));
    assert.equal(out.ok, false, table);
  }
});

test("buildPackageAskMessage: the greeting with the name, then the address; the input type has no money field", () => {
  const url = "https://almarprivatejourney.com/ar/journeys/the-explorer";
  for (const locale of ["en", "ar", "es"]) {
    const message = buildPackageAskMessage({ name: "[Name]", pageUrl: url }, PACKAGE_PAGE_COPY[locale]);
    const [first, second] = message.split("\n");
    assert.ok(first.includes("[Name]"), locale);
    assert.equal(second, url);
  }
  assert.doesNotMatch(readFileSync("lib/site-requests/package.ts", "utf8").match(/export function buildPackageAskMessage[^\n]*/)[0], /price|amount|money|total/i);
});

test("the phone label is 06-05's in every language, and no line asks for money", () => {
  for (const locale of ["en", "ar", "es"]) {
    const copy = PACKAGE_PAGE_COPY[locale];
    assert.equal(copy.phone, SITE_REQUESTS_COPY[locale].plan.phone);
  }
  assert.equal(PACKAGE_PAGE_COPY.en.phone, "Phone / WhatsApp");
  assert.doesNotMatch(JSON.stringify({ ...PACKAGE_PAGE_COPY.en, reqIntro: "" }), /\b(pay|checkout|card|deposit)\b/i);
});

// ---- through 06-05's route ------------------------------------------------------------------------------------------------

const HOST = "https://almarprivatejourney.com";
const post = (values, headers = {}) => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) for (const one of Array.isArray(value) ? value : [value]) body.append(key, one);
  return new Request(`${HOST}/api/requests`, { method: "POST", headers: { origin: HOST, "content-type": "application/x-www-form-urlencoded", ...headers }, body: body.toString() });
};
const REQUEST = { [F.kind]: "package", [F.locale]: "en", ...GOOD };

function deps(admin) {
  const sent = [];
  return { sent, admin, limiter: null, send: async (email) => (sent.push(email), true), brand: async () => null, now: () => new Date("2026-10-30T08:00:00.000Z") };
}

const run = (request, d) => handleSiteRequestPost(request, d, REQUEST_ROUTE_KINDS, REQUEST_PREPARE);

function savingAdmin() {
  const admin = fakeAdmin(TABLES);
  const calls = [];
  admin.rpc = async (name, args) => {
    calls.push({ name, args });
    return { data: { id: "r-1" }, error: null };
  };
  return { admin, calls };
}

test("route: a good package request is saved as kind package, then emailed with the stored name; no booking and no money call", async () => {
  const { admin, calls } = savingAdmin();
  const d = deps(admin);
  const res = await run(post(REQUEST), d);
  assert.equal(res.status, 200);
  assert.deepEqual(calls.map((c) => c.name), ["submit_site_request"]);
  assert.equal(calls[0].args.p_kind, "package");
  assert.equal(calls[0].args.p_payload.tier_slug, "the-explorer");
  assert.equal(d.sent.length, 1);
  assert.match(d.sent[0].text, /Package name: The Explorer/);
  assert.match(d.sent[0].text, /Page: https:\/\/almarprivatejourney\.com\/en\/journeys\/the-explorer/);
  assert.equal(d.sent[0].replyTo, "ana@example.com");
});

for (const [name, request, status] of [
  ["a cross-site post", () => post(REQUEST, { origin: "https://evil.example" }), 403],
  ["a filled honeypot", () => post({ ...REQUEST, [HONEYPOT_FIELDS[0]]: "bot" }), 400],
  ["a hidden package", () => post({ ...REQUEST, [F.tier]: "hidden-one" }), 400],
  ["a bad field", () => post({ ...REQUEST, [F.email]: "guest@" }), 400],
  ["a city outside the route", () => post({ ...REQUEST, [F.cities]: ["Bogotá"] }), 400],
]) {
  test(`route: ${name} is refused and nothing is saved or emailed`, async () => {
    const { admin, calls } = savingAdmin();
    const d = deps(admin);
    const res = await run(request(), d);
    assert.equal(res.status, status);
    assert.deepEqual(calls, []);
    assert.deepEqual(d.sent, []);
  });
}

test("route: too many posts is 429, nothing saved", async () => {
  const { admin, calls } = savingAdmin();
  const d = { ...deps(admin), limiter: { limit: async () => ({ success: false }) } };
  const res = await run(post(REQUEST), d);
  assert.equal(res.status, 429);
  assert.deepEqual(calls, []);
});
