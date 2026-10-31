// Plan 05-02 Task 2 (P5-05): the request_received mail of a booking the owner made by hand has its own subject, heading,
// first line and lapse sentence, and everything else (bank rows, button, link, TEST banner) is the web mail's. WRITTEN, NOT
// RUN (owner's no-test rule). Fixtures are the documentation values of tests/helpers/booking-view-fixtures.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { BOOKING_EMAIL_COPY } = await loadTs("lib/copy/booking-email.ts");
const guest = await loadTs("lib/email/booking-guest-mail.ts");
const fx = await loadTs("tests/helpers/booking-view-fixtures.ts");
const { formatAed } = await loadTs("lib/money/format.ts");
const { formatIban } = await loadTs("lib/booking/bank.ts");

const LOCALES = ["en", "ar", "es"];
const ctx = (locale) => ({ copy: BOOKING_EMAIL_COPY[locale], brand: null });
const REF = "ALMAR-TEST22";

test("hand-made copy: subject, heading, intro and lapse rule are non-empty in en, ar and es; subject and intro carry {ref}", () => {
  for (const locale of LOCALES) {
    const h = BOOKING_EMAIL_COPY[locale].requestReceived.handMade;
    for (const key of ["subject", "heading", "intro", "lapseRule"]) assert.ok(h[key].trim().length > 0, `${locale}.${key}`);
    assert.deepEqual(h.subject.match(/\{\w+\}/g), ["{ref}"], `${locale} subject`);
    assert.ok(h.intro.includes("{ref}"), `${locale} intro`);
  }
  assert.equal(BOOKING_EMAIL_COPY.en.requestReceived.handMade.heading, "Your booking is ready");
});

test("hand-made mail: its own heading and first line with the ref, not the web ones, in each language", () => {
  for (const locale of LOCALES) {
    const c = BOOKING_EMAIL_COPY[locale];
    const out = guest.renderRequestReceivedEmail({ ...fx.requestJobFixture(locale), handMade: true }, ctx(locale));
    const intro = c.requestReceived.handMade.intro.replace("{ref}", REF);
    assert.ok(out.text.includes(c.requestReceived.handMade.heading), `${locale} heading`);
    assert.ok(out.text.includes(intro), `${locale} intro`);
    assert.ok(out.text.includes(c.requestReceived.handMade.lapseRule), `${locale} lapse rule`);
    assert.equal(out.text.includes(c.requestReceived.heading), false, `${locale} web heading`);
    assert.equal(out.text.includes(c.requestReceived.intro.replace("{ref}", REF)), false, `${locale} web intro`);
    assert.equal(out.text.includes(c.transfer.lapseRule), false, `${locale} web lapse rule`);
    assert.equal(out.subject, c.requestReceived.handMade.subject.replace("{ref}", REF));
  }
});

test("hand-made mail: the same bank rows, booking button and booking link as a web job", () => {
  for (const locale of LOCALES) {
    const job = { ...fx.requestJobFixture(locale), handMade: true };
    const out = guest.renderRequestReceivedEmail(job, ctx(locale));
    const t = job.view.transfer;
    for (const part of [formatAed(t.amountFils), formatIban(t.iban), t.swift, t.accountName, t.bankName, BOOKING_EMAIL_COPY[locale].buttons.viewBooking]) {
      assert.ok(out.text.includes(part) || out.html.includes(part), `${locale}: ${part}`);
    }
    assert.ok(out.html.includes(job.bookingUrl.replace(/&/g, "&amp;")) || out.html.includes(job.bookingUrl), `${locale}: link`);
  }
});

test("without handMade the output is byte-identical to the web mail (absent and false alike)", () => {
  for (const locale of LOCALES) {
    const job = fx.requestJobFixture(locale);
    const web = guest.renderRequestReceivedEmail(job, ctx(locale));
    const falsy = guest.renderRequestReceivedEmail({ ...job, handMade: false }, ctx(locale));
    assert.deepEqual(falsy, web, locale);
    assert.ok(web.text.includes(BOOKING_EMAIL_COPY[locale].requestReceived.heading));
  }
});

test("a TEST hand-made job keeps the [TEST] subject prefix and the banner", () => {
  for (const locale of LOCALES) {
    const out = guest.renderRequestReceivedEmail({ ...fx.requestJobFixture(locale, { isTest: true }), handMade: true }, ctx(locale));
    assert.ok(out.subject.startsWith("[TEST] "), locale);
    assert.ok(out.text.includes(BOOKING_EMAIL_COPY[locale].testBanner), locale);
  }
});
