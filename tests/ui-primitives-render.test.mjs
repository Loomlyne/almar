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
