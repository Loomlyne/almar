// Plan 06-05 Task 3: the three signed emails. Written, not run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { composeRequestEmail, composeConsultationOwnerEmail, renderConsultationGuestEmail, printedWhatsapp } = await loadTs("lib/site-requests/email.ts");
const { INQUIRY_ADDRESS } = await loadTs("lib/contact-inquiry.ts");
const { SITE_REQUESTS_COPY } = await loadTs("lib/copy/site-requests.ts");
const { ALMAR_WHATSAPP_NUMBER } = await loadTs("lib/whatsapp-request.ts");

const PLAN = { name: "Ana\r\nBcc: x@y.z", email: "ana@example.com", phone: "+34 600 000 000", destination: "Cartagena", from: "2026-12-12", to: "2026-12-19", guests: 2, budget: "around 20k", airport: "DXB", notes: "Quiet, please" };

test("composeRequestEmail: from and to the inbox, reply-to the guest, cleaned subject, no html, no cc or headers", () => {
  const email = composeRequestEmail("plan", "en", PLAN, "r-1");
  assert.equal(email.from, INQUIRY_ADDRESS);
  assert.equal(email.to, INQUIRY_ADDRESS);
  assert.equal(email.replyTo, "ana@example.com");
  assert.equal(email.subject, "Plan with us: Ana Bcc: x@y.z");
  assert.deepEqual(Object.keys(email).sort(), ["from", "replyTo", "subject", "text", "to"]);
});

test("composeRequestEmail: the signed body, plan", () => {
  const { text } = composeRequestEmail("plan", "en", { ...PLAN, name: "Ana" }, "r-1");
  assert.equal(
    text,
    [
      "Plan with us request",
      "",
      "Name: Ana",
      "Email: ana@example.com",
      "Phone / WhatsApp: +34 600 000 000",
      "Destination: Cartagena",
      "Dates: 12 Dec 2026 to 19 Dec 2026",
      "Guests: 2",
      "Budget: around 20k",
      "Arriving at: Dubai International (DXB)",
      "Trip notes: Quiet, please",
      "",
      "Language of the page: EN",
      "Saved in the dashboard under Requests (id r-1).",
      "Reply to this email to answer the guest.",
    ].join("\n"),
  );
});

test("composeRequestEmail: extra lines follow the payload lines, cleaned", () => {
  const { text } = composeRequestEmail("package", "es", { name: "Ana", email: "a@b.co", tier_slug: "grand-tour" }, "r-2", ["Package name: Grand\nTour"]);
  const lines = text.split("\n");
  assert.ok(lines.indexOf("Package name: Grand Tour") > lines.indexOf("Package: grand-tour"));
  assert.ok(lines.indexOf("Package name: Grand Tour") < lines.indexOf("Language of the page: ES"));
});

const guest = (locale, over = {}) =>
  renderConsultationGuestEmail({
    locale,
    name: "<b>Ana</b>",
    startIso: "2026-11-03T11:00:00.000Z",
    timeZone: "Europe/Madrid",
    phone: "+34 600 000 000",
    whatsappNumber: printedWhatsapp(ALMAR_WHATSAPP_NUMBER),
    copy: SITE_REQUESTS_COPY[locale].guestEmail,
    ...over,
  });

test("the printed number is the site's", () => {
  assert.equal(printedWhatsapp(ALMAR_WHATSAPP_NUMBER), /phone: "([^"]+)"/.exec(readFileSync("components/site/public-frame.tsx", "utf8"))[1]);
});

test("renderConsultationGuestEmail: every value escaped, both times, the call, reply to cancel, the invitation", () => {
  const { html, text, subject } = guest("en");
  assert.equal(subject, SITE_REQUESTS_COPY.en.guestEmail.subject);
  assert.equal(html.includes("<b>Ana</b>"), false);
  assert.ok(html.includes("&lt;b&gt;Ana&lt;/b&gt;"));
  for (const part of [text, html]) {
    assert.ok(part.includes("12:00"), "her time");
    assert.ok(part.includes("15:00"), "Dubai's");
    assert.ok(part.includes(SITE_REQUESTS_COPY.en.guestEmail.cancel));
    assert.ok(part.includes(SITE_REQUESTS_COPY.en.guestEmail.ics));
    assert.ok(part.includes("+971 56 388 3302"));
  }
});

test("renderConsultationGuestEmail: rtl for Arabic, its faces; Teal fill and White text on the button; gold is never a fill", () => {
  const { html } = guest("ar");
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.ok(html.includes("Noto Sans Arabic"));
  assert.match(html, /background:#1f3b40;color:#ffffff/);
  assert.equal(/background:#d4ba8a/.test(html), false);
  assert.equal(/border-radius:(?!0)/.test(html), false);
});

test("renderConsultationGuestEmail: a brand that fails the check is refused", () => {
  assert.throws(() => guest("en", { brand: { teal: "red", white: "#ffffff", ivory: "#fffaf0", ink: "#262626", titleFace: "Questa", bodyFace: "Lato", logoUrl: null } }));
});

test("composeConsultationOwnerEmail: plain English, Dubai first, the guest as reply-to, the signed subject", () => {
  const email = composeConsultationOwnerEmail({
    payload: { name: "Ana", email: "ana@example.com", phone: "+34 600 000 000", notes: "Hi", slot_start: "x", time_zone: "Europe/Madrid" },
    requestId: "r-3",
    startIso: "2026-11-03T11:00:00.000Z",
    timeZone: "Europe/Madrid",
  });
  assert.equal(email.subject, "Consultation: Ana, 3 Nov 15:00 Dubai");
  assert.equal(email.replyTo, "ana@example.com");
  assert.deepEqual(Object.keys(email).sort(), ["from", "replyTo", "subject", "text", "to"]);
  assert.ok(email.text.indexOf("Dubai time: Tuesday 3 November 2026, 15:00") < email.text.indexOf("Guest time: Tuesday 3 November, 12:00 (Europe/Madrid)"));
  assert.ok(email.text.includes("Saved in the dashboard under Requests (id r-3). Cancel it there to free the slot."));
});
