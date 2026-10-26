// Plan 04-03: trip-format helpers, the bookingStatus copy pin and the PAY-07 / re_ source rules (Task 1a); the trip link,
// the trip state, the client and the metadata (Tasks 3 and 4). Every amount is a symbolic test value in fils, not a price.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const fmt = await loadTs("lib/booking/trip-format.ts");
const { JOURNEY_COPY } = await loadTs("lib/copy/journey.ts");
const { formatBp, formatIsoDate, holdMsLeft, countdownParts, liveMinute, windowParts, uaeDateTime } = fmt;

test("formatBp: basis points as a percentage", () => {
  assert.equal(formatBp(500), "5");
  assert.equal(formatBp(525), "5.25");
  assert.equal(formatBp(550), "5.5");
  assert.equal(formatBp(0), "0");
  assert.throws(() => formatBp(-1));
  assert.throws(() => formatBp(5.5));
});

test("formatIsoDate: dd/mm/yyyy", () => {
  assert.equal(formatIsoDate("2026-11-02"), "02/11/2026");
  assert.throws(() => formatIsoDate("02/11/2026"));
  assert.throws(() => formatIsoDate("2026-11-02T10:00:00Z"));
});

test("holdMsLeft: capped at 30 minutes, floored at 0", () => {
  const now = Date.parse("2026-11-02T08:00:00Z");
  assert.equal(holdMsLeft("2026-11-02T08:10:00Z", now), 10 * 60 * 1000);
  assert.equal(holdMsLeft("2026-11-02T09:00:00Z", now), 30 * 60 * 1000);
  assert.equal(holdMsLeft("2026-11-02T07:00:00Z", now), 0);
  assert.equal(holdMsLeft("nonsense", now), 0);
});

test("countdownParts: seconds round up", () => {
  assert.deepEqual(countdownParts(1_781_000), { minutes: 29, seconds: 41, text: "29:41" });
  assert.equal(countdownParts(0).text, "00:00");
  assert.equal(countdownParts(1).text, "00:01");
});

test("liveMinute: 10, 5, 1 and the end", () => {
  assert.equal(liveMinute(10 * 60_000), 10);
  assert.equal(liveMinute(5 * 60_000), 5);
  assert.equal(liveMinute(60_000), 1);
  assert.equal(liveMinute(0), 0);
  assert.equal(liveMinute(7 * 60_000), null);
  assert.equal(liveMinute(30 * 60_000), null);
});

test("windowParts: largest whole unit", () => {
  assert.deepEqual(windowParts(35), { unit: "minute", count: 35 });
  assert.deepEqual(windowParts(1440), { unit: "day", count: 1 });
  assert.deepEqual(windowParts(2880), { unit: "day", count: 2 });
  assert.deepEqual(windowParts(120), { unit: "hour", count: 2 });
  assert.deepEqual(windowParts(90), { unit: "minute", count: 90 });
  assert.throws(() => windowParts(0));
  assert.throws(() => windowParts(1.5));
});

test("uaeDateTime: Asia/Dubai date and time from an instant", () => {
  assert.deepEqual(uaeDateTime("2026-11-02T08:05:00Z"), { date: "02/11/2026", time: "12:05" });
  assert.deepEqual(uaeDateTime("2026-11-02T20:30:00Z"), { date: "03/11/2026", time: "00:30" });
  assert.deepEqual(uaeDateTime("2026-12-31T21:15:00.000Z"), { date: "01/01/2027", time: "01:15" });
  assert.deepEqual(uaeDateTime("2026-11-02T20:00:00+00:00"), { date: "03/11/2026", time: "00:00" });
  assert.deepEqual(uaeDateTime("2026-11-02T20:30:00.123456+00:00"), { date: "03/11/2026", time: "00:30" });
  assert.deepEqual(uaeDateTime("2026-11-02T10:00:00+04:00"), { date: "02/11/2026", time: "10:00" });
  for (const iso of ["2026-11-02T08:05:00Z", "2026-11-02T20:30:00Z", "2026-12-31T21:15:00.000Z"]) {
    const r = uaeDateTime(iso);
    assert.match(r.date, /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/);
    assert.match(r.time, /^[0-9]{2}:[0-9]{2}$/);
  }
  for (const bad of ["2026-11-02", "2026-11-02T10:00:00", "", "not a date"]) {
    assert.throws(() => uaeDateTime(bad), bad);
  }
});

test("bookingStatus copy pin", () => {
  const keys = ["held", "awaiting_payment", "deposit_paid", "paid_in_full", "confirmed", "completed", "cancelled", "expired", "payBy"];
  assert.deepEqual(Object.keys(JOURNEY_COPY.en.bookingStatus).sort(), [...keys].sort());
  assert.deepEqual(JOURNEY_COPY.en.bookingStatus, {
    held: "Not sent yet",
    awaiting_payment: "Awaiting payment",
    deposit_paid: "Deposit paid",
    paid_in_full: "Paid in full",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    expired: "Request lapsed",
    payBy: "Pay by {date}, {time} UAE time",
  });
  assert.equal(JOURNEY_COPY.ar.bookingStatus.confirmed, "مؤكد");
  assert.equal(JOURNEY_COPY.es.bookingStatus.confirmed, "Confirmado");
  for (const l of ["en", "ar", "es"]) {
    assert.ok(JOURNEY_COPY[l].bookingStatus.payBy.includes("{date}"), l);
    assert.ok(JOURNEY_COPY[l].bookingStatus.payBy.includes("{time}"), l);
  }
});

const TRIP_PAGES = ["app/en/booking/trip/page.tsx", "app/ar/booking/trip/page.tsx", "app/es/booking/trip/page.tsx"];

test("source rules: PAY-07 words and re_", () => {
  const banned =
    /stripe|gift ?cards?|tarjetas? de regalo|بطاقة هدية|bnpl|buy now|pay later|paga después|ادفع لاحقا|tabby|tamara|klarna|afterpay|card number|cvc|cvv|apple pay|checkout/i;
  // Task 3: every file of app/booking/trip/ (readdirSync: trip-meta.ts, trip-screen.tsx and any later file) and the three
  // locale pages join the rule in the commit that rewrites the page.
  const files = [
    "lib/copy/journey.ts",
    "lib/booking/trip-format.ts",
    "lib/booking/trip-link.ts",
    "lib/booking/trip-state.ts",
    "lib/booking/client.ts",
    ...TRIP_PAGES,
  ];
  for (const dir of ["components/journey", "components/pages/stay-detail", "app/booking/trip"]) {
    for (const f of readdirSync(dir)) files.push(`${dir}/${f}`);
  }
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, banned, f);
    assert.ok(!text.includes("re_"), `${f} contains re_`);
  }
});

test("source rules: no money arithmetic", () => {
  // D-52: the trip's new files format the server's fils and never compute an amount. journey-bar.tsx and
  // date-range-panel.tsx keep their night-count Math.round and are not in this list.
  const files = [
    "components/journey/trip-layout.tsx",
    "components/journey/stay-summary-step.tsx",
    "components/journey/booking-reasons.tsx",
    "components/journey/travellers-step.tsx",
    "components/journey/request-step.tsx",
    "components/journey/hold-timer.tsx",
    "components/journey/addons-step.tsx",
    "components/pages/stay-detail/book-link.tsx",
    ...TRIP_PAGES,
  ];
  for (const f of readdirSync("app/booking/trip")) files.push(`app/booking/trip/${f}`);
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /\* ?100|\/ ?100|toFixed|Math\.round|parseFloat/, f);
  }
});

// ---------------------------------------------------------------- Tasks 3 and 4: link, state, client, metadata

const link = await loadTs("lib/booking/trip-link.ts");
const trip = await loadTs("lib/booking/trip-state.ts");
const client = await loadTs("lib/booking/client.ts");
const validate = await loadTs("lib/booking/validate.ts");
const meta = await loadTs("app/booking/trip/trip-meta.ts");

const { tripHref, tripLocaleHrefs, parseTripQuery, secondCityHref } = link;
const {
  TRIP_STATE_KEY,
  initialTripState,
  tripReducer,
  quoteBody,
  holdBody,
  holdBodyDraft,
  serializeTripState,
  readTripState,
  loadTripState,
  travellersErrors,
  travellerInputs,
  requestChoiceErrors,
  canRequest,
  tripNeedsPickup,
  isLinkToken,
} = trip;
const { postJson, postQuote, postHold, postRelease } = client;
const { parseQuoteRequest, parseHoldRequest, parseReleaseRequest } = validate;

const Q = { stay: "getsemani-colonial-house", from: "2026-11-02", to: "2026-11-06", adults: 2, children: 1, infants: 1 };
const PICKUP = "aaaaaaaa-1111-4222-8333-444455556666";
const UAE_SERVICE = "bbbbbbbb-1111-4222-8333-444455556666";
const EXPERIENCE = "cccccccc-1111-4222-8333-444455556666";
const REF = "ALMAR-7K3QH9";
const TOKEN = "A".repeat(43);

const offer = (id, over = {}) => ({
  id,
  slug: `addon-${id.slice(0, 4)}`,
  kind: "service",
  unit: "trip",
  isUae: false,
  isHomePickup: false,
  name: `Add-on ${id.slice(0, 4)}`,
  image: null,
  priceFils: 1000,
  ...over,
});
const OFFERS = [
  offer(PICKUP, { isUae: true, isHomePickup: true }),
  offer(UAE_SERVICE, { isUae: true }),
  offer(EXPERIENCE, { kind: "experience", unit: "person" }),
];
const breakdown = (over = {}) => ({
  nights: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"].map((night) => ({ night, rateFils: 1000, source: "base" })),
  nightCount: 4,
  nightsFils: 4000,
  lines: [],
  addonsFils: 0,
  subtotalFils: 4000,
  vatBp: 500,
  vatFils: 200,
  grandFils: 4200,
  depositBp: 3000,
  deposit: { dueNowFils: 1260, balanceFils: 2940, balanceDueDate: "2026-10-20" },
  depositBlock: null,
  full: { dueNowFils: 4200 },
  plan: "full",
  dueNowFils: 4200,
  balanceFils: 0,
  balanceDueDate: null,
  ...over,
});
const quoteOk = (over = {}) => ({
  ok: true,
  reasons: [],
  stay: { slug: Q.stay, title: "Stay one", destinationName: "Cartagena", image: null, maxGuests: 6, minNights: 2, infantsCount: false },
  offers: OFFERS,
  inclusions: [{ id: "kit", label: "Welcome kit" }],
  breakdown: breakdown(),
  ...over,
});
const holdOk = (over = {}) => ({
  ok: true,
  ref: REF,
  holdExpiresAt: "2026-11-01T08:30:00Z",
  linkToken: TOKEN,
  breakdown: breakdown(),
  transferWindowMinutes: 35,
  ...over,
});
const HOLD_NOW = Date.parse("2026-11-01T08:00:00Z");

const run = (s, ...actions) => actions.reduce(tripReducer, s);

/** Two adults, one child, one infant, every required field filled, the home pickup in the cart with its address. */
function filled() {
  return run(
    initialTripState(Q),
    { type: "quoted", quote: quoteOk() },
    { type: "contact", patch: { name: "Ann Guest", email: "ann@example.com", phone: "+971 50 123 4567" } },
    { type: "traveller", index: 1, patch: { fullName: "Bob Guest" } },
    { type: "traveller", index: 2, patch: { fullName: "Cy Guest", age: "7" } },
    { type: "traveller", index: 3, patch: { fullName: "Di Guest", age: "1" } },
    { type: "pickup", address: "Villa 1, Dubai" },
  );
}
const chosen = () => run(filled(), { type: "plan", plan: "full" }, { type: "airport", airport: "DXB" }, { type: "terms", accepted: true });
const heldState = () => run(chosen(), { type: "go", step: 2 }, { type: "go", step: 3 }, { type: "go", step: 4 }, { type: "held", hold: holdOk() });

// ---- trip-link

test("tripHref: every locale prefixed (job 21), the six keys in order", () => {
  const q = { stay: "getsemani-colonial-house", from: "2026-11-02", to: "2026-11-06", adults: 2, children: 1, infants: 0 };
  const query = "stay=getsemani-colonial-house&from=2026-11-02&to=2026-11-06&adults=2&children=1&infants=0";
  assert.equal(tripHref("ar", q), `/ar/booking/trip?${query}`);
  assert.equal(tripHref("en", q), `/en/booking/trip?${query}`);
  assert.deepEqual(tripLocaleHrefs(q), {
    en: `/en/booking/trip?${query}`,
    ar: `/ar/booking/trip?${query}`,
    es: `/es/booking/trip?${query}`,
  });
  assert.deepEqual(parseTripQuery(query), q);
  assert.deepEqual(parseTripQuery(`?${query}`), q);
  assert.deepEqual(parseTripQuery(new URLSearchParams(query)), q);
  assert.deepEqual(parseTripQuery(tripHref("es", q).split("?")[1]), q);
});

test("parseTripQuery: null for every query that is not exactly the six keys in shape", () => {
  const good = { stay: "stay-one", from: "2026-11-02", to: "2026-11-06", adults: "2", children: "0", infants: "0" };
  const qs = (over = {}, extra = "") => {
    const o = { ...good, ...over };
    const parts = Object.entries(o)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    return parts.join("&") + extra;
  };
  assert.notEqual(parseTripQuery(qs()), null);
  const bad = [
    qs({ stay: "Stay-One" }),
    qs({ stay: "stay_one" }),
    qs({ stay: "a".repeat(81) }),
    qs({ stay: "" }),
    qs({ from: "2026-11-31" }),
    qs({ from: "02/11/2026" }),
    qs({ to: "2026-11-02" }),
    qs({ to: "2026-11-01" }),
    qs({ adults: "0" }),
    qs({ adults: "100" }),
    qs({ adults: "+2" }),
    qs({ adults: "-1" }),
    qs({ adults: "2.0" }),
    qs({ adults: "02" }),
    qs({ children: "100" }),
    qs({ infants: "-1" }),
    qs({ infants: undefined }),
    qs({}, "&adults=3"),
    qs({}, "&t=abc"),
    qs({}, "&where=Cartagena"),
    "where=Cartagena&check-in=2026-11-02&check-out=2026-11-06&adults=2&children=0&infants=0",
    "",
  ];
  for (const b of bad) assert.equal(parseTripQuery(b), null, b);
});

test("secondCityHref: greeting, dates, the reference only when given, the ask; no amount, no token", () => {
  const copy = JOURNEY_COPY.en.summary.message;
  const base = { locale: "en", title: "Stay one", destinationName: "Cartagena", from: "2026-11-02", to: "2026-11-06" };
  const decode = (href) => {
    assert.ok(href.startsWith("https://wa.me/971563883302?text="), href);
    assert.doesNotMatch(href, /[?&]t=/);
    return decodeURIComponent(href.split("?text=")[1]);
  };
  assert.deepEqual(decode(secondCityHref(base, copy)).split("\n"), [
    "Hello ALMAR, I am booking Stay one in Cartagena.",
    "Dates: 02/11/2026 to 06/11/2026",
    "I would also like to visit another destination.",
  ]);
  const withRef = decode(secondCityHref({ ...base, ref: REF }, copy));
  assert.deepEqual(withRef.split("\n")[2], `My reference: ${REF}`);
  assert.equal(withRef.split("\n").length, 4);
  assert.equal(decode(secondCityHref({ ...base, ref: "not-a-ref" }, copy)).split("\n").length, 3);
  for (const text of [withRef]) {
    assert.doesNotMatch(text, /AED|fils|t=|linkToken/);
    assert.equal(text.includes(TOKEN), false);
  }
});

// ---- trip-state: Task 3

test("initialTripState: step 1, nothing chosen, one empty line per guest, the booker staying", () => {
  const s = initialTripState(Q);
  assert.equal(TRIP_STATE_KEY, "almar-trip");
  assert.equal(s.step, 1);
  assert.deepEqual(s.addons, {});
  assert.equal(s.addonsTouched, false);
  assert.deepEqual(Object.values(s.contact), ["", "", "", "", "", "", ""]);
  assert.deepEqual(
    s.travellers.map((l) => l.kind),
    ["adult", "adult", "child", "infant"],
  );
  assert.ok(s.travellers.every((l) => l.fullName === "" && l.age === ""));
  assert.equal(s.bookerStays, true);
  assert.equal(s.plan, null);
  assert.equal(s.airport, null);
  assert.equal(s.terms, false);
  assert.equal(s.hold, null);
  assert.equal(s.ended, false);
  assert.equal(s.closed, false);
});

test("tripReducer: the first ok quote adds the home pickup only (D-48); setAddon touches; qty 0 removes", () => {
  const s0 = initialTripState(Q);
  const s1 = tripReducer(s0, { type: "quoted", quote: quoteOk() });
  assert.deepEqual(s1.addons, { [PICKUP]: 1 }, "home pickup 1, the UAE service and the experience 0");
  const s2 = tripReducer(s1, { type: "quoted", quote: quoteOk() });
  assert.equal(s2.addons, s1.addons, "an unchanged default keeps its reference (no re-quote loop)");
  const refused = tripReducer(s0, { type: "quoted", quote: quoteOk({ ok: false, reasons: [{ code: "sold_out", nights: ["2026-11-02"] }] }) });
  assert.deepEqual(refused.addons, {}, "a refused quote adds nothing");

  const s3 = run(s1, { type: "setAddon", id: EXPERIENCE, qty: 2 });
  assert.equal(s3.addonsTouched, true);
  assert.deepEqual(s3.addons, { [PICKUP]: 1, [EXPERIENCE]: 2 });
  const s4 = run(s3, { type: "setAddon", id: PICKUP, qty: 0 }, { type: "quoted", quote: quoteOk() });
  assert.deepEqual(s4.addons, { [EXPERIENCE]: 2 }, "once touched, a quote never re-adds the pickup");
  for (const bad of [{ id: "x", qty: 1 }, { id: EXPERIENCE, qty: -1 }, { id: EXPERIENCE, qty: 1.5 }, { id: EXPERIENCE, qty: 100 }]) {
    assert.equal(tripReducer(s3, { type: "setAddon", ...bad }), s3, JSON.stringify(bad));
  }
});

test("tripReducer: go forward only on an ok quote, back always while not held", () => {
  const s0 = initialTripState(Q);
  assert.equal(tripReducer(s0, { type: "go", step: 2 }), s0, "no quote yet");
  const closedQuote = quoteOk({ ok: false, reasons: [{ code: "requests_closed" }] });
  const closed = tripReducer(s0, { type: "quoted", quote: closedQuote });
  assert.equal(closed.closed, true);
  assert.equal(tripReducer(closed, { type: "go", step: 2 }).step, 1, "requests closed stops at step 1 (Q-12)");
  const s1 = run(s0, { type: "quoted", quote: quoteOk() }, { type: "go", step: 2 }, { type: "go", step: 3 });
  assert.equal(s1.step, 3);
  assert.equal(tripReducer(s1, { type: "go", step: 1 }).step, 1);
});

test("tripReducer: a quote without a deposit resets a chosen deposit; the closed action keeps the hold and is idempotent", () => {
  const s1 = run(filled(), { type: "plan", plan: "deposit" });
  assert.equal(s1.plan, "deposit");
  const noDeposit = quoteOk({ breakdown: breakdown({ deposit: null, depositBlock: "too_close_to_arrival" }) });
  const s2 = tripReducer(s1, { type: "quoted", quote: noDeposit });
  assert.equal(s2.plan, null);
  assert.equal(tripReducer(s2, { type: "plan", plan: "deposit" }).plan, null, "deposit refused while unavailable");
  assert.equal(tripReducer(s2, { type: "plan", plan: "full" }).plan, "full");

  const held = heldState();
  const c1 = tripReducer(held, { type: "closed" });
  assert.equal(c1.closed, true);
  assert.deepEqual(c1.hold, held.hold);
  assert.deepEqual(c1.contact, held.contact);
  assert.deepEqual(c1.travellers, held.travellers);
  assert.equal(c1.plan, held.plan);
  assert.equal(c1.airport, held.airport);
  assert.equal(tripReducer(c1, { type: "closed" }), c1, "idempotent");
});

test("quoteBody: the query, add-ons above 0 sorted by id, the plan or full, the locale, the hold only while held", () => {
  const s = run(filled(), { type: "setAddon", id: EXPERIENCE, qty: 2 }, { type: "setAddon", id: UAE_SERVICE, qty: 1 });
  const body = quoteBody(s, "ar");
  assert.deepEqual(body, {
    ...Q,
    addons: [
      { id: PICKUP, qty: 1 },
      { id: UAE_SERVICE, qty: 1 },
      { id: EXPERIENCE, qty: 2 },
    ],
    plan: "full",
    locale: "ar",
  });
  assert.equal("hold" in body, false);
  assert.equal(quoteBody(run(s, { type: "plan", plan: "deposit" }), "en").plan, "deposit");
  const held = quoteBody(heldState(), "es");
  assert.deepEqual(held.hold, { ref: REF, t: TOKEN });
  for (const b of [body, held, quoteBody(initialTripState(Q), "en")]) {
    const parsed = parseQuoteRequest(JSON.parse(JSON.stringify(b)));
    assert.equal(parsed.ok, true, JSON.stringify(parsed));
  }
});

test("storage: the stored keys, no amount, no terms, a round trip, and null for anything else", () => {
  const s = run(heldState());
  const text = serializeTripState(s);
  const raw = JSON.parse(text);
  assert.deepEqual(Object.keys(raw), ["v", "query", "step", "addons", "addonsTouched", "contact", "bookerStays", "travellers", "pickup", "plan", "airport", "hold"]);
  assert.doesNotMatch(text, /Fils|price|amount|terms/i);
  assert.deepEqual(raw.hold, { ref: REF, linkToken: TOKEN, holdExpiresAt: "2026-11-01T08:30:00Z", transferWindowMinutes: 35 });

  const back = readTripState(text, Q);
  for (const key of ["step", "addons", "addonsTouched", "contact", "bookerStays", "travellers", "pickup", "plan", "airport", "hold"]) {
    assert.deepEqual(back[key], s[key], key);
  }
  assert.equal(back.quote, null);
  assert.equal(back.terms, false, "the terms box is never restored");

  const edit = (fn) => {
    const r = JSON.parse(text);
    fn(r);
    return JSON.stringify(r);
  };
  const bad = [
    null,
    "",
    "not json",
    "[]",
    edit((r) => (r.v = 2)),
    edit((r) => (r.extra = 1)),
    edit((r) => delete r.pickup),
    edit((r) => (r.query.adults = 3)),
    edit((r) => (r.query.extra = 1)),
    edit((r) => (r.step = 5)),
    edit((r) => (r.addons = { "not-a-uuid": 1 })),
    edit((r) => (r.addons = { [EXPERIENCE]: 100 })),
    edit((r) => (r.addons = { [EXPERIENCE]: 1.5 })),
    edit((r) => (r.contact.extra = "x")),
    edit((r) => (r.contact.name = 5)),
    edit((r) => r.travellers.pop()),
    edit((r) => (r.travellers[2].kind = "adult")),
    edit((r) => (r.travellers[0].isBooker = true)),
    edit((r) => (r.plan = "half")),
    edit((r) => (r.airport = "LHR")),
    edit((r) => (r.hold.ref = "ALMAR-0000OO")),
    edit((r) => (r.hold.linkToken = "short")),
    edit((r) => (r.hold.holdExpiresAt = "2026-11-01T08:30:00")),
    edit((r) => (r.hold.transferWindowMinutes = 0)),
    edit((r) => (r.hold.extra = 1)),
  ];
  for (const b of bad) assert.equal(readTripState(b, Q), null, String(b));
  assert.equal(readTripState(text, { ...Q, stay: "another-stay" }), null, "another URL's trip");
  const unheld = run(chosen(), { type: "go", step: 2 }, { type: "go", step: 3 }, { type: "go", step: 4 });
  const reread = readTripState(serializeTripState(unheld), Q);
  assert.equal(reread.step, 3, "Request without a hold comes back on Travellers (the terms box is ticked again there)");
  assert.equal(reread.holdAttempt, 0, "a reload asks for no hold by itself");
  assert.deepEqual(loadTripState(Q), initialTripState(Q), "no window: a fresh trip");
});

// ---- trip-state: Task 4

test("travellersErrors: every failing field at once, keyed like parseHoldRequest", () => {
  const empty = run(initialTripState(Q), { type: "quoted", quote: quoteOk() });
  assert.deepEqual(travellersErrors(empty), {
    "contact.name": "required",
    "contact.email": "required",
    "contact.phone": "required",
    "travellers.0.fullName": "required",
    "travellers.1.fullName": "required",
    "travellers.2.fullName": "required",
    "travellers.2.age": "required",
    "travellers.3.fullName": "required",
    "travellers.3.age": "required",
    pickupAddress: "required",
  });
  assert.deepEqual(travellersErrors(filled()), {});
  const wrong = run(
    filled(),
    { type: "contact", patch: { email: "ann@", phone: "12", nationality: "n".repeat(61), emergencyPhone: "call me" } },
    { type: "traveller", index: 2, patch: { age: "2" } },
    { type: "traveller", index: 3, patch: { age: "3" } },
    { type: "pickup", address: "p".repeat(301) },
  );
  assert.deepEqual(travellersErrors(wrong), {
    "contact.email": "email",
    "contact.phone": "phone",
    "contact.nationality": "tooLong",
    "contact.emergencyPhone": "phone",
    "travellers.2.age": "age",
    "travellers.3.age": "age",
    pickupAddress: "tooLong",
  });
  const noPickup = run(filled(), { type: "setAddon", id: PICKUP, qty: 0 }, { type: "pickup", address: "" });
  assert.equal(tripNeedsPickup(noPickup), false);
  assert.equal("pickupAddress" in travellersErrors(noPickup), false, "no home pickup in the cart, no address");
});

test("travellersErrors parity: empty exactly when parseHoldRequest accepts the body, else its field is one of the keys", () => {
  const forms = [
    ["valid", (s) => s],
    ["name blank", (s) => run(s, { type: "contact", patch: { name: "  " } })],
    ["email", (s) => run(s, { type: "contact", patch: { email: "nope" } })],
    ["phone", (s) => run(s, { type: "contact", patch: { phone: "12 34" } })],
    ["nationality long", (s) => run(s, { type: "contact", patch: { nationality: "n".repeat(61) } })],
    ["special requests long", (s) => run(s, { type: "contact", patch: { specialRequests: "s".repeat(1001) } })],
    ["emergency name long", (s) => run(s, { type: "contact", patch: { emergencyName: "e".repeat(121) } })],
    ["emergency phone", (s) => run(s, { type: "contact", patch: { emergencyPhone: "abc" } })],
    ["guest name blank", (s) => run(s, { type: "traveller", index: 1, patch: { fullName: "" } })],
    ["booker line long", (s) => run(s, { type: "traveller", index: 0, patch: { fullName: "b".repeat(121) } })],
    ["child age 13", (s) => run(s, { type: "traveller", index: 2, patch: { age: "13" } })],
    ["infant age blank", (s) => run(s, { type: "traveller", index: 3, patch: { age: "" } })],
    ["not staying", (s) => run(s, { type: "bookerStays", stays: false }, { type: "traveller", index: 0, patch: { fullName: "Eve Guest" } })],
    ["optional fields filled", (s) => run(s, { type: "contact", patch: { nationality: "Colombian", specialRequests: "Late arrival", emergencyName: "Joe", emergencyPhone: "+57 300 123 4567" } })],
    ["pickup long", (s) => run(s, { type: "pickup", address: "p".repeat(301) })],
  ];
  for (const [name, form] of forms) {
    const s = form(filled());
    const errors = travellersErrors(s);
    const parsed = parseHoldRequest(JSON.parse(JSON.stringify(holdBodyDraft(s, "en", "full", "DXB"))));
    assert.equal(Object.keys(errors).length === 0, parsed.ok, `${name}: ${JSON.stringify(errors)} / ${JSON.stringify(parsed)}`);
    if (!parsed.ok) assert.ok(parsed.reasons[0].field in errors, `${name}: ${parsed.reasons[0].field}`);
  }
  for (const [phone, ok] of [
    ["+971 50 123 4567", true],
    ["1234567", true],
    ["+(12) 345-678", true],
    ["1".repeat(20), true],
    ["123456", false],
    ["1".repeat(21), false],
    ["++1234567", false],
    ["abc1234567", false],
    ["+() - () -", false],
  ]) {
    const s = run(filled(), { type: "contact", patch: { phone } });
    assert.equal("contact.phone" in travellersErrors(s), !ok, phone);
    assert.equal(parseHoldRequest(JSON.parse(JSON.stringify(holdBodyDraft(s, "en", "full", "DXB")))).ok, ok, phone);
  }
});

test("traveller lines: line 1 is the booker's own while they stay; I am not staying makes no line the booker (Q-05)", () => {
  const s = filled();
  assert.equal(s.travellers[0].fullName, "Ann Guest", "copied from the contact name");
  assert.deepEqual(travellerInputs(s).map((t) => t.isBooker), [true, false, false, false]);
  const renamed = run(s, { type: "contact", patch: { name: "Ann B" } });
  assert.equal(renamed.travellers[0].fullName, "Ann B", "follows until edited");
  const edited = run(renamed, { type: "traveller", index: 0, patch: { fullName: "Annie" } }, { type: "contact", patch: { name: "Ann C" } });
  assert.equal(edited.travellers[0].fullName, "Annie", "an edited line keeps its name");

  const away = run(s, { type: "bookerStays", stays: false });
  assert.equal(away.travellers[0].fullName, "", "line 1 is freed");
  const lines = travellerInputs(run(away, { type: "traveller", index: 0, patch: { fullName: "Eve Guest" } }));
  assert.ok(lines.every((t) => t.isBooker === false));
  for (const st of [s, away]) assert.ok(travellerInputs(st).every((t) => t.notStaying === false));
  assert.deepEqual(travellerInputs(s).map((t) => t.age), [undefined, undefined, 7, 1]);
});

test("go(4), Q-01 = B: clean Travellers fields and the three choices; otherwise showErrors and the step stays", () => {
  const atThree = run(initialTripState(Q), { type: "quoted", quote: quoteOk() }, { type: "go", step: 2 }, { type: "go", step: 3 });
  const tried = tripReducer(atThree, { type: "go", step: 4 });
  assert.equal(tried.step, 3);
  assert.equal(tried.showErrors, true);
  const noChoices = run(filled(), { type: "go", step: 2 }, { type: "go", step: 3 }, { type: "go", step: 4 });
  assert.equal(noChoices.step, 3, "the traveller fields alone are not enough: the choices end the Travellers step");
  assert.equal(noChoices.showErrors, true);
  assert.equal(noChoices.holdAttempt, 0, "no hold is asked for");
  const noTerms = run(chosen(), { type: "terms", accepted: false }, { type: "go", step: 2 }, { type: "go", step: 3 }, { type: "go", step: 4 });
  assert.equal(noTerms.step, 3);

  const ok = run(chosen(), { type: "go", step: 2 }, { type: "go", step: 3 }, { type: "go", step: 4 });
  assert.equal(ok.step, 4);
  assert.equal(ok.holdAttempt, 1, "entering Request without a hold asks for one hold");
  assert.equal(tripReducer(ok, { type: "go", step: 4 }), ok, "a second Continue or a re-render asks for nothing more");
  const again = run(ok, { type: "go", step: 3 }, { type: "go", step: 4 });
  assert.equal(again.holdAttempt, 2, "back and forward again: one new hold");
});

test("retryHold: only on Request, not held, requests open, the body valid", () => {
  const atFour = run(chosen(), { type: "go", step: 2 }, { type: "go", step: 3 }, { type: "go", step: 4 });
  const taken = tripReducer(atFour, { type: "refused", at: "hold", reasons: [{ code: "sold_out", nights: ["2026-11-02"] }] });
  const retried = tripReducer(taken, { type: "retryHold" });
  assert.equal(retried.holdAttempt, atFour.holdAttempt + 1);
  assert.equal(retried.refusal, null);
  const closed = tripReducer(atFour, { type: "refused", at: "hold", reasons: [{ code: "requests_closed" }] });
  assert.equal(tripReducer(closed, { type: "retryHold" }), closed, "disabled after requests_closed");
  const held = heldState();
  assert.equal(tripReducer(held, { type: "retryHold" }), held);
  const atThree = run(chosen(), { type: "go", step: 2 }, { type: "go", step: 3 });
  assert.equal(tripReducer(atThree, { type: "retryHold" }), atThree);
  const ended = tripReducer(held, { type: "ended" });
  assert.equal(tripReducer(ended, { type: "retryHold" }), ended, "an ended hold starts again from the stay or the Travellers step");
});

test("requestChoiceErrors and holdBody", () => {
  assert.deepEqual(requestChoiceErrors({ plan: null, airport: null, terms: false }), { plan: true, airport: true, terms: true });
  assert.deepEqual(requestChoiceErrors({ plan: "full", airport: "DXB", terms: true }), {});
  const noDeposit = { ...chosen(), plan: "deposit", quote: quoteOk({ breakdown: breakdown({ deposit: null, depositBlock: "no_due_days" }) }) };
  assert.deepEqual(requestChoiceErrors(noDeposit), { plan: true }, "deposit without a deposit counts as no plan");

  assert.equal(holdBody(initialTripState(Q), "en"), null);
  assert.equal(holdBody(filled(), "en"), null, "no choices yet");
  assert.equal(holdBody(run(chosen(), { type: "terms", accepted: false }), "en"), null, "terms box unticked");
  const body = holdBody(run(chosen(), { type: "contact", patch: { email: "  ann@example.com " } }), "es");
  assert.ok(body);
  assert.equal(body.termsAccepted, true);
  assert.equal(body.plan, "full");
  assert.equal(body.airport, "DXB");
  assert.equal(body.locale, "es");
  assert.equal(body.pickupAddress, "Villa 1, Dubai");
  assert.equal(body.contact.email, "ann@example.com");
  assert.equal("nationality" in body.contact, false, "a blank optional field is left out");
  assert.equal("hold" in body, false);
  assert.doesNotMatch(JSON.stringify(body), /Fils|price|amount|notStaying":true/);
  assert.equal(parseHoldRequest(JSON.parse(JSON.stringify(body))).ok, true);
  const noPickup = holdBody(run(chosen(), { type: "setAddon", id: PICKUP, qty: 0 }), "en");
  assert.equal("pickupAddress" in noPickup, false, "the address only when home pickup is in the cart");
  assert.equal(holdBody(heldState(), "en"), null, "never a second hold body while held");
});

test("held, the locks, released, ended", () => {
  const s = heldState();
  assert.equal(s.step, 4);
  assert.deepEqual(s.hold, { ref: REF, linkToken: TOKEN, holdExpiresAt: "2026-11-01T08:30:00Z", transferWindowMinutes: 35 });
  assert.deepEqual(s.holdBreakdown, breakdown());
  for (const action of [
    { type: "go", step: 3 },
    { type: "go", step: 1 },
    { type: "setAddon", id: EXPERIENCE, qty: 1 },
    { type: "plan", plan: "deposit" },
    { type: "airport", airport: "AUH" },
    { type: "terms", accepted: false },
    { type: "contact", patch: { name: "X" } },
    { type: "traveller", index: 1, patch: { fullName: "X" } },
    { type: "pickup", address: "X" },
    { type: "bookerStays", stays: false },
  ]) {
    assert.equal(tripReducer(s, action), s, JSON.stringify(action));
  }
  const freed = tripReducer(s, { type: "released", next: { type: "go", step: 3 } });
  assert.equal(freed.hold, null);
  assert.equal(freed.holdBreakdown, null);
  assert.equal(freed.step, 3);
  assert.equal(freed.terms, false, "the terms are ticked again for the next hold");
  assert.equal(freed.plan, "full");
  const changed = tripReducer(s, { type: "released", next: { type: "airport", airport: "SHJ" } });
  assert.equal(changed.airport, "SHJ");

  const over = tripReducer(s, { type: "ended" });
  assert.equal(over.hold, null);
  assert.equal(over.ended, true);
  assert.deepEqual(over.contact, s.contact);
  assert.deepEqual(over.travellers, s.travellers);
  assert.deepEqual(over.addons, s.addons);
  assert.equal(JSON.parse(serializeTripState(over)).hold, null, "the stored hold is cleared");
});

test("refused: requests_closed closes, a traveller field goes back to Travellers, an empty list clears", () => {
  const atFour = run(chosen(), { type: "go", step: 2 }, { type: "go", step: 3 }, { type: "go", step: 4 });
  const closed = tripReducer(atFour, { type: "refused", at: "hold", reasons: [{ code: "requests_closed" }] });
  assert.equal(closed.closed, true);
  assert.deepEqual(closed.refusal, { at: "hold", reasons: [{ code: "requests_closed" }] });
  for (const f of ["pickupAddress", "contact.email", "travellers.2.age", "airport", "termsAccepted"]) {
    const field = tripReducer(atFour, { type: "refused", at: "hold", reasons: [{ code: "invalid", field: f }] });
    assert.equal(field.step, 3, f);
    assert.equal(field.showErrors, true, f);
  }
  const taken = tripReducer(atFour, { type: "refused", at: "hold", reasons: [{ code: "sold_out", nights: ["2026-11-02"] }] });
  assert.equal(taken.step, 4);
  assert.equal(tripReducer(taken, { type: "refused", at: "hold", reasons: [] }).refusal, null);
  const open = tripReducer(heldState(), { type: "refused", at: "request", reasons: [{ code: "too_many_open" }] });
  assert.deepEqual(canRequest(open, HOLD_NOW), { ok: true }, "too_many_open does not disable Send request (Q-12)");
});

test("canRequest", () => {
  assert.deepEqual(canRequest(chosen(), HOLD_NOW), { ok: false, reason: "no_hold" });
  const s = heldState();
  assert.deepEqual(canRequest(s, HOLD_NOW), { ok: true });
  assert.deepEqual(canRequest(s, Date.parse("2026-11-01T08:30:00Z")), { ok: false, reason: "hold_ended" });
  assert.deepEqual(canRequest(tripReducer(s, { type: "ended" }), HOLD_NOW), { ok: false, reason: "hold_ended" });
  assert.deepEqual(canRequest(tripReducer(s, { type: "closed" }), HOLD_NOW), { ok: false, reason: "requests_closed" });
});

test("isLinkToken has the shape of validate.ts LINK_TOKEN", () => {
  for (const t of ["A".repeat(15), "A".repeat(16), "A".repeat(128), "A".repeat(129), "a_b-c".repeat(5), "a.b".repeat(8), ""]) {
    assert.equal(isLinkToken(t), parseReleaseRequest({ ref: REF, t }).ok, t);
  }
});

// ---- client

async function withFetch(impl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}
const answer = (status, json) => async () =>
  new Response(json === undefined ? "not json" : JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
const hang = (url, init) =>
  new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));

test("postJson: same-origin JSON POST, { status, json }, status 0 on a network error or a timeout", async () => {
  const calls = [];
  const res = await withFetch(
    async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
    () => postJson("/api/booking/quote", { a: 1 }),
  );
  assert.deepEqual(res, { status: 200, json: { ok: true } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/booking/quote");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.deepEqual(calls[0].init.headers, { "Content-Type": "application/json", Accept: "application/json" });
  assert.equal(calls[0].init.body, JSON.stringify({ a: 1 }));

  assert.deepEqual(await withFetch(answer(502), () => postJson("/api/booking/quote", {})), { status: 502, json: null });
  assert.deepEqual(
    await withFetch(async () => {
      throw new TypeError("network");
    }, () => postJson("/api/booking/quote", {})),
    { status: 0, json: null },
  );
  assert.deepEqual(await withFetch(hang, () => postJson("/api/booking/quote", {}, { timeoutMs: 10 })), { status: 0, json: null });
  const abort = new AbortController();
  const pending = withFetch(hang, () => postJson("/api/booking/quote", {}, { signal: abort.signal }));
  abort.abort();
  assert.deepEqual(await pending, { status: 0, json: null, aborted: true });
});

test("postQuote: the answer for a 200 of the right shape, else a refused quote with its reasons or unavailable", async () => {
  const body = quoteBody(filled(), "en");
  assert.deepEqual(await withFetch(answer(200, quoteOk()), () => postQuote(body)), quoteOk());
  const refused = (reasons) => ({ ok: false, reasons, stay: null, offers: [], inclusions: [], breakdown: null });
  const UNAV = [{ code: "unavailable" }];
  assert.deepEqual(await withFetch(answer(200, quoteOk({ breakdown: breakdown({ grandFils: "4200" }) })), () => postQuote(body)), refused(UNAV));
  assert.deepEqual(await withFetch(answer(200, quoteOk({ offers: [{ id: PICKUP }] })), () => postQuote(body)), refused(UNAV));
  assert.deepEqual(await withFetch(answer(200, { ...quoteOk(), breakdown: null }), () => postQuote(body)), refused(UNAV), "ok needs a price");
  assert.deepEqual(
    await withFetch(answer(400, { ok: false, reasons: [{ code: "invalid", field: "stay" }] }), () => postQuote(body)),
    refused([{ code: "invalid", field: "stay" }]),
  );
  assert.deepEqual(await withFetch(answer(503), () => postQuote(body)), refused(UNAV));
  assert.deepEqual(await withFetch(answer(403, { ok: false }), () => postQuote(body)), refused(UNAV));
  const mixed = { ...refused([{ code: "weird" }, { code: "sold_out", nights: ["2026-11-02"], extra: 1, min: "x" }]) };
  assert.deepEqual(await withFetch(answer(200, mixed), () => postQuote(body)), refused([{ code: "sold_out", nights: ["2026-11-02"] }]));
  const closed = quoteOk({ ok: false, reasons: [{ code: "requests_closed" }] });
  assert.deepEqual(await withFetch(answer(200, closed), () => postQuote(body)), closed, "requests closed keeps its price");
  const abort = new AbortController();
  abort.abort();
  assert.deepEqual(await withFetch(answer(200, quoteOk()), () => postQuote(body, abort.signal)), { aborted: true });
});

test("postHold and postRelease", async () => {
  const body = holdBody(chosen(), "en");
  assert.deepEqual(await withFetch(answer(200, holdOk()), () => postHold(body)), { status: 200, response: holdOk() });
  const UNAV = { ok: false, reasons: [{ code: "unavailable" }] };
  for (const bad of [holdOk({ ref: "ALMAR-1" }), holdOk({ linkToken: "x" }), holdOk({ holdExpiresAt: "soon" }), holdOk({ transferWindowMinutes: 0 }), holdOk({ breakdown: null })]) {
    assert.deepEqual(await withFetch(answer(200, bad), () => postHold(body)), { status: 200, response: UNAV }, JSON.stringify(bad));
  }
  for (const [status, reasons] of [
    [409, [{ code: "sold_out", nights: ["2026-11-02"] }]],
    [429, [{ code: "hold_limit" }]],
    [503, [{ code: "requests_closed" }]],
    [400, [{ code: "invalid", field: "contact.email" }]],
  ]) {
    assert.deepEqual(await withFetch(answer(status, { ok: false, reasons }), () => postHold(body)), { status, response: { ok: false, reasons } });
  }
  assert.deepEqual(await withFetch(answer(500), () => postHold(body)), { status: 500, response: UNAV });

  const sent = [];
  const ok = await withFetch(async (url, init) => {
    sent.push({ url, body: init.body });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }, () => postRelease({ ref: REF, t: TOKEN }));
  assert.deepEqual(ok, { ok: true });
  assert.deepEqual(sent, [{ url: "/api/booking/release", body: JSON.stringify({ ref: REF, t: TOKEN }) }]);
  assert.deepEqual(await withFetch(answer(404, { ok: false }), () => postRelease({ ref: REF, t: TOKEN })), { ok: true }, "404: not this guest's hold any more");
  assert.deepEqual(await withFetch(answer(503, { ok: false }), () => postRelease({ ref: REF, t: TOKEN })), { ok: false });
  assert.deepEqual(
    await withFetch(async () => {
      throw new TypeError("network");
    }, () => postRelease({ ref: REF, t: TOKEN })),
    { ok: false },
  );
});

// ---- metadata and source rules

test("tripMetadata: localised title, noindex, same-origin referrer, self canonical and hreflang (Q-06)", () => {
  const o = "https://almarprivatejourney.com";
  for (const l of ["en", "ar", "es"]) {
    assert.deepEqual(meta.tripMetadata(l), {
      title: JOURNEY_COPY[l].trip.title,
      robots: { index: false, follow: false },
      referrer: "same-origin",
      alternates: {
        canonical: `${o}/${l}/booking/trip`,
        languages: { en: `${o}/en/booking/trip`, ar: `${o}/ar/booking/trip`, es: `${o}/es/booking/trip`, "x-default": `${o}/en/booking/trip` },
      },
    });
  }
  const src = readFileSync("app/booking/trip/trip-meta.ts", "utf8");
  assert.equal(src.includes("use client"), false);
  assert.equal(src.includes("no-referrer"), false);
});

test("source rules: the trip modules keep the token out of URLs and the request call for 04-06", () => {
  const files = ["lib/booking/trip-link.ts", "lib/booking/trip-state.ts", "lib/booking/client.ts", ...TRIP_PAGES];
  for (const f of readdirSync("app/booking/trip")) files.push(`app/booking/trip/${f}`);
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.equal(text.includes("process.env"), false, `${f}: process.env`);
    assert.equal(text.includes("localStorage"), false, `${f}: localStorage`);
  }
  // The screen: the request call is 04-06's (the seam is an empty callback), no legacy query key is read, the
  // currency control stays off (Q-03) and the frame is the public one.
  const screen = readFileSync("app/booking/trip/trip-screen.tsx", "utf8");
  assert.equal(screen.includes("api/booking/request"), false);
  assert.equal(screen.split("\n").filter((line) => line.includes("onRequest={requestTrip}")).length, 1);
  assert.equal(screen.includes("currency="), false, "Q-03");
  assert.equal(screen.includes("notStaying: true"), false, "Q-05");
  // The components never see the link token and build no URL with it (cross-plan decision 8).
  for (const dir of ["components/journey", "components/pages/stay-detail"]) {
    for (const f of readdirSync(dir)) {
      const text = readFileSync(`${dir}/${f}`, "utf8");
      assert.equal(/linkToken|[?&]t=/.test(text), false, `${dir}/${f}: token`);
      assert.equal(/fetch\(|sessionStorage\.|localStorage\./.test(text) && /^(?:trip-layout|stay-summary-step|booking-reasons|travellers-step|request-step|hold-timer|addons-step|book-link)\.tsx$/.test(f), false, `${dir}/${f}: no fetch or storage in a presentational component`);
    }
  }
  const state = readFileSync("lib/booking/trip-state.ts", "utf8");
  assert.equal(state.includes("notStaying: true"), false, "Q-05");
  assert.equal(state.split("\n").filter((line) => line.includes("termsAccepted: true")).length, 1);
  assert.match(state, /type: "closed"/);
  const linkSrc = readFileSync("lib/booking/trip-link.ts", "utf8");
  assert.equal(/linkToken|[?&]t=/.test(linkSrc), false, "no token in a trip URL");
  const clientSrc = readFileSync("lib/booking/client.ts", "utf8");
  assert.equal(clientSrc.includes("api/booking/request"), false, "04-06 calls the request route");
  for (const p of ["/api/booking/quote", "/api/booking/hold", "/api/booking/release"]) assert.ok(clientSrc.includes(`"${p}"`), p);
  assert.match(clientSrc, /Record<ReasonCode, true>/);
});
