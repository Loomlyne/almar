import assert from "node:assert/strict";
import test from "node:test";
import { loadRenderer } from "./helpers/render-component.mjs";

// The served markup of ScrollCollage: what a visitor without JavaScript gets. Every photo is in its final place and
// visible (the engine hides nothing from the server markup), and nothing in it can be focused or clicked.

const render = await loadRenderer("components/ui/scroll-collage.tsx", "ScrollCollage");

const STATEMENT = "[Statement: two or three sentences held in the middle while the photos pass.]";
const images = () => [1, 2, 3, 4, 5].map((n) => ({ src: `/assets/img/photo-${n}.webp`, alt: "" }));
const html = (over = {}) => render({ images: images(), children: STATEMENT, ...over });

test("five img with empty alt, in order, and the statement text", () => {
  const out = html();
  const imgs = out.match(/<img [^>]*>/g) ?? [];
  assert.equal(imgs.length, 5);
  imgs.forEach((tag, i) => {
    assert.match(tag, /\balt=""/);
    assert.ok(tag.includes(`src="/assets/img/photo-${i + 1}.webp"`), tag);
  });
  assert.ok(out.includes(STATEMENT));
});

test("each image keeps the alt it is given", () => {
  const out = render({ images: [1, 2, 3, 4, 5].map((n) => ({ src: `/p${n}.webp`, alt: `[Photo ${n}]` })), children: STATEMENT });
  for (const n of [1, 2, 3, 4, 5]) assert.ok(out.includes(`alt="[Photo ${n}]"`), `alt ${n}`);
});

test("no hidden start state in the served markup (JavaScript off shows the final layout)", () => {
  const out = html();
  assert.equal(/\bopacity-0\b/.test(out), false);
  assert.equal(/\binvisible\b/.test(out), false);
  assert.equal(/class="[^"]*(?:^|[\s"])hidden(?:[\s"])/.test(out), false);
  assert.equal(/style="[^"]*(?:opacity|transform|translate|visibility)/.test(out), false);
  assert.equal(/\spre-reveal|data-reveal=/.test(out), false);
});

test("the photos carry the scroll-drop hook of job 11's engine, and only the photos do", () => {
  const out = html();
  assert.equal((out.match(/data-scroll="drop"/g) ?? []).length, 5);
  for (const tag of out.match(/<img [^>]*>/g) ?? []) assert.ok(tag.includes('data-scroll="drop"'), tag);
  assert.match(out, /^<div [^>]*data-scroll-collage/);
});

test("decorative: no button, link, tabindex, role or dialog", () => {
  const out = html();
  assert.equal(/<button|<a[\s>]|tabindex|role=|<dialog|aria-modal/i.test(out), false);
});

test("photos are 5:6 and the slots mirror with logical utilities only", () => {
  const out = html();
  for (const tag of out.match(/<img [^>]*>/g) ?? []) {
    assert.match(tag, /\baspect-5\/6\b/);
    assert.equal(/\b(?:left|right)-/.test(tag), false, tag);
  }
});

test("no images renders nothing; more than five render five", () => {
  assert.equal(render({ images: [], children: STATEMENT }), "");
  const six = [...images(), { src: "/p6.webp", alt: "" }];
  assert.equal((render({ images: six, children: STATEMENT }).match(/<img /g) ?? []).length, 5);
});

test("className is merged onto the root", () => {
  assert.match(html({ className: "extra-hook" }), /^<div [^>]*class="[^"]*\bextra-hook\b/);
});
