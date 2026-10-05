import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BLOG_COPY } from "../lib/copy/blog.ts";
import { HOME_COPY } from "../lib/copy/home.ts";
import { formatPlural } from "../lib/journey-format.ts";

const isObj = (v) => v !== null && typeof v === "object";

function leaves(node, path, out) {
  if (isObj(node)) for (const [k, v] of Object.entries(node)) leaves(v, `${path}.${k}`, out);
  else out.push([path, node]);
  return out;
}

test("ar and es have every en key with a non-empty value", () => {
  const en = leaves(BLOG_COPY.en, "en", []).map(([p]) => p.slice(2));
  for (const l of ["ar", "es"]) {
    const other = new Map(leaves(BLOG_COPY[l], l, []).map(([p, v]) => [p.slice(l.length), v]));
    for (const p of en) {
      if (/readingTime\.(zero|two|few|many)$/.test(p)) continue;
      assert.ok(typeof other.get(p) === "string" && other.get(p).trim() !== "", `${l}${p}`);
    }
  }
});

test("the live English strings are the published literals", () => {
  const { list, post } = BLOG_COPY.en;
  assert.equal(list.meta.title, "Colombia travel guides | ALMAR");
  assert.equal(list.meta.description, "Simple guides about where to go, what to do, and how to travel private in Colombia.");
  assert.equal(list.kicker, "Blog / News");
  assert.equal(list.heading, "Travel Insights");
  assert.equal(post.kicker, "ALMAR Journal");
  assert.equal(post.cta, "Plan Your Journey — Contact ALMAR");
  assert.equal(post.links.back, "← Back to Travel Insights");
  assert.equal(post.intro, "Fully vetted stays, private drivers, and concierge on call. Tell us your dates and we plan the rest.");
});

test("the board strings equal the board dictionaries (k20, k21, k33, k41, k44, k47, k48)", () => {
  const dir = ".planning/design/2026-10-01-canvas/boards/";
  const dict = (f) => JSON.parse(readFileSync(dir + f, "utf8").match(/const DICT = (\{.*\});/)[1]);
  const blog = dict("PublicBlog.dc.html");
  const postBoard = dict("PublicBlogPost.dc.html");
  for (const l of ["en", "ar", "es"]) {
    assert.equal(BLOG_COPY[l].list.heading, blog.k20[l]);
    assert.equal(BLOG_COPY[l].post.related, blog.k21[l]);
    assert.equal(BLOG_COPY[l].post.onThisPage, postBoard.k33[l]);
    assert.equal(BLOG_COPY[l].post.featuredStay, postBoard.k41[l]);
    assert.equal(BLOG_COPY[l].post.featuredExperience, postBoard.k44[l]);
    assert.equal(BLOG_COPY[l].post.share, postBoard.k47[l]);
    assert.equal(BLOG_COPY[l].post.copyLink, postBoard.k48[l]);
  }
});

test("the Destinations link word is the nav word", () => {
  for (const l of ["en", "ar", "es"]) assert.equal(BLOG_COPY[l].post.links.destinations, HOME_COPY[l].nav.destinations);
});

test("reading time uses Western numerals in every language", () => {
  for (const l of ["en", "ar", "es"]) {
    for (const n of [1, 2, 3, 11]) assert.equal(/[\u0660-\u0669]/.test(formatPlural(BLOG_COPY[l].post.readingTime, n, l)), false);
  }
  assert.equal(formatPlural(BLOG_COPY.en.post.readingTime, 3, "en"), "3 min read");
  assert.equal(formatPlural(BLOG_COPY.ar.post.readingTime, 11, "ar"), "11 دقيقة قراءة");
});
