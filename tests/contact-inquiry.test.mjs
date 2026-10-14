import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

// Plan 03.3-26 Task 1: lib/contact-inquiry.ts, the rules the Contact form and POST /api/contact share.

const m = await loadTs("lib/contact-inquiry.ts");
const FILE = "lib/contact-inquiry.ts";

const VALID = {
  name: "Ana López",
  phone: "+57 300 123 4567",
  email: "ana.lopez@example.co",
  journeyType: "Full Journey",
  details: "Ten days, two adults.\nCartagena first.",
  locale: "es",
};
const errorsOf = (input) => {
  const r = m.validateInquiry({ ...VALID, ...input });
  return r.ok ? {} : r.errors;
};

test("the constants: address, journey types, field names, limits", () => {
  assert.equal(m.INQUIRY_ADDRESS, "inquiries@almarprivatejourney.com");
  assert.deepEqual([...m.JOURNEY_TYPES], ["Experiences", "Services", "Full Journey", "Group Event", "General Question"]);
  assert.deepEqual(m.INQUIRY_FIELD, {
    name: "Name",
    phone: "Phone",
    email: "Email",
    journeyType: "Journey Type",
    details: "Journey Details",
    locale: "Locale",
  });
  assert.deepEqual(m.INQUIRY_LIMITS, { name: 100, phone: 40, email: 254, details: 4000, body: 16384 });
  // No field name is a honeypot, in any case.
  const traps = new Set(m.HONEYPOT_FIELDS.map((n) => n.toLowerCase()));
  for (const name of Object.values(m.INQUIRY_FIELD)) assert.equal(traps.has(name.toLowerCase()), false, name);
});

test("INQUIRY_ADDRESS is the one contact address: lib/data, the site frame and the footer agree", async () => {
  const { getContactDetails } = await loadTs("lib/data/contact.ts");
  assert.equal((await getContactDetails("en")).email, m.INQUIRY_ADDRESS);
  for (const file of ["components/site/public-frame.tsx", "components/ui/footer.tsx"]) {
    const found = /^\s*email: "([^"]+)",$/m.exec(readFileSync(file, "utf8"));
    assert.ok(found, `${file}: email line`);
    assert.equal(found[1], m.INQUIRY_ADDRESS, file);
  }
});

test("HONEYPOT_FIELDS equals the newsletter route's list, same order", () => {
  const source = readFileSync("app/newsletter/route.ts", "utf8");
  const block = /const HONEYPOT_FIELDS = \[([\s\S]*?)\] as const;/.exec(source);
  assert.ok(block, "list in app/newsletter/route.ts");
  const names = [...block[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.equal(names.length, 11);
  assert.deepEqual([...m.HONEYPOT_FIELDS], names);
});

test("a valid inquiry: cleaned values, phone kept, English journey type, locale", () => {
  const r = m.validateInquiry({ ...VALID, name: "  Ana \t López ", email: " ana.lopez@example.co\n", details: " a\r\nb\rc\t. " });
  assert.equal(r.ok, true);
  assert.deepEqual(r.inquiry, {
    name: "Ana López",
    phone: "+57 300 123 4567",
    email: "ana.lopez@example.co",
    journeyType: "Full Journey",
    details: "a\nb\nc\t.",
    locale: "es",
  });
});

test("an empty phone is no error and becomes null", () => {
  for (const phone of ["", "   ", undefined, null]) {
    const r = m.validateInquiry({ ...VALID, phone });
    assert.equal(r.ok, true, String(phone));
    assert.equal(r.inquiry.phone, null);
  }
});

test("missing name, email, journey type and details are required; whitespace counts as missing", () => {
  assert.deepEqual(errorsOf({ name: "", email: " ", journeyType: "", details: "\n\t " }), {
    name: "required",
    email: "required",
    journeyType: "required",
    details: "required",
  });
  const none = m.validateInquiry({});
  assert.equal(none.ok, false);
  assert.deepEqual(none.errors, { name: "required", email: "required", journeyType: "required", details: "required", locale: "invalid" });
});

test("length caps after cleaning", () => {
  assert.equal(errorsOf({ name: "a".repeat(100) }).name, undefined);
  assert.equal(errorsOf({ name: "a".repeat(101) }).name, "tooLong");
  assert.equal(errorsOf({ name: ` ${"a".repeat(100)} ` }).name, undefined, "trimmed first");
  assert.equal(errorsOf({ phone: "1".repeat(41) }).phone, "tooLong");
  assert.equal(errorsOf({ email: `${"a".repeat(243)}@example.com` }).email, "tooLong");
  assert.equal(errorsOf({ email: `${"a".repeat(242)}@example.com` }).email, undefined);
  assert.equal(errorsOf({ details: "x".repeat(4000) }).details, undefined);
  assert.equal(errorsOf({ details: "x".repeat(4001) }).details, "tooLong");
});

test("email: one plain address only", () => {
  for (const bad of [
    "a",
    "a@b",
    "a@b.",
    "a b@c.com",
    "a@b.com,c@d.com",
    "a@b.com;c@d.com",
    "<a@b.com>",
    '"a"@b.com',
    "a@b.com\r\nBcc: x@y.com",
    "a@b.com\nBcc: x@y.com",
    "a@@b.com",
    "a(b)@c.com",
    "a@b.com\u0000",
    "a\\b@c.com",
    "a:b@c.com",
    // Review fix (3.3 part B): accepted by the old pattern.
    "a@..b",
    "a@.b.c",
    "a@b.com.",
    "a@-b.com",
  ]) {
    assert.equal(errorsOf({ email: bad }).email, "invalid", JSON.stringify(bad));
  }
  for (const good of ["ana.lopez@example.co", " ana.lopez@example.co\n", "o'brien+trip@mail.example.com"]) {
    assert.equal(errorsOf({ email: good }).email, undefined, JSON.stringify(good));
  }
  assert.equal(m.isInquiryEmail("ana.lopez@example.co"), true);
  assert.equal(m.isInquiryEmail(" ana.lopez@example.co"), false, "the caller trims");
});

test("phone: digits as people write them, at least six, no control character", () => {
  for (const good of ["+57 300 123 4567", "(971) 56-388-3302", "123456", "+971.56.388.3302"]) {
    assert.equal(errorsOf({ phone: good }).phone, undefined, good);
  }
  for (const bad of ["call me", "12345", "+57\n300 123 4567", "+57\r300", "+57 300; 1", "+1 555 0100 x2"]) {
    assert.equal(errorsOf({ phone: bad }).phone, "invalid", JSON.stringify(bad));
  }
});

test("journey type: only the five English values", () => {
  for (const t of m.JOURNEY_TYPES) assert.equal(errorsOf({ journeyType: t }).journeyType, undefined, t);
  assert.equal(errorsOf({ journeyType: "experiences" }).journeyType, "invalid");
  assert.equal(errorsOf({ journeyType: "Cruise" }).journeyType, "invalid");
  assert.equal(errorsOf({ journeyType: "Experiencias" }).journeyType, "invalid", "a label is not a value");
  assert.equal(errorsOf({ journeyType: "" }).journeyType, "required");
});

test("locale: en, ar or es", () => {
  for (const l of ["en", "ar", "es"]) assert.equal(errorsOf({ locale: l }).locale, undefined, l);
  for (const l of ["fr", "", "EN", " en"]) assert.equal(errorsOf({ locale: l }).locale, "invalid", JSON.stringify(l));
});

test("cleanLine: no control character, separator or bidi override survives; whitespace collapsed; NFC", () => {
  assert.equal(m.cleanLine("Ana\r\nBcc: x@y.com"), "Ana Bcc: x@y.com");
  assert.equal(m.cleanLine("a\u0000b\u001fc\u007fd\u0085e\u009ff"), "a b c d e f");
  assert.equal(m.cleanLine("a\u2028b\u2029c"), "a b c");
  assert.equal(m.cleanLine("a\u202eb\u2066c\u2069"), "a b c");
  assert.equal(m.cleanLine("  a \t\t b  "), "a b");
  assert.equal(m.cleanLine("Jose\u0301"), "José".normalize("NFC"));
  assert.equal(/[\u0000-\u001f\u007f-\u009f]/.test(m.cleanLine("x\r\n\t\u000by")), false);
});

test("cleanText: keeps LF and tab, turns CRLF and CR into LF, drops every other control character, trims", () => {
  assert.equal(m.cleanText("a\r\nb\rc\nd"), "a\nb\nc\nd");
  assert.equal(m.cleanText("a\tb"), "a\tb");
  assert.equal(m.cleanText("a\u0000b\u0007c\u000bd\u007fe\u0085f\u2028g"), "abcdefg");
  assert.equal(m.cleanText("  \n hello \n  "), "hello");
});

test("honeypotTripped: any trap with a non-whitespace value", () => {
  const empty = () => null;
  assert.equal(m.honeypotTripped(empty), false);
  assert.equal(m.honeypotTripped(() => "   "), false);
  for (const field of m.HONEYPOT_FIELDS) {
    assert.equal(m.honeypotTripped((n) => (n === field ? "bot" : "")), true, field);
  }
  assert.equal(m.honeypotTripped((n) => (n === "Name" ? "Ana" : null)), false, "a real field is not a trap");
});

test("composeInquiryEmail: from and to ALMAR, reply-to the visitor, a clean subject, plain text only", () => {
  const r = m.validateInquiry({ ...VALID, name: "Ana\r\nBcc: evil@example.com" });
  assert.equal(r.ok, true);
  const mail = m.composeInquiryEmail(r.inquiry);
  assert.deepEqual(Object.keys(mail).sort(), ["from", "replyTo", "subject", "text", "to"]);
  assert.equal(mail.from, m.INQUIRY_ADDRESS);
  assert.equal(mail.to, m.INQUIRY_ADDRESS);
  assert.equal(mail.replyTo, "ana.lopez@example.co");
  assert.equal(mail.subject, "Website inquiry · Full Journey · Ana Bcc: evil@example.com");
  assert.equal(/[\r\n\u0000-\u001f\u007f-\u009f]/.test(mail.subject), false);
  assert.equal(
    mail.text,
    [
      "Name: Ana Bcc: evil@example.com",
      "Phone / WhatsApp: +57 300 123 4567",
      "Email: ana.lopez@example.co",
      "Journey type: Full Journey",
      "Language: es",
      "Page: https://almarprivatejourney.com/es/contact",
      "",
      "Message:",
      "Ten days, two adults.\nCartagena first.",
    ].join("\n"),
  );
  const noPhone = m.composeInquiryEmail(m.validateInquiry({ ...VALID, phone: "", locale: "en" }).inquiry);
  assert.ok(noPhone.text.includes("\nPhone / WhatsApp: -\n"));
  assert.ok(noPhone.text.includes("\nPage: https://almarprivatejourney.com/contact\n"));
});

test("the module is a leaf: its imports are ./email-address (the shared address rule) and ./locale-path", () => {
  const source = readFileSync(FILE, "utf8");
  const specifiers = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((x) => x[1]);
  assert.deepEqual(specifiers, ["./email-address", "./locale-path"]);
  assert.equal(source.includes("re_"), false);
});
