import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { CONTACT_PAGE_COPY } from "../lib/copy/contact-page.ts";
import { SITE_FOOTER_COPY } from "../lib/copy/site-footer.ts";

// Plan 03.3-24 Task 1: the Contact page's copy. Same key-tree walk as tests/home-page-copy.test.mjs, the live
// English pinned as literals (and, while app/contact/route.ts exists, proven present in its decoded text), the
// canvas-approved Arabic and Spanish headings, the footer table kept out (S3-24) and the strings the owner
// refused (partnerships, General Info, the form) kept out.

const FILE = "lib/copy/contact-page.ts";
const LOCALES = ["en", "ar", "es"];
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function walk(en, other, path, problems) {
  if (isObj(en)) {
    if (!isObj(other)) return problems.push(`${path}: expected object`);
    for (const key of Object.keys(en)) {
      if (!(key in other)) problems.push(`${path}.${key}: missing`);
      else walk(en[key], other[key], `${path}.${key}`, problems);
    }
    for (const key of Object.keys(other)) if (!(key in en)) problems.push(`${path}.${key}: not in en`);
  } else if (typeof en === "string") {
    if (typeof other !== "string") problems.push(`${path}: expected string`);
    else if (other.trim() === "") problems.push(`${path}: empty string`);
  } else problems.push(`${path}: a value that is neither object nor string`);
}

function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (isObj(value)) for (const v of Object.values(value)) strings(v, out);
  return out;
}

test("the three locales exist, in this order", () => {
  assert.deepEqual(Object.keys(CONTACT_PAGE_COPY).sort(), [...LOCALES].sort());
});

for (const locale of ["ar", "es"]) {
  test(`${FILE}: every en key exists in ${locale} with a non-empty value, and no other key`, () => {
    const problems = [];
    walk(CONTACT_PAGE_COPY.en, CONTACT_PAGE_COPY[locale], `${FILE} [${locale}]`, problems);
    assert.deepEqual(problems, []);
  });
}

test("the key tree is the one the page reads, and has no footer key (S3-24)", () => {
  assert.deepEqual(Object.keys(CONTACT_PAGE_COPY.en), [
    "meta",
    "title",
    "details",
    "whatsappCta",
    "confidence",
    "team",
    "newTab",
  ]);
  assert.deepEqual(Object.keys(CONTACT_PAGE_COPY.en.meta), ["title", "description"]);
  assert.deepEqual(Object.keys(CONTACT_PAGE_COPY.en.title), ["kicker", "heading", "intro"]);
  assert.deepEqual(Object.keys(CONTACT_PAGE_COPY.en.details), ["location", "phone", "inquiryLine", "whatsapp", "email"]);
  assert.deepEqual(Object.keys(CONTACT_PAGE_COPY.en.confidence), ["heading", "body"]);
  assert.deepEqual(Object.keys(CONTACT_PAGE_COPY.en.team), ["title"]);
  for (const l of LOCALES) assert.ok(!("footer" in CONTACT_PAGE_COPY[l]), `${l} has a footer key`);
});

const EN = {
  meta: {
    title: "Book with ALMAR | Contact",
    description:
      "Call +971 56 388 3302 or email inquiries@almarprivatejourney.com. Tell us your dates and we plan the rest.",
  },
  title: {
    kicker: "Private Journeys",
    heading: "Plan Your Journey",
    intro: "Your private Colombia journey begins with a message. Share your vision and our team will craft every detail.",
  },
  details: { location: "Location", phone: "Phone", inquiryLine: "Inquiry Line", whatsapp: "WhatsApp", email: "Email" },
  whatsappCta: "Message on WhatsApp",
  confidence: {
    heading: "Travel With Confidence",
    body: "Every journey is planned with selected local partners, private transfer coordination, bilingual trip support, and a 24/7 emergency contact. Additional security, insurance, and medical arrangements are confirmed before booking.",
  },
  team: { title: "You’ll be in good hands." },
};

test("EN is the live Framer contact page, verbatim", () => {
  const { newTab, ...rest } = CONTACT_PAGE_COPY.en;
  assert.deepEqual(rest, EN);
  assert.equal(newTab, SITE_FOOTER_COPY.en.newTab);
});

test("while app/contact/route.ts exists, every EN line is in its decoded text (skipped once it is deleted)", (t) => {
  if (!existsSync("app/contact/route.ts")) return t.skip("app/contact/route.ts is gone (plan 24 task 2 deleted it)");
  const line = readFileSync("app/contact/route.ts", "utf8")
    .split("\n")
    .find((l) => l.startsWith("const HTML = "));
  assert.ok(line, "HTML constant not found");
  const html = JSON.parse(line.slice("const HTML = ".length).replace(/;$/, ""));
  const decode = (s) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/’/g, "'");
  const text = decode(html);
  const want = [
    EN.meta.title,
    EN.meta.description,
    EN.title.kicker,
    EN.title.heading,
    EN.title.intro,
    EN.details.location,
    EN.details.phone,
    EN.details.whatsapp,
    EN.details.email,
    // The live text holds "Inquiry Line:"; the colon is dropped on purpose (a label, not a sentence).
    EN.details.inquiryLine + ":",
    EN.whatsappCta,
    EN.confidence.heading,
    EN.confidence.body,
    "good hands.",
  ];
  for (const w of want) assert.ok(text.includes(decode(w)), `not on the live Contact page: ${w}`);
});

test("the headings the canvas approved, in Arabic and Spanish", () => {
  assert.equal(CONTACT_PAGE_COPY.ar.title.heading, "خطط لرحلتك");
  assert.equal(CONTACT_PAGE_COPY.ar.confidence.heading, "سافر بثقة");
  assert.equal(CONTACT_PAGE_COPY.es.title.heading, "Planifica tu viaje");
  assert.equal(CONTACT_PAGE_COPY.es.confidence.heading, "Viaja con confianza");
});

test("the Arabic strings the owner saw on the signed pictures (mock.py T['ar'], mock2.py Phone label)", () => {
  const ar = CONTACT_PAGE_COPY.ar;
  assert.equal(ar.title.kicker, "رحلات خاصة");
  assert.equal(ar.title.intro, "تبدأ رحلتكم الخاصة في كولومبيا برسالة. شاركونا رؤيتكم وسيعتني فريقنا بكل تفصيل.");
  assert.equal(ar.details.location, "الموقع");
  assert.equal(ar.details.phone, "الهاتف");
  assert.equal(ar.details.inquiryLine, "خط الاستفسارات");
  assert.equal(ar.details.whatsapp, "واتساب");
  assert.equal(ar.details.email, "البريد الإلكتروني");
  assert.equal(ar.whatsappCta, "راسلونا على واتساب");
  assert.equal(
    ar.confidence.body,
    "تُخطَّط كل رحلة مع شركاء محليين مختارين، وتنسيق للتنقلات الخاصة، ودعم ثنائي اللغة، ورقم طوارئ على مدار الساعة. وتُؤكَّد ترتيبات الأمن والتأمين والرعاية الطبية الإضافية قبل الحجز.",
  );
  assert.equal(CONTACT_PAGE_COPY.es.details.phone, "Teléfono");
});

test("newTab equals the footer table's line in every locale (one wording per language)", () => {
  for (const l of LOCALES) assert.equal(CONTACT_PAGE_COPY[l].newTab, SITE_FOOTER_COPY[l].newTab, l);
});

test("every meta description keeps the phone and the email byte-identical", () => {
  for (const l of LOCALES) {
    const d = CONTACT_PAGE_COPY[l].meta.description;
    assert.ok(d.includes("+971 56 388 3302"), `${l}: phone`);
    assert.ok(d.includes("inquiries@almarprivatejourney.com"), `${l}: email`);
  }
});

test("no locale carries a string the owner refused or a foreign host", () => {
  for (const l of LOCALES) {
    for (const s of strings(CONTACT_PAGE_COPY[l])) {
      assert.doesNotMatch(s, /partnerships/i, `${l}: ${s}`);
      assert.doesNotMatch(s, /general info/i, `${l}: ${s}`);
      assert.doesNotMatch(s, /^inquiries$/i, `${l}: ${s}`);
      assert.doesNotMatch(s, /nothing on this page is sent/i, `${l}: ${s}`);
      assert.doesNotMatch(s, /framerusercontent|catbox|pexels/i, `${l}: ${s}`);
      assert.doesNotMatch(s, /start your inquiry|request consultation/i, `${l}: ${s}`);
    }
  }
});

test("the copy file is not registered in lib/copy/index.ts (R-9)", () => {
  assert.equal(readFileSync("lib/copy/index.ts", "utf8").includes("contact-page"), false);
});
