import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadRenderer } from "./helpers/render-component.mjs";

// Plan 03.3-42: the primitives the Framer match needs, rendered on the server the way `next build` prerenders them.
// Defaults must not move: tests/snapshots/ui-primitives-defaults.json was taken from the components before this plan.

const baseline = JSON.parse(readFileSync("tests/snapshots/ui-primitives-defaults.json", "utf8"));
const classes = (html, tag = "[a-z0-9]+") => (new RegExp(`<${tag}\\b[^>]*class="([^"]*)"`).exec(html)?.[1] ?? "").split(/\s+/);
const count = (html, re) => (html.match(re) ?? []).length;
const image = { src: "/a.jpg", alt: "Alt text" };

/** Bundle a small ESM snippet (re-exports from the repo) and return its exports, for pure functions and icon maps. */
async function loadModule(contents) {
  const { build } = await import("esbuild");
  const out = await build({
    stdin: { contents, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    jsx: "automatic",
    logLevel: "silent",
  });
  const file = join(mkdtempSync(join(tmpdir(), "almar-mod-")), "mod.cjs");
  writeFileSync(file, out.outputFiles[0].text);
  return createRequire(file)(file);
}

const renderHead = await loadRenderer("components/ui/section.tsx", "SectionHead");
const renderSection = await loadRenderer("components/ui/section.tsx", "Section");
const renderCard = await loadRenderer("components/ui/card.tsx", "MediaCard");
const renderPortrait = await loadRenderer("components/ui/card.tsx", "PortraitCard");
const renderFacts = await loadRenderer("components/ui/fact-list.tsx", "FactList");
const renderButton = await loadRenderer("components/ui/button.tsx", "Button");
const renderLinkButton = await loadRenderer("components/ui/button.tsx", "LinkButton");

// ---- icons -------------------------------------------------------------------------------------------------------

test("AMENITY_ICONS has a component for each of the 13 AmenityIcon keys, and every new icon renders an svg", async () => {
  const types = readFileSync("lib/data/types.ts", "utf8");
  const union = /export type AmenityIcon =([^;]*);/.exec(types)[1];
  const keys = [...union.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.equal(keys.length, 13);
  const mod = await loadModule(`
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import * as icons from "./components/icons/icons";
    export const keys = Object.keys(icons.AMENITY_ICONS);
    export const draw = (key) => renderToStaticMarkup(createElement(icons.AMENITY_ICONS[key], { size: 16 }));
    export const names = ["PoolIcon","WifiIcon","DropIcon","TvIcon","AirIcon","KitchenIcon","FlameIcon","BedIcon","CalendarIcon","PlusIcon","PauseIcon","PlayIcon"];
    export const drawNamed = (name) => renderToStaticMarkup(createElement(icons[name], {}));
  `);
  assert.deepEqual([...mod.keys].sort(), [...keys].sort());
  for (const key of keys) assert.match(mod.draw(key), /^<svg\b[^>]*aria-hidden="true"/, key);
  for (const name of mod.names) assert.match(mod.drawNamed(name), /^<svg\b[^>]*viewBox="0 0 24 24"/, name);
});

// ---- Button, LinkButton ----------------------------------------------------------------------------------------

test("LinkButton renders an <a> with the Button look; outline draws gold as a border only", () => {
  const html = renderLinkButton({ href: "/x", variant: "outline", children: "Go", target: "_blank", rel: "noopener" });
  assert.match(html, /^<a\b[^>]*href="\/x"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener"/);
  const cls = classes(html, "a");
  assert.ok(cls.includes("border-gold") && cls.includes("text-teal") && cls.includes("bg-transparent"), cls.join(" "));
  assert.ok(!cls.some((c) => /^(?:bg|text)-gold/.test(c)));
  assert.ok(cls.includes("text-label") && cls.includes("md:text-body") && cls.includes("rounded-none"));
  assert.equal(/<button/.test(html), false);
});

test("LinkButton ivory: ivory ground, teal text, gold border; the bar-auto size is h-bar px-8", () => {
  const cls = classes(renderLinkButton({ href: "/x", variant: "ivory", size: "bar-auto", children: "Go" }), "a");
  for (const c of ["bg-ivory", "text-teal", "border-gold", "h-bar", "px-8"]) assert.ok(cls.includes(c), `${c} in ${cls.join(" ")}`);
});

test("buttonClass is the class Button uses, and Button defaults did not move", async () => {
  assert.equal(
    renderButton({ children: "Go" }) +
      renderButton({ variant: "secondary", size: "lg", children: "Go" }) +
      renderButton({ variant: "ghost", size: "bar", journey: true, children: "Go" }),
    baseline.button,
  );
  const { buttonClass } = await loadModule(`export { buttonClass } from "./components/ui/button";`);
  const fromButton = classes(renderButton({ variant: "outline", size: "md", children: "Go" }), "button").join(" ");
  assert.equal(buttonClass({ variant: "outline", size: "md" }).split(/\s+/).sort().join(" "), fromButton.split(/\s+/).sort().join(" "));
});

// ---- SectionHead, Section ------------------------------------------------------------------------------------

test("SectionHead default tone is byte-identical to the render before this plan", () => {
  assert.equal(renderHead({ kicker: "Kicker", heading: "Heading", intro: "Intro text", action: "A", headingId: "h" }), baseline.sectionHead);
  assert.equal(renderSection({ heading: "Heading", id: "x", kicker: "K", children: "body" }).replace(/aria-labelledby="[^"]*"/, ""), baseline.section.replace(/aria-labelledby="[^"]*"/, ""));
});

test("SectionHead tone plain, centred: no gold, a heading Reveal block, a button Reveal action, text-center", () => {
  const html = renderHead({ tone: "plain", align: "center", kicker: "Kicker", heading: "Heading", intro: "Intro", action: "Act" });
  assert.equal(/gold/.test(html), false);
  assert.match(html, /data-reveal="heading"/);
  assert.match(html, /data-reveal="button"/);
  const block = /<div\b[^>]*data-reveal="heading"[^>]*class="([^"]*)"|<div\b[^>]*class="([^"]*)"[^>]*data-reveal="heading"/.exec(html);
  assert.ok((block[1] ?? block[2]).split(/\s+/).includes("text-center"));
  assert.match(html, /<p class="m-0 text-label md:text-body text-teal">Kicker<\/p>/);
  assert.match(html, /<h2 class="m-0 font-display text-teal text-display">Heading<\/h2>/);
  assert.match(html, /text-label md:text-body text-ink">Intro</);
  assert.ok(html.indexOf("Intro") < html.indexOf("Act"), "centred: the action sits under the intro");
});

test("SectionHead tone plain, start: the block does not centre", () => {
  const html = renderHead({ tone: "plain", heading: "Heading", action: "Act" });
  assert.equal(/text-center|mx-auto/.test(html), false);
  assert.match(html, /data-reveal="heading"/);
});

test("Section variant page keeps its id, uses the page rhythm and draws a plain head", () => {
  const html = renderSection({ variant: "page", heading: "Heading", id: "stays", children: "body" });
  assert.match(html, /<section id="stays"/);
  assert.ok(classes(html, "section").includes("md:py-section") && classes(html, "section").includes("py-16"));
  assert.equal(/border-gold/.test(html), false);
  assert.match(html, /data-reveal="heading"/);
});

// ---- cards ----------------------------------------------------------------------------------------------------

test("PortraitCard is one link with a photo, the title, one icon per fact, and the zoom classes", () => {
  const html = renderPortrait({
    href: "/stay/a",
    image,
    title: "Casa A",
    facts: [
      { icon: "ICON", text: "4 guests" },
      { icon: "ICON", text: "2 beds" },
      { icon: "ICON", text: "3 baths" },
    ],
  });
  assert.equal(count(html, /<a\b/g), 1);
  assert.match(html, /<img\b[^>]*alt="Alt text"/);
  assert.match(html, />Casa A</);
  assert.equal(count(html, /ICON/g), 3, "one icon node per fact");
  for (const c of ["motion-safe:group-hover:scale-105", "transition-transform", "duration-hover", "ease-reveal"]) assert.ok(html.includes(c), c);
  assert.ok(html.includes("aspect-2/3") && html.includes("overflow-hidden"));
  assert.equal(/gold/.test(html), false);
});

test("MediaCard defaults did not move; zoom, titleSize and align are opt-in", () => {
  const baseImage = { src: "/a.jpg", alt: "Alt" };
  assert.equal(renderCard({ href: "/stay", image: baseImage, title: "Title", detail: "Detail" }), baseline.cardLink);
  assert.equal(renderCard({ image: baseImage, title: "Title", detail: "Detail", action: "X" }), baseline.cardPlain);
  assert.equal(renderCard({ href: "/s", image: baseImage, title: "Title", detail: "Detail", action: "X" }), baseline.cardLinkAction);
  const zoomed = renderCard({ href: "/stay", image, title: "Title", zoom: "sm" });
  assert.ok(zoomed.includes("motion-safe:group-hover:scale-102") && zoomed.includes("overflow-hidden") && zoomed.includes("duration-hover"));
  assert.ok(renderCard({ href: "/stay", image, title: "Title", zoom: "md" }).includes("motion-safe:group-hover:scale-105"));
  const heading = renderCard({ href: "/stay", image, title: "Title", titleSize: "heading" });
  assert.ok(heading.includes("text-heading") && !heading.includes("text-title"));
  const centred = renderCard({ href: "/stay", image, title: "Title", detail: "D", align: "center" });
  assert.ok(centred.includes("text-center") && centred.includes("items-center"));
});

// ---- FactList --------------------------------------------------------------------------------------------------

test("FactList rows is today's output; inline is a dl without borders; plain is a list without hairlines", () => {
  const labelled = [{ label: "A", value: "1" }, { label: "B", value: "2" }];
  assert.equal(renderFacts({ items: [{ label: "A", value: "1", icon: true }, { label: "B", value: "2" }], columns: 2 }), baseline.factDl);
  assert.equal(renderFacts({ items: [{ value: "Pool", icon: true }, { value: "Wifi" }] }), baseline.factUl);
  const inline = renderFacts({ items: labelled, layout: "inline" });
  assert.match(inline, /^<dl\b/);
  assert.equal(/border-b|border-line/.test(inline), false);
  const plain = renderFacts({ items: [{ value: "Pool" }, { value: "Wifi" }], layout: "plain" });
  assert.match(plain, /^<ul\b/);
  assert.equal(/border-b|border-line/.test(plain), false);
});

test("FactList icon may be a node", () => {
  const html = renderFacts({ items: [{ value: "Pool", icon: "NODE-ICON" }], layout: "plain" });
  assert.match(html, /NODE-ICON/);
  assert.equal(/<svg/.test(html), false, "no default check mark when a node is given");
});

// ---- Slider, BackgroundMedia ------------------------------------------------------------------------------------

const labels = {
  region: "Photos of Casa Verde",
  previous: "Previous photo",
  next: "Next photo",
  goTo: "Go to photo {n}",
  slide: "Photo {n} of {total}",
  pause: "Pause",
  play: "Play",
};
const photos = Array.from({ length: 8 }, (_, i) => ({ src: `/p${i}.jpg`, alt: `Photo alt ${i + 1}` }));

test("slideOffset: left to right, right to left, and index 0 is 0 in both", async () => {
  const { slideOffset, AUTOPLAY_MS } = await loadModule(`export { slideOffset, AUTOPLAY_MS } from "./components/ui/slider";`);
  assert.equal(AUTOPLAY_MS, 2000);
  const ltr = [
    { offsetLeft: 0, offsetWidth: 600 },
    { offsetLeft: 640, offsetWidth: 600 },
    { offsetLeft: 1280, offsetWidth: 400 },
  ];
  const rtl = [
    { offsetLeft: 840, offsetWidth: 600 },
    { offsetLeft: 200, offsetWidth: 600 },
    { offsetLeft: -240, offsetWidth: 400 },
  ];
  assert.equal(slideOffset(ltr, 2, false), -1280);
  assert.equal(slideOffset(rtl, 2, true), 1280);
  assert.ok(Object.is(slideOffset(ltr, 0, false), 0), "no negative zero");
  assert.equal(slideOffset(rtl, 0, true), 0);
  assert.equal(slideOffset([], 3, false), 0);
});

test("Slider served HTML: a region, every slide and image, a scroll-snap track and no control", async () => {
  const render = await loadRenderer("components/ui/slider.tsx", "Slider");
  for (const layout of ["strip", "peek"]) {
    const html = render({ images: photos, labels, layout, dotsEvery: 2, autoplay: true });
    assert.match(html, /<section\b[^>]*aria-roledescription="carousel"[^>]*aria-label="Photos of Casa Verde"/);
    assert.equal(count(html, /role="group"/g), 8);
    assert.equal(count(html, /<img\b/g), 8);
    for (const photo of photos) assert.ok(html.includes(`alt="${photo.alt}"`));
    assert.match(html, /aria-label="Photo 3 of 8"/);
    assert.ok(html.includes("overflow-x-auto") && html.includes("snap-x") && html.includes("snap-mandatory") && html.includes("snap-start"));
    assert.equal(count(html, /<button\b/g), 0, "controls appear only after mount");
    assert.equal(/aria-live|<video/.test(html), false);
    assert.equal(count(html, /loading="eager"/g), 1, "only the first image is eager");
    assert.equal(count(html, /loading="lazy"/g), 7);
  }
  const strip = render({ images: photos, labels, layout: "strip" });
  assert.ok(strip.includes("h-70 w-75 md:h-120 md:w-150") && strip.includes("gap-8"));
  const peek = render({ images: photos, labels, layout: "peek" });
  assert.ok(peek.includes("w-full aspect-video") && peek.includes("gap-2") && peek.includes("px-4 md:px-16"));
});

test("Slider source: the transformed track uses the slide token and the reveal ease, and stops for reduced motion", () => {
  const source = readFileSync("components/ui/slider.tsx", "utf8");
  for (const needle of ["duration-slide", "ease-reveal", "motion-reduce:transition-none", "touch-pan-y", "prefers-reduced-motion", "AUTOPLAY_MS"]) {
    assert.ok(source.includes(needle), needle);
  }
  assert.match(source, /rtl:-scale-x-100/);
});

test("BackgroundMedia serves the poster image and never a video; with nothing set it is only the wrapper", async () => {
  const render = await loadRenderer("components/ui/background-media.tsx", "BackgroundMedia");
  const withVideo = render({ poster: { src: "/poster.webp", alt: "A poster" }, videoUrl: "https://media.example/v.mp4" });
  assert.match(withVideo, /<img\b[^>]*src="\/poster\.webp"[^>]*alt="A poster"/);
  assert.equal(/<video/.test(withVideo), false);
  assert.ok(withVideo.includes("absolute inset-0 size-full object-cover"));
  const urlOnly = render({ poster: "/poster.webp" });
  assert.match(urlOnly, /<img\b[^>]*alt=""/);
  const nothing = render({ poster: null, videoUrl: null });
  assert.equal(/<img|<video/.test(nothing), false);
  assert.match(nothing, /^<div\b/);
});

// ---- JourneyBar action slot, JourneySheet final action -------------------------------------------------------------

test("JourneyBar action: no onSearch keeps a group and draws the action after Guests; onSearch wins; neither is today's bar", async () => {
  const { bar } = await loadModule(`
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { JourneyBar } from "./components/journey/journey-bar";
    import { JOURNEY_COPY } from "./lib/copy/journey";
    const value = { destinationId: null, start: null, end: null, adults: 2, children: 0, infants: 0 };
    export const bar = (props) =>
      renderToStaticMarkup(createElement(JourneyBar, { size: "hero", destinations: [], value, onChange() {}, copy: JOURNEY_COPY.en, locale: "en", ...props }));
  `);
  const withAction = bar({ action: "REQUEST-LINK" });
  assert.match(withAction, /role="group"/);
  assert.equal(/<form|type="submit"/.test(withAction), false);
  assert.ok(withAction.indexOf("REQUEST-LINK") > withAction.indexOf("Guests"), "after the Guests segment");
  assert.match(withAction, /<div class="flex shrink-0">[^]*REQUEST-LINK/);

  const searching = bar({ onSearch() {}, action: "REQUEST-LINK" });
  assert.match(searching, /<form\b[^>]*role="search"/);
  assert.match(searching, /type="submit"/);
  assert.equal(/REQUEST-LINK/.test(searching), false, "Search wins over the action");

  const neither = bar({});
  assert.match(neither, /role="group"/);
  assert.equal(/<form|type="submit"|class="flex shrink-0"/.test(neither), false);
  assert.equal(neither, bar({ action: undefined }));
});

test("JourneySheet finalAction: step 3 without onSearch shows it in a flex-1 box instead of Done; Next and Search are unchanged", () => {
  const source = readFileSync("components/journey/journey-sheet.tsx", "utf8");
  assert.match(source, /finalAction\?: ReactNode;/);
  assert.match(source, /step === 3 && !onSearch && finalAction \?\s*\(\s*<div className="flex min-w-0 flex-1">\{finalAction\}<\/div>/);
  // The Button branch is the old one: Search with onSearch, Done without, Next before step 3.
  assert.match(source, /<Button size="lg" onClick=\{advance\}>[^]*copy\.bar\.search[^]*copy\.done[^]*s\.next/);
});
