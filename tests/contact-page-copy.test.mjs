import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";
import { CONTACT_PAGE_COPY } from "../lib/copy/contact-page.ts";
import { SITE_FOOTER_COPY } from "../lib/copy/site-footer.ts";

// lib/contact-inquiry.ts imports ./locale-path without an extension, so it is bundled, not imported directly.
const { INQUIRY_ADDRESS, JOURNEY_TYPES } = await loadTs("lib/contact-inquiry.ts");

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
    "startInquiry",
    "form",
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
  const { newTab, startInquiry: _start, form: _form, ...rest } = CONTACT_PAGE_COPY.en;
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
    }
    // The two form actions exist once each, in their own keys (plan 26; held until then).
    const { startInquiry, form, ...rest } = CONTACT_PAGE_COPY[l];
    for (const s of strings(rest)) assert.doesNotMatch(s, /start your inquiry|request consultation/i, `${l}: ${s}`);
    assert.ok(startInquiry && form.submit, l);
  }
});

// Plan 26: the form's strings as the owner signed them on the part B pictures (2026-10-14,
// s3-pictures/partb-states.json: f_*, sending, wa_btn, e_*, sent, failed). The pictures fill e_long with 4000 and
// failed's five parts with the address and the WhatsApp word; the copy keeps `{max}`, `{email}` and `{whatsapp}`.
const SIGNED = {
  en: {
    f_name: "Your Name", f_phone: "Phone / WhatsApp", f_mail: "Email", f_type: "Journey Type", f_placeholder: "Select type",
    f_types: ["Experiences", "Services", "Full Journey", "Group Event", "General Question"],
    f_msg: "Tell Us About Your Journey", f_send: "Request Consultation", sending: "Sending…", wa_btn: "Message on WhatsApp",
    e_name: "Enter your name.", e_mail_req: "Enter your email address.", e_mail_bad: "Check the email address.",
    e_phone: "Check the phone number.", e_type: "Choose a journey type.", e_msg: "Write a few words about your journey.",
    e_long: "Keep this under 4000 characters.", sent: "Your message was sent.",
    failed: ["It did not send. Write to ", "inquiries@almarprivatejourney.com", " or message us on ", "WhatsApp", "."],
    heading: "Tell us about your journey", start: "Start Your Inquiry",
  },
  ar: {
    f_name: "الاسم", f_phone: "الهاتف / واتساب", f_mail: "البريد الإلكتروني", f_type: "نوع الرحلة", f_placeholder: "اختاروا النوع",
    f_types: ["تجارب", "خدمات", "رحلة كاملة", "فعالية جماعية", "سؤال عام"],
    f_msg: "أخبرونا عن رحلتكم", f_send: "اطلبوا استشارة", sending: "جارٍ الإرسال…", wa_btn: "راسلونا على واتساب",
    e_name: "أدخلوا اسمكم.", e_mail_req: "أدخلوا بريدكم الإلكتروني.", e_mail_bad: "تحقّقوا من البريد الإلكتروني.",
    e_phone: "تحقّقوا من رقم الهاتف.", e_type: "اختاروا نوع الرحلة.", e_msg: "اكتبوا بضع كلمات عن رحلتكم.",
    e_long: "لا تتجاوزوا 4000 حرف.", sent: "أُرسلت رسالتكم.",
    failed: ["لم تُرسَل الرسالة. راسلونا على ", "inquiries@almarprivatejourney.com", " أو على ", "واتساب", "."],
    heading: "أخبرونا عن رحلتكم", start: "ابدأوا استفساركم",
  },
  es: {
    f_name: "Tu nombre", f_phone: "Teléfono / WhatsApp", f_mail: "Correo electrónico", f_type: "Tipo de viaje", f_placeholder: "Elige el tipo",
    f_types: ["Experiencias", "Servicios", "Viaje completo", "Evento de grupo", "Pregunta general"],
    f_msg: "Cuéntanos sobre tu viaje", f_send: "Solicita una consulta", sending: "Enviando…", wa_btn: "Escríbenos por WhatsApp",
    e_name: "Escribe tu nombre.", e_mail_req: "Escribe tu correo electrónico.", e_mail_bad: "Revisa el correo electrónico.",
    e_phone: "Revisa el número de teléfono.", e_type: "Elige un tipo de viaje.", e_msg: "Escribe unas palabras sobre tu viaje.",
    e_long: "Usa menos de 4000 caracteres.", sent: "Tu mensaje se envió.",
    failed: ["No se envió. Escribe a ", "inquiries@almarprivatejourney.com", " o escríbenos por ", "WhatsApp", "."],
    heading: "Cuéntanos sobre tu viaje", start: "Inicia tu consulta",
  },
};

const SIGNED_JSON = ".planning/phases/03.3-public-site-in-react/s3-pictures/partb-states.json";

test("the signed table above is the signed JSON (skipped once the pictures folder is archived)", (t) => {
  if (!existsSync(SIGNED_JSON)) return t.skip(`${SIGNED_JSON} is gone`);
  const json = JSON.parse(readFileSync(SIGNED_JSON, "utf8"));
  for (const l of LOCALES) {
    for (const [key, value] of Object.entries(SIGNED[l])) {
      if (key === "heading" || key === "start") continue;
      assert.deepEqual(json[l][key], value, `${l}.${key}`);
    }
  }
});

for (const l of LOCALES) {
  test(`${l}: the form strings are the signed ones, verbatim`, () => {
    const c = CONTACT_PAGE_COPY[l];
    const f = c.form;
    const want = SIGNED[l];
    assert.equal(c.startInquiry, want.start);
    assert.equal(f.heading, want.heading);
    assert.equal(f.name, want.f_name);
    assert.equal(f.phone, want.f_phone);
    assert.equal(f.email, want.f_mail);
    assert.equal(f.journeyType, want.f_type);
    assert.equal(f.journeyTypePlaceholder, want.f_placeholder);
    assert.deepEqual(Object.keys(f.journeyTypes), [...JOURNEY_TYPES]);
    assert.deepEqual(JOURNEY_TYPES.map((t) => f.journeyTypes[t]), want.f_types);
    assert.equal(f.details, want.f_msg);
    assert.equal(f.submit, want.f_send);
    assert.equal(f.sending, want.sending);
    assert.equal(c.whatsappCta, want.wa_btn);
    assert.deepEqual(f.errors, {
      nameRequired: want.e_name,
      emailRequired: want.e_mail_req,
      emailInvalid: want.e_mail_bad,
      phoneInvalid: want.e_phone,
      journeyTypeRequired: want.e_type,
      detailsRequired: want.e_msg,
      tooLong: f.errors.tooLong,
    });
    assert.equal(f.errors.tooLong.split("{max}").length, 2, "one {max}");
    assert.equal(f.errors.tooLong.replace("{max}", "4000"), want.e_long);
    assert.equal(f.sent, want.sent);
    assert.equal(f.failed.split("{email}").length, 2, "one {email}");
    assert.equal(f.failed.split("{whatsapp}").length, 2, "one {whatsapp}");
    assert.equal(want.failed[1], INQUIRY_ADDRESS);
    assert.equal(f.whatsappWord, want.failed[3]);
    assert.equal(f.failed.replace("{email}", INQUIRY_ADDRESS).replace("{whatsapp}", f.whatsappWord), want.failed.join(""));
  });
}

test("the form copy carries no privacy, consent or legal line, and no example address or price", () => {
  for (const l of LOCALES) {
    for (const s of [CONTACT_PAGE_COPY[l].startInquiry, ...strings(CONTACT_PAGE_COPY[l].form)]) {
      assert.doesNotMatch(s, /privacy|consent|terms|privacidad|consentimiento|خصوصية|موافقة/i, `${l}: ${s}`);
      assert.doesNotMatch(s, /example\.|@|\$|USD|COP|AED/, `${l}: ${s}`);
    }
  }
});

test("the copy file is not registered in lib/copy/index.ts (R-9)", () => {
  assert.equal(readFileSync("lib/copy/index.ts", "utf8").includes("contact-page"), false);
});
