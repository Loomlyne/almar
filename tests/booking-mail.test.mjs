// Plan 04-05 (Task 1): the booking emails. Two halves:
//   1. the copy (BOOKING_EMAIL_COPY, OWNER_EMAIL_COPY) and the display text (stayDaysText, guestsText);
//   2. the renderers (lib/email/shell.ts, booking-guest-mail.ts, booking-owner-mail.ts), built after the owner signed
//      the pictures on 2026-10-26 (E-11 = A: owner notices in English).
// Every amount is a symbolic fixture value in fils and every bank value a documentation example (E-06).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { BOOKING_EMAIL_COPY, OWNER_EMAIL_COPY, TEST_SUBJECT_PREFIX, BOOKING_CONTACT } = await loadTs("lib/copy/booking-email.ts");
const { stayDaysText, guestsText } = await loadTs("lib/booking/display-text.ts");
const { JOURNEY_COPY } = await loadTs("lib/copy/journey.ts");
const { formatGuestSummary, fill } = await loadTs("lib/journey-format.ts");
const { uaeDateTime, formatIsoDate } = await loadTs("lib/booking/trip-format.ts");
const { formatAed } = await loadTs("lib/money/format.ts");
const { formatIban } = await loadTs("lib/booking/bank.ts");
const { originForBooking } = await loadTs("lib/booking/origin.ts");
const fx = await loadTs("tests/helpers/booking-view-fixtures.ts");

const LOCALES = ["en", "ar", "es"];

/** Comment lines dropped, as the plan's `nc` filter does. */
function nc(source) {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join("\n");
}

function leaves(value, path = "") {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object" && typeof value.other === "string") return [[path, value.other]];
  return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

function keyTree(value) {
  if (typeof value === "string") return "s";
  if (value && typeof value === "object" && typeof value.other === "string") return "plural";
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, keyTree(value[k])]));
}

// ================================================================ 1. copy

test("copy: BOOKING_EMAIL_COPY has the same key tree in en, ar and es, every value a clean non-empty string", () => {
  const en = keyTree(BOOKING_EMAIL_COPY.en);
  for (const locale of LOCALES) {
    assert.deepEqual(keyTree(BOOKING_EMAIL_COPY[locale]), en, locale);
    for (const [path, value] of leaves(BOOKING_EMAIL_COPY[locale])) {
      assert.ok(value.trim().length > 0, `${locale}.${path} is empty`);
      assert.equal(/\[object|undefined|NaN/.test(value), false, `${locale}.${path}`);
    }
  }
});

test("copy: OWNER_EMAIL_COPY is English, every value a clean non-empty string", () => {
  for (const [path, value] of leaves(OWNER_EMAIL_COPY)) {
    assert.ok(value.trim().length > 0, `owner.${path} is empty`);
    assert.equal(/\[object|undefined|NaN/.test(value), false, `owner.${path}`);
    assert.equal(/[؀-ۿ]/.test(value), false, `owner.${path} is not English`);
  }
});

test("copy: subjects carry the {ref} slot and no other slot (no guest-typed text in a subject)", () => {
  for (const locale of LOCALES) {
    const c = BOOKING_EMAIL_COPY[locale];
    for (const subject of [c.requestReceived.subject, c.paymentReceipt.subject, c.requestLapsed.subject]) {
      assert.deepEqual(subject.match(/\{\w+\}/g), ["{ref}"], `${locale}: ${subject}`);
    }
  }
  for (const subject of [OWNER_EMAIL_COPY.request.subject, OWNER_EMAIL_COPY.payment.subject, OWNER_EMAIL_COPY.withdrawn.subject]) {
    assert.deepEqual(subject.match(/\{\w+\}/g), ["{ref}"], subject);
  }
});

test("copy: the TEST prefix is the same in every language and every TEST banner says TEST", () => {
  assert.equal(TEST_SUBJECT_PREFIX, "[TEST] ");
  assert.equal(BOOKING_EMAIL_COPY.en.testBanner, "TEST booking from the preview site. Do not send money.");
  assert.equal(OWNER_EMAIL_COPY.testBanner, BOOKING_EMAIL_COPY.en.testBanner);
  for (const locale of LOCALES) assert.match(BOOKING_EMAIL_COPY[locale].testBanner, /TEST/, locale);
});

test("copy: the E-08 and E-18 lines are the plan's English", () => {
  const en = BOOKING_EMAIL_COPY.en;
  assert.equal(en.paymentReceipt.moneyOnClosed, "We have received {amount}. We will contact you about it.");
  assert.equal(en.paymentReceipt.overpaid, "We received more than the total. We will contact you about the difference.");
  assert.equal(en.paymentReceipt.acceptedAsPaid, "The amount received was accepted as paid.");
  assert.equal(en.transfer.alsoOnPage, "These details are also on your booking page.");
  for (const locale of LOCALES) assert.match(BOOKING_EMAIL_COPY[locale].paymentReceipt.moneyOnClosed, /\{amount\}/, locale);
});

test("copy: B-28, B-29, the lapse rule (R1) and the reference line exist in every language", () => {
  for (const locale of LOCALES) {
    const t = BOOKING_EMAIL_COPY[locale].transfer;
    assert.ok(t.fees.length > 10 && t.reply.length > 10 && t.lapseRule.length > 20, locale);
    assert.match(t.referenceLine, /\{ref\}/, locale);
  }
  assert.match(BOOKING_EMAIL_COPY.en.transfer.fees, /sender/);
  assert.match(BOOKING_EMAIL_COPY.en.transfer.reply, /bank receipt/);
});

test("copy: slots are where the renderers fill them", () => {
  for (const locale of LOCALES) {
    const c = BOOKING_EMAIL_COPY[locale];
    assert.match(c.greeting, /\{name\}/, locale);
    assert.match(c.help, /\{phone\}/, locale);
    assert.match(c.balanceLine, /\{amount\}.*\{date\}|\{date\}.*\{amount\}/, locale);
    assert.match(c.requestLapsed.body, /\{date\}/, locale);
    assert.match(c.requestLapsed.body, /\{time\}/, locale);
    assert.match(c.stayLine, /\{title\}/, locale);
    assert.match(c.addonLine, /\{amount\}/, locale);
  }
});

test("copy: Arabic is written in Arabic and Spanish is not the English", () => {
  const sameAnywhere = ["signOff", "transfer.iban", "transfer.swift", "addonLine", "stayLine", "rows.total"];
  const en = Object.fromEntries(leaves(BOOKING_EMAIL_COPY.en));
  for (const [path, value] of leaves(BOOKING_EMAIL_COPY.ar)) {
    if (["signOff", "addonLine"].includes(path)) continue;
    assert.match(value, /[؀-ۿ]/, `ar.${path} has no Arabic letter`);
  }
  for (const [path, value] of leaves(BOOKING_EMAIL_COPY.es)) {
    if (sameAnywhere.includes(path) || path.startsWith("airports.")) continue;
    assert.notEqual(value, en[path], `es.${path} is the English text`);
  }
});

test("copy: the owner's R2 and R1 strings are the plan's English, verbatim", () => {
  assert.equal(OWNER_EMAIL_COPY.withdrawn.subject, "Request withdrawn: {ref}");
  assert.equal(OWNER_EMAIL_COPY.withdrawn.heading, "The guest withdrew this request");
  assert.equal(OWNER_EMAIL_COPY.withdrawn.line, "The nights are free again.");
  assert.equal(OWNER_EMAIL_COPY.attentionWords.deadline_passed_part_paid, "Pay-by date passed, part paid");
  assert.deepEqual(Object.keys(OWNER_EMAIL_COPY.attentionWords).sort(), [
    "deadline_passed_part_paid",
    "overpaid",
    "paid_after_cancel",
    "paid_after_expiry",
  ]);
  assert.equal("expired_with_payment" in OWNER_EMAIL_COPY.attentionWords, false);
});

test("copy: the owner status words cover every status and match the dashboard's English", () => {
  const statuses = ["held", "awaiting_payment", "deposit_paid", "paid_in_full", "confirmed", "completed", "cancelled", "expired"];
  assert.deepEqual(Object.keys(OWNER_EMAIL_COPY.statusWords).sort(), [...statuses].sort());
  const dashboard = readFileSync("lib/copy/ops-bookings.ts", "utf8");
  for (const s of statuses) assert.ok(dashboard.includes(`${s}: "${OWNER_EMAIL_COPY.statusWords[s]}"`), s);
});

test("copy: contact facts are the published ones, never new", () => {
  assert.equal(BOOKING_CONTACT.email, "inquiries@almarprivatejourney.com");
  assert.equal(BOOKING_CONTACT.phone, "+971 56 388 3302");
  assert.equal(BOOKING_CONTACT.whatsappUrl, "https://wa.me/971563883302");
  const frame = readFileSync("components/site/public-frame.tsx", "utf8");
  assert.ok(frame.includes(BOOKING_CONTACT.email) && frame.includes(BOOKING_CONTACT.phone));
});

test("copy: no bank value, price, fee amount or rate is typed into the email copy", () => {
  const source = readFileSync("lib/copy/booking-email.ts", "utf8");
  assert.equal(/AE\d{2}\s?\d{4}|TESTAEAA|GB82|\bAED\s?\d|\d+\s?%/.test(source), false);
});

test("copy: no stay-details (access) words in the email copy (E-02)", () => {
  for (const locale of LOCALES) {
    const text = leaves(BOOKING_EMAIL_COPY[locale]).map(([, v]) => v).join(" ");
    assert.equal(/door code|wi-?fi|exact address/i.test(text), false, locale);
  }
});

// ================================================================ display text

test("stayDaysText: DD/MM/YYYY – DD/MM/YYYY from two ISO days", () => {
  assert.equal(stayDaysText("2026-12-10", "2026-12-15"), "10/12/2026 – 15/12/2026");
  assert.equal(stayDaysText(fx.FIXTURE_ARRIVE, fx.FIXTURE_LEAVE), `${formatIsoDate(fx.FIXTURE_ARRIVE)} – ${formatIsoDate(fx.FIXTURE_LEAVE)}`);
  assert.throws(() => stayDaysText("10/12/2026", "2026-12-15"));
  assert.throws(() => stayDaysText("2026-12-10", "2026-12-15T00:00:00Z"));
});

test("guestsText: the journey's plural forms, non-zero groups only, in the booking's language", () => {
  const counts = { adults: 2, children: 1, infants: 0 };
  assert.equal(guestsText(counts, "en"), "2 adults and 1 child");
  assert.equal(guestsText(counts, "es"), "2 adultos y 1 niño");
  for (const locale of LOCALES) {
    assert.equal(guestsText(counts, locale), formatGuestSummary(counts, locale, JOURNEY_COPY[locale].guests.summary), locale);
  }
  assert.equal(guestsText({ adults: 1, children: 0, infants: 0 }, "en"), "1 adult");
});

test("guestsText: Western digits in Arabic, English for an unknown language", () => {
  assert.match(guestsText({ adults: 3, children: 0, infants: 0 }, "ar"), /3/);
  assert.equal(/[٠-٩]/.test(guestsText({ adults: 3, children: 4, infants: 5 }, "ar")), false);
  assert.equal(guestsText({ adults: 2, children: 0, infants: 0 }, "fr"), "2 adults");
});

test("display-text source: imports 04-03's formatIsoDate and defines no day, time or status helper of its own", () => {
  const source = nc(readFileSync("lib/booking/display-text.ts", "utf8"));
  assert.match(source, /import \{ formatIsoDate \} from "\.\/trip-format"/);
  assert.equal(/(function|const|let)\s+(uaeDateTime|formatIsoDate|dayText|uaeDateTimeParts)\b/.test(source), false);
  assert.equal(/process\.env|console\.|from "resend"|Date\.now|new Date/.test(source), false);
});

test("fixtures: every view state in every language is a full view with the documentation values", () => {
  for (const state of fx.VIEW_STATES) {
    for (const locale of LOCALES) {
      const view = fx.viewFixture(state, locale);
      assert.equal(view.ref, "ALMAR-TEST22");
      assert.equal(view.locale, locale);
      assert.equal(typeof view.withdrawable, "boolean");
      assert.equal(view.withdrawable, state === "awaiting", `${state} withdrawable`);
      if (view.transfer) {
        assert.equal(view.transfer.iban, "AE070331234567890123456");
        assert.equal(view.transfer.swift, "TESTAEAAXXX");
      }
    }
  }
  assert.equal(fx.FAKE_LINK_TOKEN.length, 43);
  assert.match(fx.FAKE_LINK_TOKEN, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(fx.FAKE_LINK_TOKEN.includes("eyJ"), false);
  assert.ok(Date.parse(fx.viewFixture("awaiting", "en").deadline) > fx.FIXTURE_NOW);
  assert.ok(Date.parse(fx.viewFixture("part-paid-late", "en").deadline) < fx.FIXTURE_NOW);
  assert.equal(fx.paymentJobFixture("overpaid", "en").view.money.paidFils > fx.paymentJobFixture("overpaid", "en").view.money.grandFils, true);
  assert.equal(fx.paymentJobFixture("after-expiry", "en").view.money.paidFils > 0, true);
  assert.equal(fx.paymentJobFixture("written-off", "en").view.money.stillDueFils, 0);
});

// ================================================================ 2. renderers

const RENDERER_FILES = ["lib/email/shell.ts", "lib/email/booking-guest-mail.ts", "lib/email/booking-owner-mail.ts"];

let loaded = null;
async function mail() {
  if (!loaded) {
    loaded = {
      shell: await loadTs("lib/email/shell.ts"),
      guest: await loadTs("lib/email/booking-guest-mail.ts"),
      owner: await loadTs("lib/email/booking-owner-mail.ts"),
      magic: await loadTs("lib/email/magic-link.ts"),
    };
  }
  return loaded;
}

const rtest = test;

const ctx = (locale) => ({ copy: BOOKING_EMAIL_COPY[locale], brand: null });
const DASHBOARD_LINK = "https://dashboard.almarprivatejourney.com/bookings/detail?ref=ALMAR-TEST22";
const HOSTILE = `<script>alert("x")</script>' & "q"`;
const HOSTILE_LINE = `${HOSTILE}\r\nBcc: evil@example.com`;
const TOKEN_IN_URL = /[?&]t=/;

function bankValues(view) {
  const t = fx.viewFixture("awaiting", view.locale).transfer;
  return [t.iban, formatIban(t.iban), t.accountName, t.bankAddress, t.swift];
}

function noBank(mailOut, view, label) {
  for (const value of bankValues(view)) {
    assert.equal(mailOut.html.includes(value), false, `${label}: html has ${value}`);
    assert.equal(mailOut.text.includes(value), false, `${label}: text has ${value}`);
  }
}

function payBySentence(locale, iso) {
  return fill(JOURNEY_COPY[locale].bookingStatus.payBy, uaeDateTime(iso));
}

async function everyMail(locale, mutate = (job) => job, isTest = false) {
  const { guest, owner } = await mail();
  const request = mutate(fx.requestJobFixture(locale, { isTest }));
  const payment = mutate(fx.paymentJobFixture("part", locale, { isTest }));
  const lapse = fx.lapseJobFixture(locale, { isTest });
  const withdrawn = mutate(fx.withdrawnJobFixture(locale, { isTest }));
  return {
    requestReceived: guest.renderRequestReceivedEmail(request, ctx(locale)),
    paymentReceipt: guest.renderPaymentReceiptEmail(payment, ctx(locale)),
    requestLapsed: guest.renderRequestLapsedEmail(lapse, ctx(locale)),
    requestOwner: owner.renderRequestOwnerEmail(request, { brand: null }),
    paymentOwner: owner.renderPaymentOwnerEmail(payment, { brand: null }),
    withdrawnOwner: owner.renderWithdrawnOwnerEmail(withdrawn, { brand: null }),
  };
}

rtest("request received: the reference, stay, days, amount, bank block, B-28, B-29, R1, E-18 and the button", async () => {
  const { guest } = await mail();
  const job = fx.requestJobFixture("en");
  const out = guest.renderRequestReceivedEmail(job, ctx("en"));
  const c = BOOKING_EMAIL_COPY.en;
  const t = job.view.transfer;
  assert.equal(out.subject, "Your request ALMAR-TEST22: how to pay by bank transfer");
  assert.match(out.html, /<html[^>]*lang="en"[^>]*dir="ltr"/);
  for (const part of [
    "ALMAR-TEST22",
    job.view.stay.title,
    job.view.stay.destinationName,
    stayDaysText(job.view.arrive, job.view.leave),
    guestsText(job.view, "en"),
    formatAed(t.amountFils),
    formatIban(t.iban),
    t.swift,
    t.accountName,
    t.bankName,
    t.bankAddress,
    t.note,
    fill(c.transfer.referenceLine, { ref: "ALMAR-TEST22" }),
    payBySentence("en", t.payBy),
    c.transfer.fees,
    c.transfer.reply,
    c.transfer.lapseRule,
    c.transfer.alsoOnPage,
    c.buttons.viewBooking,
  ]) {
    assert.ok(out.html.includes(part), `html lacks ${part}`);
  }
  assert.ok(out.text.includes(t.iban), "text has the normalized IBAN");
  assert.ok(out.html.includes(job.bookingUrl.replace(/&/g, "&amp;")), "the button links to the booking page");
  assert.ok(out.text.includes(job.bookingUrl));
});

rtest("request received, deposit plan: the balance and its due date", async () => {
  const { guest } = await mail();
  const job = fx.requestJobFixture("en", { plan: "deposit" });
  const out = guest.renderRequestReceivedEmail(job, ctx("en"));
  assert.ok(out.html.includes(formatAed(job.view.money.balanceFils)));
  assert.ok(out.html.includes(formatIsoDate(job.view.balanceDueDate)));
});

rtest("request received: Arabic is right to left with every amount, reference, IBAN, SWIFT and date left to right", async () => {
  const { guest } = await mail();
  const job = fx.requestJobFixture("ar");
  const out = guest.renderRequestReceivedEmail(job, ctx("ar"));
  assert.match(out.html, /<html[^>]*lang="ar"[^>]*dir="rtl"/);
  assert.match(out.html, /text-align:\s*right/);
  const t = job.view.transfer;
  for (const value of [formatAed(t.amountFils), "ALMAR-TEST22", formatIban(t.iban), t.swift, uaeDateTime(t.payBy).date]) {
    assert.match(out.html, new RegExp(`<span dir="ltr"[^>]*>[^<]*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), value);
  }
});

rtest("request received: no transfer -> throws email: no transfer; a bad reference -> email: bad reference", async () => {
  const { guest } = await mail();
  const job = fx.requestJobFixture("en");
  assert.throws(() => guest.renderRequestReceivedEmail({ ...job, view: { ...job.view, transfer: null } }, ctx("en")), /email: no transfer/);
  assert.throws(() => guest.renderRequestReceivedEmail({ ...job, view: { ...job.view, ref: "ALMAR-OOOOOO" } }, ctx("en")), /email: bad reference/);
});

rtest("every mail: a TEST job has [TEST] first in the subject and the banner in html and text; a real one has neither (bite M2)", async () => {
  for (const locale of LOCALES) {
    const testMails = await everyMail(locale, (j) => j, true);
    const realMails = await everyMail(locale, (j) => j, false);
    for (const [name, out] of Object.entries(testMails)) {
      assert.ok(out.subject.startsWith("[TEST] "), `${locale} ${name}`);
      const banner = name.endsWith("Owner") ? OWNER_EMAIL_COPY.testBanner : BOOKING_EMAIL_COPY[locale].testBanner;
      assert.ok(out.text.includes(banner), `${locale} ${name} text banner`);
      assert.ok(out.html.includes(banner.replace(/&/g, "&amp;")), `${locale} ${name} html banner`);
    }
    for (const [name, out] of Object.entries(realMails)) {
      assert.equal(out.subject.includes("[TEST]"), false, `${locale} ${name}`);
      assert.equal(out.text.includes("TEST booking"), false, `${locale} ${name}`);
    }
  }
});

rtest("every mail: hostile names, titles, notes and bank fields are escaped in html and cleaned in text (bites M1, M7)", async () => {
  const mutate = (job) => {
    const view = structuredClone(job.view);
    view.guest.name = HOSTILE_LINE;
    view.stay.title = HOSTILE;
    view.stay.destinationName = HOSTILE;
    if (view.lines[0]) view.lines[0].name = HOSTILE;
    if (view.transfer) {
      view.transfer.note = HOSTILE;
      view.transfer.accountName = HOSTILE;
      view.transfer.bankName = HOSTILE;
      view.transfer.bankAddress = HOSTILE;
    }
    return { ...job, view };
  };
  for (const locale of LOCALES) {
    for (const [name, out] of Object.entries(await everyMail(locale, mutate))) {
      assert.equal(out.html.includes("<script"), false, `${locale} ${name}: raw script tag`);
      assert.equal(out.html.includes(`alert("x")`), false, `${locale} ${name}: raw quotes`);
      assert.equal(/\r/.test(out.subject) || /\n/.test(out.subject), false, `${locale} ${name}: subject line break`);
      assert.equal(out.subject.includes("script"), false, `${locale} ${name}: guest text in the subject`);
      assert.equal(/^Bcc:/m.test(out.text), false, `${locale} ${name}: a CR/LF in the name reached the text`);
    }
  }
});

rtest("every link is checked: javascript: and a foreign http origin throw email: bad link (bite M5)", async () => {
  const { guest, shell } = await mail();
  for (const href of ["javascript:alert(1)", "http://evil.example/bookings/trip", "//evil.example/x", "data:text/html,x"]) {
    assert.throws(() => shell.checkHref(href), /email: bad link/, href);
    assert.throws(() => guest.renderRequestReceivedEmail({ ...fx.requestJobFixture("en"), bookingUrl: href }, ctx("en")), /email: bad link/, href);
  }
  for (const href of ["https://almarprivatejourney.com/x", "http://127.0.0.1:3000/bookings/trip?ref=ALMAR-TEST22", "http://localhost:8787/x"]) {
    assert.doesNotThrow(() => shell.checkHref(href), href);
  }
});

rtest("no mail prints the stay details (address, wifi, door code, notes), even when the view carries them (bite M4)", async () => {
  const access = fx.accessFixture("en");
  const mutate = (job) => ({ ...job, view: { ...job.view, access } });
  for (const out of Object.values(await everyMail("en", mutate))) {
    for (const value of Object.values(access)) {
      assert.equal(out.html.includes(value) || out.text.includes(value), false, value);
    }
  }
  const { guest } = await mail();
  for (const variant of fx.PAYMENT_VARIANTS) {
    const job = fx.paymentJobFixture(variant, "en");
    const out = guest.renderPaymentReceiptEmail({ ...job, view: { ...job.view, access } }, ctx("en"));
    for (const value of Object.values(access)) assert.equal(out.html.includes(value) || out.text.includes(value), false, `${variant} ${value}`);
  }
});

rtest("receipt: amount and date received, total paid, then the part-received transfer block", async () => {
  const { guest } = await mail();
  const job = fx.paymentJobFixture("part", "en");
  const out = guest.renderPaymentReceiptEmail(job, ctx("en"));
  const c = BOOKING_EMAIL_COPY.en.paymentReceipt;
  assert.equal(out.subject, "Payment received for ALMAR-TEST22");
  for (const part of [
    formatAed(job.amountFils),
    formatIsoDate(job.receivedOn),
    formatAed(job.view.money.paidFils),
    formatAed(job.view.money.dueNowFils),
    c.partReceived,
    payBySentence("en", job.view.transfer.payBy),
    formatIban(job.view.transfer.iban),
  ]) {
    assert.ok(out.html.includes(part), part);
  }
  assert.equal(out.html.includes(c.nothingMoreDue), false);
});

rtest("receipt: deposit -> the balance, its due date and the transfer block (PAY-10)", async () => {
  const { guest } = await mail();
  const job = fx.paymentJobFixture("deposit", "en");
  const out = guest.renderPaymentReceiptEmail(job, ctx("en"));
  assert.ok(out.html.includes(formatAed(job.view.money.stillDueFils)));
  assert.ok(out.html.includes(formatIsoDate(job.view.balanceDueDate)));
  assert.ok(out.html.includes(formatIban(job.view.transfer.iban)));
  assert.equal(out.html.includes(BOOKING_EMAIL_COPY.en.paymentReceipt.nothingMoreDue), false);
});

rtest("receipt: full -> nothing more is due and no bank block", async () => {
  const { guest } = await mail();
  const job = fx.paymentJobFixture("full", "en");
  const out = guest.renderPaymentReceiptEmail(job, ctx("en"));
  assert.ok(out.html.includes(BOOKING_EMAIL_COPY.en.paymentReceipt.nothingMoreDue));
  noBank(out, job.view, "full");
});

rtest("receipt: written off -> the accepted-as-paid line and nothing more is due; never the gap or its reason", async () => {
  const { guest } = await mail();
  const out = guest.renderPaymentReceiptEmail(fx.paymentJobFixture("written-off", "en"), ctx("en"));
  const c = BOOKING_EMAIL_COPY.en.paymentReceipt;
  assert.ok(out.html.includes(c.acceptedAsPaid));
  assert.ok(out.html.includes(c.nothingMoreDue));
  assert.equal(/written off|write-off/i.test(out.html + out.text), false);
});

rtest("receipt: overpaid -> the overpaid line", async () => {
  const { guest } = await mail();
  for (const locale of LOCALES) {
    const out = guest.renderPaymentReceiptEmail(fx.paymentJobFixture("overpaid", locale), ctx(locale));
    assert.ok(out.html.includes(BOOKING_EMAIL_COPY[locale].paymentReceipt.overpaid.replace(/&/g, "&amp;")), locale);
  }
});

rtest("receipt after expiry or cancel: the neutral line only, no bank block, no nothing-more-is-due (E-10)", async () => {
  const { guest } = await mail();
  for (const locale of LOCALES) {
    const job = fx.paymentJobFixture("after-expiry", locale);
    const out = guest.renderPaymentReceiptEmail(job, ctx(locale));
    const c = BOOKING_EMAIL_COPY[locale].paymentReceipt;
    assert.ok(out.text.includes(fill(c.moneyOnClosed, { amount: formatAed(job.amountFils) })), locale);
    assert.equal(out.text.includes(c.nothingMoreDue), false, locale);
    noBank(out, job.view, `after-expiry ${locale}`);
    const cancelled = { ...job, statusBefore: "cancelled", statusAfter: "cancelled", view: { ...fx.viewFixture("cancelled", locale) } };
    const outCancelled = guest.renderPaymentReceiptEmail(cancelled, ctx(locale));
    assert.equal(outCancelled.text.includes(c.nothingMoreDue), false, `${locale} cancelled`);
    noBank(outCancelled, cancelled.view, `cancelled ${locale}`);
  }
});

rtest("receipt: no booking link -> the line pointing to the request email and no button", async () => {
  const { guest } = await mail();
  const job = { ...fx.paymentJobFixture("full", "en"), bookingUrl: null };
  const out = guest.renderPaymentReceiptEmail(job, ctx("en"));
  assert.ok(out.html.includes(BOOKING_EMAIL_COPY.en.paymentReceipt.noLink));
  assert.equal(out.html.includes("/bookings/trip"), false);
});

rtest("lapse: start again to the stay page in the language; no booking link, no t=, no bank value (bite M6)", async () => {
  const { guest } = await mail();
  for (const locale of LOCALES) {
    const job = fx.lapseJobFixture(locale);
    const out = guest.renderRequestLapsedEmail(job, ctx(locale));
    const href = `${originForBooking(false)}/${locale}/private-stays/test-stay`;
    assert.ok(out.html.includes(`href="${href}"`), `${locale} start-again link`);
    assert.equal(out.html.includes("/bookings/trip") || TOKEN_IN_URL.test(out.html) || TOKEN_IN_URL.test(out.text), false, locale);
    noBank(out, fx.viewFixture("awaiting", locale), `lapse ${locale}`);
    assert.equal(out.subject, fill(BOOKING_EMAIL_COPY[locale].requestLapsed.subject, { ref: "ALMAR-TEST22" }));
  }
  const odd = guest.renderRequestLapsedEmail({ ...fx.lapseJobFixture("en"), staySlug: "../x" }, ctx("en"));
  assert.ok(odd.html.includes(`href="${originForBooking(false)}/en/private-stays"`));
  const testJob = guest.renderRequestLapsedEmail(fx.lapseJobFixture("en", { isTest: true }), ctx("en"));
  assert.ok(testJob.html.includes(originForBooking(true)));
});

rtest("owner notices: English, the dashboard link, no bank value, no guest booking link, no t= (bite M3)", async () => {
  const { owner } = await mail();
  assert.equal(owner.OPS_BOOKING_DETAIL_PATH, "/bookings/detail");
  for (const locale of LOCALES) {
    const request = fx.requestJobFixture(locale);
    const payment = fx.paymentJobFixture("after-expiry", locale);
    const withdrawn = fx.withdrawnJobFixture(locale);
    const outs = {
      request: owner.renderRequestOwnerEmail(request, { brand: null }),
      payment: owner.renderPaymentOwnerEmail(payment, { brand: null }),
      withdrawn: owner.renderWithdrawnOwnerEmail(withdrawn, { brand: null }),
    };
    for (const [name, out] of Object.entries(outs)) {
      assert.match(out.html, /<html[^>]*lang="en"[^>]*dir="ltr"/, `${locale} ${name}`);
      assert.ok(out.html.includes(DASHBOARD_LINK) && out.text.includes(DASHBOARD_LINK), `${locale} ${name} dashboard link`);
      assert.equal(out.html.includes(request.bookingUrl) || out.text.includes(request.bookingUrl), false, `${locale} ${name} booking link`);
      assert.equal(TOKEN_IN_URL.test(out.html) || TOKEN_IN_URL.test(out.text), false, `${locale} ${name} t=`);
      assert.equal(out.html.includes(fx.FAKE_LINK_TOKEN) || out.text.includes(fx.FAKE_LINK_TOKEN), false, `${locale} ${name} token`);
      noBank(out, fx.viewFixture("awaiting", locale), `${locale} ${name}`);
    }
    assert.ok(outs.request.text.includes(request.view.guest.email));
    assert.ok(outs.payment.text.includes(OWNER_EMAIL_COPY.attentionWords.paid_after_expiry));
  }
});

rtest("owner payment notice words deadline_passed_part_paid as 'Pay-by date passed, part paid' (R1)", async () => {
  const { owner } = await mail();
  const job = { ...fx.paymentJobFixture("part", "en"), attentionReason: "deadline_passed_part_paid" };
  const out = owner.renderPaymentOwnerEmail(job, { brand: null });
  assert.ok(out.html.includes("Pay-by date passed, part paid"));
  assert.ok(out.text.includes("Pay-by date passed, part paid"));
});

rtest("withdrawn owner notice (R2): subject, rows, the free-again line, the dashboard link, escape and TEST", async () => {
  const { owner } = await mail();
  const job = fx.withdrawnJobFixture("ar");
  const out = owner.renderWithdrawnOwnerEmail(job, { brand: null });
  assert.equal(out.subject, "Request withdrawn: ALMAR-TEST22");
  for (const part of ["ALMAR-TEST22", job.view.guest.name, job.view.stay.title, job.view.stay.slug, stayDaysText(job.view.arrive, job.view.leave), "The nights are free again."]) {
    assert.ok(out.text.includes(part), part);
  }
  const testOut = owner.renderWithdrawnOwnerEmail(fx.withdrawnJobFixture("en", { isTest: true }), { brand: null });
  assert.equal(testOut.subject, "[TEST] Request withdrawn: ALMAR-TEST22");
  assert.ok(testOut.text.includes(OWNER_EMAIL_COPY.testBanner));
  const hostile = fx.withdrawnJobFixture("en");
  hostile.view = { ...hostile.view, guest: { ...hostile.view.guest, name: HOSTILE_LINE } };
  const hostileOut = owner.renderWithdrawnOwnerEmail(hostile, { brand: null });
  assert.equal(hostileOut.html.includes("<script"), false);
  assert.ok(hostileOut.html.includes("&lt;script&gt;"));
  assert.equal(/^Bcc:/m.test(hostileOut.text), false);
  assert.throws(() => owner.renderWithdrawnOwnerEmail({ ...job, view: { ...job.view, ref: "nope" } }, { brand: null }), /email: bad reference/);
});

rtest("the button is a square Teal fill with Ivory text; gold only as a border-top rule", async () => {
  for (const out of Object.values(await everyMail("en"))) {
    assert.match(out.html, /background(-color)?:\s*#1f3b40/i);
    assert.match(out.html, /color:\s*#fffaf0/i);
    assert.match(out.html, /border-radius:\s*0/);
    for (const m of out.html.matchAll(/[^;"]*#d4ba8a/gi)) assert.match(m[0], /border-top/, m[0]);
  }
});

rtest("shell parity with the sign-in email (E-01): the same escape and the same refusals", async () => {
  const { shell, magic } = await mail();
  const intro = `<b>"&'`;
  const signIn = magic.renderMagicLinkEmail({
    href: "https://almarprivatejourney.com/auth/confirm?token_hash=x&type=email",
    locale: "en",
    kind: "sign-in",
    copy: { subjectSignIn: "s", subjectConfirm: "c", intro, ignore: "i", button: "b" },
  });
  assert.ok(signIn.html.includes(shell.escapeHtml(intro)));
  const good = { teal: "#1f3b40", white: "#ffffff", ivory: "#fffaf0", ink: "#262626", titleFace: "Questa", bodyFace: "Lato", logoUrl: null };
  for (const bad of [
    { ...good, teal: "red" },
    { ...good, titleFace: "Comic Sans" },
    { ...good, logoUrl: "https://evil.example/logo.png" },
  ]) {
    const href = "https://almarprivatejourney.com/x";
    assert.throws(() => magic.renderMagicLinkEmail({ href, locale: "en", kind: "sign-in", copy: { subjectSignIn: "s", subjectConfirm: "c", intro: "i", ignore: "i", button: "b" }, brand: bad }));
    assert.throws(() => shell.checkedBrand(bad));
  }
  assert.doesNotThrow(() => shell.checkedBrand(good));
  assert.doesNotThrow(() => shell.checkedBrand(null));
});

rtest("renderer sources: no environment, console, resend import or the word access (E-02)", async () => {
  for (const file of [...RENDERER_FILES, "lib/booking/display-text.ts", "lib/copy/booking-email.ts"]) {
    assert.equal(/process\.env|console\.|from "resend"/.test(nc(readFileSync(file, "utf8"))), false, file);
  }
  for (const file of ["lib/email/booking-guest-mail.ts", "lib/email/booking-owner-mail.ts"]) {
    assert.equal(readFileSync(file, "utf8").includes("access"), false, `${file} names access`);
  }
  for (const file of [...RENDERER_FILES, "lib/booking/display-text.ts", "lib/copy/booking-email.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("re_") || source.includes("eyJ"), false, file);
  }
});
