import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

// Plan 03.3-24 Task 1: the one place a tel:, wa.me or mailto: href is built (contactLinks), and the page's
// metadata. Threat T-3.3-24-01: a tampered phone, URL or address throws, so the static build fails instead of
// shipping a broken or injected link.

const { getContactDetails } = await loadTs("lib/data/contact.ts");
const { contactLinks, CONTACT_PATH } = await loadTs("components/pages/contact/contact-links.ts");
const { contactMetadata } = await loadTs("components/pages/contact/contact-meta.ts");
const { CONTACT_PAGE_COPY } = await loadTs("lib/copy/contact-page.ts");
const { absoluteLocaleUrl, localeAlternates, matchPublicPage } = await loadTs("lib/locale-path.ts");

const LIVE_WA =
  "https://wa.me/971563883302?text=Hello%20ALMAR%2C%20I%20would%20like%20to%20plan%20a%20private%20journey.";

test("CONTACT_PATH is /contact", () => {
  assert.equal(CONTACT_PATH, "/contact");
});

test("en: the hrefs equal the live ones, byte for byte (the Maps one is the same search, percent-encoded)", async () => {
  const d = await getContactDetails("en");
  const l = contactLinks(d);
  assert.equal(l.whatsappMessage, LIVE_WA);
  assert.equal(l.tel, "tel:+971563883302");
  assert.equal(l.whatsapp, "https://wa.me/971563883302");
  assert.equal(l.mailto, "mailto:inquiries@almarprivatejourney.com");
  // The live page wrote Bogotá,+Colombia; the query is percent-encoded now: the same search, decoded.
  assert.equal(l.location, "https://www.google.com/maps/search/Bogot%C3%A1%2C+Colombia");
  assert.equal(decodeURIComponent(new URL(l.location).pathname), decodeURIComponent(new URL("https://www.google.com/maps/search/Bogotá,+Colombia").pathname));
  assert.deepEqual(Object.keys(l).sort(), ["location", "mailto", "tel", "whatsapp", "whatsappMessage"]);
});

for (const locale of ["ar", "es"]) {
  test(`${locale}: phone, wa.me and mailto equal en; the prefilled text decodes to this language's sentence`, async () => {
    const en = contactLinks(await getContactDetails("en"));
    const d = await getContactDetails(locale);
    const l = contactLinks(d);
    assert.equal(l.tel, en.tel);
    assert.equal(l.whatsapp, en.whatsapp);
    assert.equal(l.mailto, en.mailto);
    assert.ok(l.whatsappMessage.startsWith(`${en.whatsapp}?text=`));
    assert.equal(decodeURIComponent(l.whatsappMessage.slice(`${en.whatsapp}?text=`.length)), d.whatsapp_message);
    assert.ok(!/[^\x20-\x7e]/.test(l.whatsappMessage), "the href is plain ASCII once encoded");
  });
}

const GOOD = {
  business_name: "ALMAR Private Journeys",
  location_label: "Bogotá, Colombia",
  location_url: "https://www.google.com/maps/search/Bogot%C3%A1,+Colombia",
  phone_e164: "+971563883302",
  phone_display: "+971 56 388 3302",
  email: "inquiries@almarprivatejourney.com",
  whatsapp_message: "Hello",
  instagram_url: "https://www.instagram.com/almarprivatejourney/",
  locale: "en",
  translation_status: "published",
};

test("a good hand-built object passes (the throw cases below change one field of it)", () => {
  assert.doesNotThrow(() => contactLinks(GOOD));
});

test("a phone that is not + and 8 to 15 digits throws", () => {
  for (const phone_e164 of ["+971 56 388 3302", "javascript:alert(1)", "971563883302", "+97156", "+9715638833021234567", "", "+0"]) {
    assert.throws(() => contactLinks({ ...GOOD, phone_e164 }), /phone/i, phone_e164);
  }
});

test("a location URL that is not a plain https address throws", () => {
  for (const location_url of [
    "http://www.google.com/maps",
    "javascript:alert(1)",
    "https://",
    'https://x.com/"onmouseover="a',
    "https://x.com/a\r\nb",
    "https://x.com/a\nb",
    "https://x.com/javascript:alert(1)",
    "https://x.com/a b",
    "",
  ]) {
    assert.throws(() => contactLinks({ ...GOOD, location_url }), /location/i, JSON.stringify(location_url));
  }
});

test("an email that is not one plain local@domain.tld throws", () => {
  for (const email of [
    "nobody",
    "a@b",
    "a b@c.com",
    "a@b.com\r\nBcc: x@y.com",
    "a@b.com\n",
    "a@b.com?subject=x",
    "a@b.com&cc=x@y.com",
    "a@b.com,c@d.com",
    "a@@b.com",
    "a%0D%0ABcc%3Ax%40y.com@b.com", // decodes to CRLF + a Bcc header inside a mailto: link
    "a%0Ab@c.com",
    "50%@b.com",
    "a@x%2ey.com",
    "a;b@c.com",
    "a@b.com;c@d.com",
    "",
  ]) {
    assert.throws(() => contactLinks({ ...GOOD, email }), /email/i, JSON.stringify(email));
  }
});

// The branch for a page that is not in PUBLIC_PAGES cannot run today (both pages are public), so it is pinned in the source:
// aboutMetadata and contactMetadata fall back to the same canonical-only alternates.
test("aboutMetadata and contactMetadata use the same fallback when the page is not public: the canonical alone", async () => {
  const { readFileSync } = await import("node:fs");
  const fallback = (file, path) => {
    const m = new RegExp(`alternates:\\s*matchPublicPage\\(${path}\\)\\s*\\?\\s*localeAlternates\\(locale, ${path}\\)\\s*:\\s*([^,\\n]+),`).exec(readFileSync(file, "utf8"));
    assert.ok(m, `${file}: the alternates line was not found`);
    return m[1].trim();
  };
  assert.equal(fallback("components/pages/contact/contact-meta.ts", "CONTACT_PATH"), "{ canonical: url }");
  assert.equal(fallback("components/pages/about-page.tsx", "PATH"), "{ canonical: url }");
});

for (const locale of ["en", "ar", "es"]) {
  test(`contactMetadata(${locale}): copy, canonical, no image, no Framer host`, () => {
    const m = contactMetadata(locale);
    const copy = CONTACT_PAGE_COPY[locale];
    assert.equal(m.title, copy.meta.title);
    assert.equal(m.description, copy.meta.description);
    const url = absoluteLocaleUrl(locale, "/contact");
    assert.equal(m.alternates.canonical, url);
    // Today's branch or plan 25's, computed from the same helper, so the test passes before and after plan 25.
    if (matchPublicPage("/contact")) assert.deepEqual(m.alternates, localeAlternates(locale, "/contact"));
    else {
      assert.deepEqual(Object.keys(m.alternates), ["canonical"]);
      assert.equal("languages" in m.alternates, false);
    }
    assert.deepEqual(m.openGraph, { type: "website", title: copy.meta.title, description: copy.meta.description, url });
    assert.equal("images" in m.openGraph, false);
    assert.equal(m.twitter.card, "summary");
    assert.equal(m.twitter.title, copy.meta.title);
    assert.equal(m.twitter.description, copy.meta.description);
    assert.equal("images" in m.twitter, false);
    assert.doesNotMatch(JSON.stringify(m), /framerusercontent/);
  });
}
