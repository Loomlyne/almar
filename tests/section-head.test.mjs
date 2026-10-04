import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadRenderer } from "./helpers/render-component.mjs";

// SectionHead draws the gold rule, kicker, heading and intro. A page's one h1 is a SectionHead at level 1
// (plan 05 had to write the same head inline because the level stopped at 2 to 4).

const render = await loadRenderer("components/ui/section.tsx", "SectionHead");
const tagOf = (html) => /<(h[1-6])\b/.exec(html)?.[1];
const headingClasses = (html) => (/<h[1-6][^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);

test("headingLevel 1, 2, 3 and 4 draw h1 to h4; the default is h2", () => {
  for (const level of [1, 2, 3, 4]) assert.equal(tagOf(render({ heading: "Heading", headingLevel: level })), `h${level}`);
  assert.equal(tagOf(render({ heading: "Heading" })), "h2");
});

test("the default size is unchanged (heading), display is opt-in, and the colour and face stay", () => {
  const section = headingClasses(render({ heading: "Heading" }));
  assert.ok(section.includes("text-heading") && !section.includes("text-display"), section.join(" "));
  const title = headingClasses(render({ heading: "Heading", headingLevel: 1, headingSize: "display" }));
  assert.ok(title.includes("text-display") && !title.includes("text-heading"), title.join(" "));
  for (const classes of [section, title]) assert.ok(classes.includes("font-display") && classes.includes("text-teal") && classes.includes("m-0"));
});

test("the gold rule stays a line, and the heading id and kicker still render", () => {
  const html = render({ heading: "Heading", headingLevel: 1, headingId: "page-title", kicker: "Kicker" });
  assert.match(html, /border-t-2 border-gold/);
  assert.match(html, /<h1 id="page-title"/);
  assert.match(html, />Kicker</);
  assert.equal(/bg-gold|text-gold|fill-gold/.test(html), false);
});

test("the stays list uses SectionHead for its h1 and writes no inline h1 of its own", () => {
  const page = readFileSync("components/pages/private-stays-page.tsx", "utf8");
  assert.match(page, /<SectionHead\b[^>]*headingLevel=\{1\}/);
  assert.equal(/<h1\b/.test(page), false);
  assert.equal((page.match(/headingLevel=\{1\}/g) ?? []).length, 1, "one h1 per page");
});
