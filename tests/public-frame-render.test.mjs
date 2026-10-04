import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadRenderer } from "./helpers/render-component.mjs";

// The served markup of PublicFrame (what a visitor without JavaScript gets, and what hydration must match).
// 3.3 integration fixes: the logo goes to the locale home, the phone prints as designed, the currency select is
// controlled by the page, and the WhatsApp float takes a class.

const render = await loadRenderer("components/site/public-frame.tsx", "PublicFrame");

const FOOTER = {
  pages: "Pages",
  contact: "Contact",
  instagram: "Instagram",
  newTab: "(opens in a new tab)",
  language: "Language",
  copyright: "© ALMAR",
  brand: "ALMAR Private Journeys",
  madeBy: "Made by",
};
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
  assert.match(html, /<a class="[^"]*" dir="ltr" href="tel:\+971563883302">\+971 56 388 3302<\/a>/);
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

// ---- plan 41: the light footer ------------------------------------------------------------------------------------

const footerOf = (html) => /<footer[\s\S]*<\/footer>/.exec(html)?.[0] ?? "";

test("plan 41: the frame's footer is the light one, with the wordmark and the signed content only", () => {
  const footer = footerOf(render(props()));
  assert.match(footer, /^<footer role="contentinfo" class="[^"]*\bbg-ivory\b/);
  assert.equal(/\bbg-teal(?![-\w])/.test(footer), false);
  const imgs = footer.match(/<img [^>]*>/g) ?? [];
  assert.equal(imgs.length, 1);
  assert.match(imgs[0], /src="data:image\/svg\+xml;charset=utf-8,/);
  assert.match(imgs[0], /alt="ALMAR Private Journeys"/);
  assert.equal(/<input|<form/.test(footer), false);
  const links = (footer.match(/<a [^>]*>[\s\S]*?<\/a>/g) ?? []).map((a) => a.replace(/<[^>]*>/g, ""));
  for (const text of links) assert.equal(/facebook|youtube|tiktok|privacy|terms|legal|subscribe/i.test(text), false, text);
});

test("plan 41: one Made by Koussay link to https://koussay.com in a new tab", () => {
  const footer = footerOf(render(props()));
  const made = footer.match(/<a [^>]*href="https:\/\/koussay\.com"[^>]*>/g) ?? [];
  assert.equal(made.length, 1);
  assert.match(made[0], /target="_blank"/);
  assert.match(made[0], /rel="noopener noreferrer"/);
  assert.match(footer, /Made by/);
  assert.match(footer, />Koussay<span class="sr-only"> \(opens in a new tab\)<\/span><\/a>/);
});

test("plan 41: the tel and mailto links read left to right, in Arabic too", () => {
  for (const locale of ["en", "ar"]) {
    const footer = footerOf(render(props({ locale })));
    assert.match(footer, /<a [^>]*dir="ltr"[^>]*href="tel:\+971563883302"/, locale);
    assert.match(footer, /<a [^>]*dir="ltr"[^>]*href="mailto:inquiries@almarprivatejourney\.com"/, locale);
  }
});

test("plan 41: whatsapp={false} renders no float; the default keeps it", () => {
  assert.equal(render(props()).includes("wa.me"), true);
  assert.equal(render(props({ whatsapp: false })).includes("wa.me"), false);
  assert.equal(render(props({ whatsapp: true })).includes("wa.me"), true);
});

test("plan 41: the nav carries the load reveal", () => {
  assert.match(render(props()), /<header[^>]*data-reveal="nav"[^>]*data-reveal-on="load"/);
});

test("plan 41: SiteFooter with no tone is the footer it was (snapshot taken before this plan; only dir=ltr on tel and mailto is new)", async () => {
  const renderFooter = await loadRenderer("components/ui/footer.tsx", "SiteFooter");
  const html = renderFooter({
    copy: { pages: "Pages", contact: "Contact", instagram: "Instagram", newTab: "(opens in a new tab)", language: "Language", copyright: "© ALMAR" },
    links: [{ label: "Destinations", href: "/destinations" }, { label: "About", href: "/about" }],
    languageLinks: [
      { label: "English", href: "/", lang: "en", current: true },
      { label: "العربية", href: "/ar/", lang: "ar", current: false },
    ],
  });
  const before = readFileSync("tests/snapshots/site-footer-teal-default.html", "utf8");
  assert.equal(html.replaceAll(' dir="ltr"', ""), before);
  assert.equal(html.split(' dir="ltr"').length - 1, 2, "exactly the tel and the mailto link gain dir=ltr");
});
