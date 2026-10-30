import assert from "node:assert/strict";
import test from "node:test";
import { loadRenderer } from "./helpers/render-component.mjs";

// Plan 03.3-13 task 1 (S2-21 case B): PortraitCard gains an optional href, a ratio option and Latin-only capitals.
// With none of them given, the output is job 11's, byte for byte: DEFAULT_RENDER was captured from the component
// as it stood at 2ce5d6d, before this plan edited it.

const render = await loadRenderer("components/ui/card.tsx", "PortraitCard");
const image = { src: "/a.jpg", alt: "Alt text" };
const facts = [
  { icon: "ICON", text: "4 guests" },
  { icon: "ICON", text: "2 beds" },
];

const DEFAULT_RENDER =
  '<a href="/stay/a" class="group relative block aspect-2/3 min-w-0 overflow-hidden text-ivory"><img src="/a.jpg" alt="Alt text" decoding="async" class="absolute inset-0 size-full object-cover transition-transform duration-hover ease-reveal motion-safe:group-hover:scale-105 group-active:brightness-88"/><span aria-hidden="true" class="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/10 to-transparent group-hover:from-ink/82 group-hover:via-ink/25"></span><span class="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-6 pb-6 md:px-8 md:pb-8"><span class="inline-flex items-center gap-2 font-display text-heading text-ivory"><span class="min-w-0">Casa A</span><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" class="shrink-0 rtl:-scale-x-100 motion-safe:transition-transform motion-safe:duration-fast motion-safe:ease-standard ltr:motion-safe:group-hover:translate-x-1 rtl:motion-safe:group-hover:-translate-x-1"><path d="M4.5 12h15M13.5 6l6 6-6 6"></path></svg></span><span class="flex flex-wrap gap-x-6 gap-y-2 text-label text-ivory"><span class="inline-flex items-center gap-2">ICON4 guests</span><span class="inline-flex items-center gap-2">ICON2 beds</span></span></span></a>';

test("with none of the new props the render equals job 11's, byte for byte", () => {
  assert.equal(render({ href: "/stay/a", image, title: "Casa A", facts }), DEFAULT_RENDER);
  assert.equal(render({ href: "/stay/a", image, title: "Casa A", facts, ratio: "portrait", uppercase: false }), DEFAULT_RENDER);
});

test("without href the card is an article: no link, no tabindex, no zoom", () => {
  const html = render({ image, title: "Cartagena", facts });
  assert.match(html, /^<article\b/);
  assert.equal(/<a\b|href=|tabindex/.test(html), false);
  assert.equal(/group-hover|transition-transform/.test(html), false);
});

test("ratio square is 7:12 below md and a square from md; portrait stays 2:3", () => {
  const square = render({ image, title: "T", ratio: "square" });
  assert.ok(square.includes("aspect-7/12") && square.includes("md:aspect-square"));
  assert.equal(square.includes("aspect-2/3"), false);
  assert.ok(render({ image, title: "T" }).includes("aspect-2/3"));
});

test("uppercase is Latin script only", () => {
  assert.ok(/class="font-display text-heading text-ivory uppercase"/.test(render({ image, title: "Medellín", uppercase: true })));
  assert.equal(/uppercase/.test(render({ image, title: "ميديلين", uppercase: true })), false);
  assert.equal(/uppercase/.test(render({ image, title: "Medellín" })), false);
});
