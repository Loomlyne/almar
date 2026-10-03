import assert from "node:assert/strict";
import test from "node:test";
import { loadRenderer } from "./helpers/render-component.mjs";

// The served markup of PublicFrame (what a visitor without JavaScript gets, and what hydration must match).
// 3.3 integration fixes: the logo goes to the locale home, the phone prints as designed, the currency select is
// controlled by the page, and the WhatsApp float takes a class.

const render = await loadRenderer("components/site/public-frame.tsx", "PublicFrame");

const FOOTER = { pages: "Pages", contact: "Contact", instagram: "Instagram", newTab: "(opens in a new tab)", language: "Language", copyright: "© ALMAR" };
const LINKS = [{ label: "Destinations", href: "/destinations" }];
const props = (over = {}) => ({
  locale: "en",
  currentPath: "/private-stays/getsemani-colonial-house",
  links: LINKS,
  footerLinks: LINKS,
  footerCopy: FOOTER,
  children: null,
  ...over,
});
const logoHref = (html) => /<a href="([^"]*)" aria-label="ALMAR Private Journeys home"/.exec(html)?.[1];

test("the default logo link is the locale home, not the page's own address (slash rule for locale roots)", () => {
  for (const [locale, home] of [["en", "/"], ["ar", "/ar/"], ["es", "/es/"]]) {
    for (const currentPath of ["/", "/private-stays", "/private-stays/getsemani-colonial-house"]) {
      assert.equal(logoHref(render(props({ locale, currentPath }))), home, `${locale} ${currentPath}`);
    }
  }
});

test("an explicit homeHref still wins", () => {
  assert.equal(logoHref(render(props({ locale: "ar", homeHref: "/ar/elsewhere" }))), "/ar/elsewhere");
});

test("the language links still go to this page in each language", () => {
  const html = render(props({ locale: "ar", currentPath: "/private-stays" }));
  for (const href of ["/private-stays", "/ar/private-stays", "/es/private-stays"]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
});

test("the footer prints the phone as designed and dials the digits", () => {
  const html = render(props());
  assert.match(html, /<a class="[^"]*" href="tel:\+971563883302">\+971 56 388 3302<\/a>/);
  assert.equal(html.includes(">+971563883302<"), false);
});

const currencyLabel = (html) => /role="combobox"[^>]*aria-label="(Currency[^"]*)"/.exec(html)?.[1] ?? null;

test("no currency select unless a page passes its state", () => {
  assert.equal(currencyLabel(render(props())), null);
  assert.equal(currencyLabel(render(props({ currency: false }))), null);
});

test("a controlled currency shows the page's value, and null means nothing chosen yet", () => {
  const onChange = () => {};
  assert.equal(currencyLabel(render(props({ currency: { selected: null, onChange } }))), "Currency: Currency");
  for (const code of ["AED", "USD", "EUR"]) {
    assert.equal(currencyLabel(render(props({ currency: { selected: code, onChange } }))), `Currency: ${code}`);
  }
});

test("the WhatsApp float: base classes by default, the page's class merged when given", () => {
  const plain = render(props());
  const lifted = render(props({ whatsappClassName: "bottom-dock mb-4" }));
  const classOf = (html) => /<a class="([^"]*)" href="https:\/\/wa\.me\/971563883302"/.exec(html)?.[1].split(/\s+/) ?? [];
  assert.ok(classOf(plain).includes("bottom-4"));
  assert.equal(classOf(plain).includes("bottom-dock"), false);
  assert.ok(classOf(lifted).includes("bottom-dock") && classOf(lifted).includes("mb-4"));
  assert.equal(classOf(lifted).includes("bottom-4"), false, "bottom-dock replaces bottom-4");
});
