// Plan 04-06, Task 4 (RED first): the signed-in guest's /bookings list. `toGuestCards` (tabs, order, display strings),
// `loadGuestBookings` on a fake rpc (whose email is read), the list copy, and source rules for the page and the lib.
// Every amount is a symbolic test value in fils (1 AED = 100 fils), never a real price; references and dates are
// fixtures. Today is the fixed Dubai day "2026-11-10".
//
// Owner signed the recommended options on 2026-10-27: P6-07 option 1 (a Paid line from
// paidFils above 0) and P6-09 option 1 (Upcoming through the departure day). After his signature only the lines marked
// P6-07 / P6-09 change.
//
// Owner rule (2026-10-21, "No test. Direct, no test."): written, not run by the executor.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { toGuestCards, loadGuestBookings } = await loadTs("lib/booking/guest-list.ts");
const { GUEST_BOOKINGS_COPY } = await loadTs("lib/copy/guest-bookings.ts");
const { JOURNEY_COPY } = await loadTs("lib/copy/journey.ts");

const PAGE = "app/[locale]/bookings/page.tsx";
const LIB = "lib/booking/guest-list.ts";
const TODAY = "2026-11-10";
const DEADLINE = "2026-11-12T16:00:00+04:00"; // 12/11/2026 16:00 in the UAE
const REFS = ["ALMAR-7K3QH9", "ALMAR-2B3C4D", "ALMAR-5E6F7G", "ALMAR-8H9J2K", "ALMAR-3M4N5P", "ALMAR-6Q7R8S", "ALMAR-9T2U3V", "ALMAR-4W5X6Y"];

/** A GuestBookingSummary as listGuestBookings returns it. */
const summary = (over = {}) => ({
  ref: REFS[0],
  status: "awaiting_payment",
  stayTitle: "[Stay name]",
  destinationName: "[Destination]",
  image: { src: "https://media.example.test/stays/stay-one/hero.webp", alt: "[Alt text]" },
  arrive: "2026-11-17",
  leave: "2026-11-20",
  plan: "deposit",
  grandFils: 346500,
  paidFils: 0,
  stillDueFils: 346500,
  deadline: DEADLINE,
  ...over,
});

const cards = (items, locale = "en") => toGuestCards(items, { locale, today: TODAY });
const one = (over, locale = "en") => {
  const list = cards([summary(over)], locale);
  assert.equal(list.length, 1);
  return list[0];
};

// ---------------------------------------------------------------- toGuestCards: tabs

test("tabs: awaiting_payment leaving 2026-11-20 is Upcoming", () => {
  assert.equal(one({ status: "awaiting_payment", arrive: "2026-11-17", leave: "2026-11-20" }).tab, "upcoming");
});

test("tabs: confirmed leaving today (2026-11-10) is still Upcoming (departure day)", () => {
  assert.equal(one({ status: "confirmed", arrive: "2026-11-07", leave: "2026-11-10" }).tab, "upcoming");
});

test("tabs: confirmed leaving 2026-11-09 is Past", () => {
  assert.equal(one({ status: "confirmed", arrive: "2026-11-06", leave: "2026-11-09" }).tab, "past");
});

test("tabs: a trip under way (arrived 2026-11-08, leaving 2026-11-12) is Upcoming (P6-09 option 1)", () => {
  // P6-09 option 2 would expect "past" here.
  assert.equal(one({ status: "confirmed", arrive: "2026-11-08", leave: "2026-11-12" }).tab, "upcoming");
});

test("tabs: deposit_paid and paid_in_full ahead are Upcoming, behind are Past", () => {
  for (const status of ["deposit_paid", "paid_in_full"]) {
    assert.equal(one({ status, arrive: "2026-12-01", leave: "2026-12-04" }).tab, "upcoming", status);
    assert.equal(one({ status, arrive: "2026-10-01", leave: "2026-10-04" }).tab, "past", status);
  }
});

test("tabs: completed is always Past, even with a future leave", () => {
  assert.equal(one({ status: "completed", arrive: "2026-11-20", leave: "2026-11-25" }).tab, "past");
  assert.equal(one({ status: "completed", arrive: "2026-11-01", leave: "2026-11-04" }).tab, "past");
});

test("tabs: cancelled and expired are always Cancelled, whatever the dates", () => {
  for (const status of ["cancelled", "expired"]) {
    assert.equal(one({ status, arrive: "2026-12-01", leave: "2026-12-04" }).tab, "cancelled", status);
    assert.equal(one({ status, arrive: "2026-10-01", leave: "2026-10-04" }).tab, "cancelled", status);
  }
});

test("tabs: a held item (never sent by the SQL) is dropped", () => {
  const list = cards([summary({ ref: REFS[0], status: "held" }), summary({ ref: REFS[1], status: "confirmed" })]);
  assert.deepEqual(list.map((c) => c.reference), [REFS[1]]);
  assert.ok(list.every((c) => c.status !== "held"));
  assert.deepEqual(cards([summary({ status: "held" })]), []);
  assert.deepEqual(cards([]), []);
});

// ---------------------------------------------------------------- toGuestCards: order

test("order: Upcoming by arrive ascending, Past and Cancelled by arrive descending", () => {
  const items = [
    summary({ ref: REFS[0], status: "confirmed", arrive: "2026-12-20", leave: "2026-12-23" }),
    summary({ ref: REFS[1], status: "cancelled", arrive: "2026-09-01", leave: "2026-09-04" }),
    summary({ ref: REFS[2], status: "completed", arrive: "2026-08-01", leave: "2026-08-04" }),
    summary({ ref: REFS[3], status: "awaiting_payment", arrive: "2026-11-15", leave: "2026-11-18" }),
    summary({ ref: REFS[4], status: "expired", arrive: "2026-12-01", leave: "2026-12-04" }),
    summary({ ref: REFS[5], status: "completed", arrive: "2026-10-01", leave: "2026-10-04" }),
    summary({ ref: REFS[6], status: "deposit_paid", arrive: "2026-11-08", leave: "2026-11-12" }),
  ];
  const list = cards(items);
  const by = (tab) => list.filter((c) => c.tab === tab).map((c) => c.reference);
  assert.deepEqual(by("upcoming"), [REFS[6], REFS[3], REFS[0]]);
  assert.deepEqual(by("past"), [REFS[5], REFS[2]]);
  assert.deepEqual(by("cancelled"), [REFS[4], REFS[1]]);
  assert.equal(list.length, items.length);
});

test("order: the input order does not change the result", () => {
  const items = [
    summary({ ref: REFS[0], status: "confirmed", arrive: "2026-12-20", leave: "2026-12-23" }),
    summary({ ref: REFS[1], status: "awaiting_payment", arrive: "2026-11-15", leave: "2026-11-18" }),
    summary({ ref: REFS[2], status: "completed", arrive: "2026-08-01", leave: "2026-08-04" }),
  ];
  const forward = cards(items).map((c) => c.reference);
  const backward = cards([...items].reverse()).map((c) => c.reference);
  assert.deepEqual(backward, forward);
});

// ---------------------------------------------------------------- toGuestCards: display strings

test("card: every field from the summary; the exact key set", () => {
  const card = one({ ref: REFS[0], status: "awaiting_payment", arrive: "2026-11-17", leave: "2026-11-20", paidFils: 0 });
  assert.deepEqual(card, {
    reference: REFS[0],
    status: "awaiting_payment",
    tab: "upcoming",
    title: "[Stay name]",
    place: "[Destination]",
    image: { src: "https://media.example.test/stays/stay-one/hero.webp", alt: "[Alt text]" },
    dates: "17/11/2026 – 20/11/2026",
    total: "AED 3,465.00",
    paid: null,
    stillDue: "AED 3,465.00",
    payBy: { date: "12/11/2026", time: "16:00" },
    href: "/en/bookings/trip?ref=ALMAR-7K3QH9",
  });
});

test("card: a null image stays null", () => {
  assert.equal(one({ image: null }).image, null);
});

test("card: total is formatAed(grandFils)", () => {
  assert.equal(one({ grandFils: 105000 }).total, "AED 1,050.00");
  assert.equal(one({ grandFils: 0, stillDueFils: 0 }).total, "AED 0.00");
});

test("card: paid is formatAed(paidFils) above 0, else null (P6-07 option 1)", () => {
  // P6-07 option 2 would assert that no card has a `paid` key.
  assert.equal(one({ status: "deposit_paid", paidFils: 50000, stillDueFils: 296500 }).paid, "AED 500.00");
  assert.equal(one({ status: "deposit_paid", paidFils: 1, stillDueFils: 346499 }).paid, "AED 0.01");
  assert.equal(one({ paidFils: 0 }).paid, null);
});

test("card: stillDue is null at 0, else formatAed(stillDueFils)", () => {
  assert.equal(one({ status: "paid_in_full", paidFils: 346500, stillDueFils: 0 }).stillDue, null);
  assert.equal(one({ status: "deposit_paid", paidFils: 50000, stillDueFils: 296500 }).stillDue, "AED 2,965.00");
});

test("card: payBy only for awaiting_payment with a deadline (UAE date and time)", () => {
  assert.deepEqual(one({ status: "awaiting_payment", deadline: DEADLINE }).payBy, { date: "12/11/2026", time: "16:00" });
  assert.deepEqual(one({ status: "awaiting_payment", deadline: "2026-11-12T12:00:00Z" }).payBy, { date: "12/11/2026", time: "16:00" });
  assert.equal(one({ status: "awaiting_payment", deadline: null }).payBy, null);
  for (const status of ["deposit_paid", "paid_in_full", "confirmed", "completed", "cancelled", "expired"]) {
    assert.equal(one({ status, deadline: DEADLINE }).payBy, null, status);
  }
});

test("card: a part-paid request past its deadline keeps the stored pay-by (04-08 P-09)", () => {
  const card = one({ status: "awaiting_payment", paidFils: 50000, stillDueFils: 296500, deadline: "2026-11-05T16:00:00+04:00" });
  assert.deepEqual(card.payBy, { date: "05/11/2026", time: "16:00" });
  assert.equal(card.paid, "AED 500.00");
});

test("card: a deadline uaeDateTime cannot read gives payBy null, never a throw", () => {
  for (const deadline of ["", "not a date", "2026-11-12", "2026-11-12T16:00", "2026-13-45T16:00:00+04:00"]) {
    let card;
    assert.doesNotThrow(() => {
      card = one({ status: "awaiting_payment", deadline });
    }, JSON.stringify(deadline));
    assert.equal(card.payBy, null, JSON.stringify(deadline));
  }
  const list = cards([summary({ ref: REFS[0], deadline: "not a date" }), summary({ ref: REFS[1] })]);
  assert.equal(list.length, 2);
});

test("card: dates is the two formatDate days joined by formatRange", () => {
  assert.equal(one({ arrive: "2026-12-31", leave: "2027-01-03" }).dates, "31/12/2026 – 03/01/2027");
});

test("card: title is stayTitle, place is destinationName, reference is ref", () => {
  const card = one({ ref: REFS[7], stayTitle: "[Other stay]", destinationName: "[Other destination]" });
  assert.equal(card.title, "[Other stay]");
  assert.equal(card.place, "[Other destination]");
  assert.equal(card.reference, REFS[7]);
});

test("card: href is bookingPagePath(locale, ref) with no token, in every locale", () => {
  for (const locale of ["en", "ar", "es"]) {
    const card = one({ ref: REFS[0] }, locale);
    assert.equal(card.href, `/${locale}/bookings/trip?ref=ALMAR-7K3QH9`);
    assert.doesNotMatch(card.href, /[?&]t=/);
  }
});

// ---------------------------------------------------------------- loadGuestBookings on a fake rpc

/** One guest_bookings row as the SQL sends it (snake_case). */
const row = (over = {}) => ({
  ref: REFS[0], status: "awaiting_payment", stay_title: "[Stay name]", destination_name: "[Destination]", image_key: null,
  image_alt: null, arrive: "2026-11-17", leave: "2026-11-20", plan: "deposit", grand_fils: 346500, paid_fils: 0,
  still_due_fils: 346500, deadline: DEADLINE, ...over,
});

function fakeDb(answer = () => ({ data: { items: [row()] }, error: null })) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return answer(name, args);
    },
  };
}

test("loadGuestBookings: one guest_bookings call with the email trimmed and lower-cased, the locale and the TEST flag", async () => {
  const db = fakeDb();
  const items = await loadGuestBookings({ db, email: " Guest@Example.com ", locale: "ar", isTest: true });
  assert.deepEqual(db.calls, [{ name: "guest_bookings", args: { p_email: "guest@example.com", p_locale: "ar", p_is_test: true } }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].ref, REFS[0]);
  assert.equal(items[0].paidFils, 0);
});

test("loadGuestBookings: the real host's flag reaches the rpc as false", async () => {
  const db = fakeDb();
  await loadGuestBookings({ db, email: "guest@example.com", locale: "en", isTest: false });
  assert.deepEqual(db.calls.map((c) => c.args), [{ p_email: "guest@example.com", p_locale: "en", p_is_test: false }]);
});

test("loadGuestBookings: no db gives null without a call", async () => {
  assert.equal(await loadGuestBookings({ db: null, email: "guest@example.com", locale: "en", isTest: true }), null);
});

test("loadGuestBookings: an email empty after trim gives null without a call", async () => {
  for (const email of ["", "   ", "\t\n", null, undefined]) {
    const db = fakeDb();
    assert.equal(await loadGuestBookings({ db, email, locale: "en", isTest: true }), null, JSON.stringify(email));
    assert.deepEqual(db.calls, [], JSON.stringify(email));
  }
});

test("loadGuestBookings: a failed, thrown or unreadable answer is null, never a throw", async () => {
  const answers = [
    () => ({ data: null, error: { message: "boom" } }),
    () => {
      throw new Error("network");
    },
    () => ({ data: null, error: null }),
    () => ({ data: { items: "nope" }, error: null }),
    () => ({ data: { items: [row({ paid_fils: undefined })] }, error: null }),
    () => ({ data: { items: [row({ ref: "not-a-ref" })] }, error: null }),
  ];
  for (const answer of answers) {
    const db = fakeDb(answer);
    assert.equal(await loadGuestBookings({ db, email: "guest@example.com", locale: "en", isTest: true }), null);
    assert.equal(db.calls.length, 1);
  }
});

test("loadGuestBookings: an empty list is [], not null", async () => {
  const db = fakeDb(() => ({ data: { items: [] }, error: null }));
  assert.deepEqual(await loadGuestBookings({ db, email: "guest@example.com", locale: "es", isTest: true }), []);
});

test("loadGuestBookings then toGuestCards: the read rows become cards", async () => {
  const db = fakeDb(() => ({ data: { items: [row(), row({ ref: REFS[1], status: "completed", deadline: null })] }, error: null }));
  const items = await loadGuestBookings({ db, email: "guest@example.com", locale: "es", isTest: true });
  const list = toGuestCards(items, { locale: "es", today: TODAY });
  assert.deepEqual(list.map((c) => [c.reference, c.tab, c.href]), [
    [REFS[0], "upcoming", "/es/bookings/trip?ref=ALMAR-7K3QH9"],
    [REFS[1], "past", "/es/bookings/trip?ref=ALMAR-2B3C4D"],
  ]);
});

// ---------------------------------------------------------------- copy

const LOCALES = ["en", "ar", "es"];
const NAMED_KEYS = [
  "tabsLabel", "upcoming", "past", "cancelled", "reference", "total", "paid", "stillDue", "nothingDue",
  "emptyUpcoming", "emptyPast", "emptyCancelled", "loadFailed", "tryAgain", "viewTrip",
];

test("copy: GUEST_BOOKINGS_COPY has the same keys in en, ar and es, every one a non-empty string", () => {
  assert.deepEqual(Object.keys(GUEST_BOOKINGS_COPY).sort(), [...LOCALES].sort());
  const keys = Object.keys(GUEST_BOOKINGS_COPY.en).sort();
  for (const locale of LOCALES) {
    const copy = GUEST_BOOKINGS_COPY[locale];
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    for (const [key, value] of Object.entries(copy)) {
      assert.equal(typeof value, "string", `${locale}.${key}`);
      assert.ok(value.trim().length > 0, `${locale}.${key}`);
      assert.doesNotMatch(value, /\[object|undefined|NaN/, `${locale}.${key}`);
    }
  }
});

test("copy: every key the list needs is there (paid: P6-07 option 1)", () => {
  for (const key of NAMED_KEYS) assert.ok(Object.hasOwn(GUEST_BOOKINGS_COPY.en, key), key);
});

test("copy: no status words and no pay-by line (decision 6: those are JOURNEY_COPY.bookingStatus)", () => {
  for (const locale of LOCALES) {
    assert.equal(Object.hasOwn(GUEST_BOOKINGS_COPY[locale], "status"), false, locale);
    assert.equal(Object.hasOwn(GUEST_BOOKINGS_COPY[locale], "payBy"), false, locale);
    for (const value of Object.values(GUEST_BOOKINGS_COPY[locale])) assert.doesNotMatch(value, /UAE time/, locale);
  }
});

test("copy: the canvas words in English are verbatim", () => {
  const en = GUEST_BOOKINGS_COPY.en;
  assert.equal(en.upcoming, "Upcoming");
  assert.equal(en.past, "Past");
  assert.equal(en.viewTrip, "View trip");
  assert.equal(en.paid, "Paid");
});

test("copy: every status a card can carry has a chip word in JOURNEY_COPY.bookingStatus, and payBy has both slots", () => {
  for (const locale of LOCALES) {
    const words = JOURNEY_COPY[locale].bookingStatus;
    for (const status of ["awaiting_payment", "deposit_paid", "paid_in_full", "confirmed", "completed", "cancelled", "expired"]) {
      assert.equal(typeof words[status], "string", `${locale}.${status}`);
      assert.ok(words[status].trim().length > 0, `${locale}.${status}`);
    }
    assert.match(words.payBy, /\{date\}/, locale);
    assert.match(words.payBy, /\{time\}/, locale);
  }
});

// ---------------------------------------------------------------- source rules: lib/booking/guest-list.ts

const lib = readFileSync(LIB, "utf8");

test("lib: no environment, no Supabase, no Next, no key name", () => {
  assert.doesNotMatch(lib, /process\.env|@supabase|next\/|SERVICE_ROLE/);
});

test("lib: no money arithmetic", () => {
  assert.doesNotMatch(lib, /\* ?100|\/ ?100|toFixed|Math\.round|Fils *[-+*/] *[A-Za-z0-9(]/);
});

test("lib: list links never carry a token", () => {
  assert.doesNotMatch(lib, /[?&]t=/);
  assert.match(lib, /bookingPagePath\(locale, item\.ref\)/);
});

test("lib: dates through uaeDateTime only (decision 6)", () => {
  assert.doesNotMatch(lib, /dubaiDateTime|Intl\.DateTimeFormat/);
  assert.match(lib, /uaeDateTime\(/);
});

test("lib: no payment-provider or bank words", () => {
  assert.doesNotMatch(lib, /stripe|clientSecret|session_id|payment ?element|iban|swift/i);
});

// ---------------------------------------------------------------- source rules: the page
//
// These describe app/[locale]/bookings/page.tsx AFTER the Task 4 wiring (step 3), which lands only after the owner signs
// the pictures. Until then the page is job 21's placeholder and the wiring rules below fail on purpose (RED).

const page = readFileSync(PAGE, "utf8");

test("page: the locale comes from the route param and is checked by isLocale", () => {
  assert.match(page, /params: Promise<\{ locale: string \}>/);
  assert.match(page, /const \{ locale \} = await params;/);
  assert.match(page, /if \(!isLocale\(locale\)\) notFound\(\);/);
});

test("page: no searchParams and no other route value", () => {
  assert.doesNotMatch(page, /searchParams/);
  assert.doesNotMatch(page, /params\./);
});

test("page: signed out goes to the locale's login with return=bookings", () => {
  assert.match(page, /redirect\(`\$\{localePath\(locale, "\/login"\)\}\?return=bookings`\)/);
});

test("page: force-dynamic and noindex robots kept", () => {
  assert.match(page, /export const dynamic = "force-dynamic";/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
});

test("page: readSessionProfile() comes before createSupabaseAdmin()", () => {
  const session = page.indexOf("readSessionProfile()");
  const admin = page.indexOf("createSupabaseAdmin()");
  assert.ok(session >= 0, "readSessionProfile() is called");
  assert.ok(admin >= 0, "createSupabaseAdmin() is called");
  assert.ok(session < admin, "the session is read before the admin client is made");
  assert.equal(page.split("createSupabaseAdmin()").length - 1, 1);
});

test("page: the email passed is the session profile's, once, and nothing else names an email", () => {
  assert.equal(page.split("email: profile.email").length - 1, 1);
  assert.equal((page.match(/\bemail\s*:/g) ?? []).length, 1);
  assert.doesNotMatch(page, /cookies\(/);
});

test("page: the TEST flag is isTestHost of the host header from headers()", () => {
  assert.equal(page.split("isTestHost(").length - 1, 1);
  assert.match(page, /import \{[^}]*\bheaders\b[^}]*\} from "next\/headers"/);
  assert.match(page, /\(await headers\(\)\)\.get\("host"\)/);
  assert.match(page, /isTest: isTestHost\(host\)/);
});

test("page: reads through loadGuestBookings and toGuestCards with today from dubaiToday(new Date())", () => {
  assert.match(page, /loadGuestBookings\(\{/);
  assert.match(page, /toGuestCards\(items, \{ locale, today: dubaiToday\(new Date\(\)\) \}\)/);
  assert.match(page, /items \? toGuestCards\(/);
  assert.doesNotMatch(page, /listGuestBookings|\.rpc\(/);
});
