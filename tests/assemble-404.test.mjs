import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOT_FOUND_COPY, NOT_FOUND_HEADING, NOT_FOUND_HREF, NOT_FOUND_LINK_LABEL, NOT_FOUND_TITLE, renderStaticNotFound } from "../lib/not-found-document.ts";
import { LOCALES, localeDir, localePath } from "../lib/locale-path.ts";

test("static 404 html matches the contract and the assemble script ignores the catch-all", () => {
  const html = renderStaticNotFound();
  assert.match(html, /Page not found/);
  assert.match(html, /Return home/);
  assert.match(html, /href="\/"/);
  assert.match(html, /Curves_black\.svg/);
  assert.equal(html.includes("Bricolage"), false);
  assert.equal(html.includes("#f9f6f3"), false);
  assert.equal(html.includes("Destinations"), false);

  const script = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  assert.equal(script.includes("app/[...not_found]/route.ts"), false);
  assert.equal(script.includes("const HTML = `"), false);
});

test("the existing named exports equal the English entry", () => {
  assert.equal(NOT_FOUND_TITLE, NOT_FOUND_COPY.en.title);
  assert.equal(NOT_FOUND_HEADING, NOT_FOUND_COPY.en.heading);
  assert.equal(NOT_FOUND_LINK_LABEL, NOT_FOUND_COPY.en.linkLabel);
  assert.equal(NOT_FOUND_HREF, NOT_FOUND_COPY.en.href);
  assert.equal(NOT_FOUND_COPY.en.status, "published");
  assert.equal(NOT_FOUND_COPY.ar.status, "draft");
  assert.equal(NOT_FOUND_COPY.es.status, "draft");
});

for (const l of LOCALES) {
  test(`${l} 404: opening tag, strings, home link and monogram`, () => {
    const html = renderStaticNotFound(l);
    const dir = localeDir(l);
    assert.ok(html.includes(`<html lang="${l}" dir="${dir}">`), `<html lang="${l}" dir="${dir}">`);
    assert.ok(html.includes(`<title>${NOT_FOUND_COPY[l].title}</title>`));
    assert.ok(html.includes(`<h1>${NOT_FOUND_COPY[l].heading}</h1>`));
    assert.ok(html.includes(`>${NOT_FOUND_COPY[l].linkLabel}</a>`));
    assert.equal(NOT_FOUND_COPY[l].href, localePath(l, "/"));
    assert.ok(html.includes(`href="${localePath(l, "/")}"`));
    assert.match(html, /Curves_black\.svg/);
  });
}

test("a caller can point the home link elsewhere (a locale home that was not built)", () => {
  const html = renderStaticNotFound("ar", "/");
  assert.ok(html.includes('<a href="/">'));
  assert.equal(html.includes('href="/ar/"'), false);
});

test("renderStaticNotFound() with no argument is the English document", () => {
  assert.equal(renderStaticNotFound(), renderStaticNotFound("en"));
});

test("the Arabic 404 uses a system Arabic serif stack; margin-inline mirrors it", () => {
  const html = renderStaticNotFound("ar");
  assert.match(html, /font-family: "Noto Naskh Arabic", "Geeza Pro", "Times New Roman", serif/);
  assert.match(html, /margin-inline: auto/);
});

test("the assemble script renders the locale 404s and never templates them", () => {
  const script = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  assert.ok(script.includes("renderStaticNotFound("));
  assert.equal(script.includes("<html"), false);
});
