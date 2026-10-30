// Plan 06-06: what fixtures cannot show on the real page (no legs, no add-ons): PackageView's route and Included panel, rendered from
// props to static HTML. The form's slot is a plain marker here. Written, NOT run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { loadTs } from "./helpers/load-ts.mjs";
import { loadRenderer } from "./helpers/render-component.mjs";

const renderView = await loadRenderer("components/pages/package/package-view.tsx", "PackageView");
const { PACKAGE_PAGE_COPY } = await loadTs("lib/copy/package-page.ts");
const { JOURNEY_COPY } = await loadTs("lib/copy/journey.ts");

const PACKAGE = {
  id: "t1",
  slug: "[slug]",
  name: "[Package]",
  tagline: "[Tagline]",
  price_label: "[The owners price line]",
  duration_label: "[Ten days]",
  ideal_for_label: null,
  ideal_for: "[Two people]",
  body: "[Description]",
  image: null,
  is_featured: false,
  position: 1,
  legs: [
    { id: "l1", position: 1, destination_id: "d1", stay_id: "s1", nights_label: "[3 nights]", destination_name: "[City One]", destination_slug: "city-one", stay_title: "[Stay One]", stay_slug: "stay-one" },
    { id: "l2", position: 2, destination_id: "d2", stay_id: null, nights_label: null, destination_name: "[City Two]", destination_slug: "city-two", stay_title: null, stay_slug: null },
  ],
  addons: [{ item_id: "i1", position: 1, name: "[Included item]" }],
};

const render = (pkg, locale = "en") =>
  renderView({
    pkg,
    copy: PACKAGE_PAGE_COPY[locale],
    locale,
    form: createElement("div", { "data-form-slot": true }),
    whatsappHref: "https://wa.me/971563883302?text=x",
    newTabLabel: "[new tab]",
  });

test("the route in order: the destination's name is no link, a suggested stay links to its page in the page's language, a missing nights line is no empty line", () => {
  const html = render(PACKAGE, "ar");
  assert.ok(html.indexOf("[City One]") < html.indexOf("[City Two]"));
  assert.match(html, /href="\/ar\/private-stays\/stay-one"/);
  assert.equal(html.includes('href="/ar/destinations/city-one"'), false);
  assert.ok(html.includes("[3 nights]"));
  assert.equal((html.match(/\[Stay One\]/g) ?? []).length, 1);
});

test("the Included panel: the stay pages' own words, the names, and no button (ADDN-03: a guest cannot remove them), no price", () => {
  const html = render(PACKAGE);
  assert.ok(html.includes("[Included item]"));
  assert.ok(html.includes(JOURNEY_COPY.en.inclusions.title), "Included in your journey");
  assert.ok(html.includes(JOURNEY_COPY.en.inclusions.note), "No extra charge");
  assert.equal(html.includes("<button"), false);
});

test("the price line is printed exactly as the owner wrote it, once", () => {
  const html = render(PACKAGE);
  assert.equal(html.split("[The owners price line]").length - 1, 1);
});

test("no legs and no add-ons: neither section, and the form's slot and the WhatsApp link stay", () => {
  const html = render({ ...PACKAGE, legs: [], addons: [] });
  assert.equal(html.includes(PACKAGE_PAGE_COPY.en.route), false);
  assert.equal(html.includes(JOURNEY_COPY.en.inclusions.title), false);
  assert.ok(html.includes("data-form-slot"));
  assert.ok(html.includes("https://wa.me/971563883302?text=x"));
});

test("no pay, checkout or card word and no card field on the page", () => {
  const html = render({ ...PACKAGE, price_label: "x" });
  assert.doesNotMatch(html.replace(PACKAGE_PAGE_COPY.en.reqIntro, ""), /\b(pay|checkout|card|deposit)\b/i);
  assert.doesNotMatch(html, /autocomplete="cc-/);
});
