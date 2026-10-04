import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadRenderer } from "./helpers/render-component.mjs";

// Plan 03.3-13 task 1 (S2-17 case B): the served HTML of Slider layout "hero", and the strip and peek layouts left alone.

const render = await loadRenderer("components/ui/slider.tsx", "Slider");
const images = ["a", "b", "c"].map((n) => ({ src: `/${n}.jpg`, alt: `Alt ${n}` }));
const labels = { region: "R", previous: "Prev", next: "Next", goTo: "Go {n}", slide: "S {n} of {total}", pause: "Pause", play: "Play" };

test("hero served HTML: every slide is an eager static image, with no control", () => {
  const html = render({ images, labels, layout: "hero", autoplay: true, children: "OVERLAY" });
  assert.equal((html.match(/<img\b/g) ?? []).length, 3);
  assert.equal((html.match(/loading="eager"/g) ?? []).length, 3);
  assert.equal(/<button\b/.test(html), false);
  assert.match(html, /aria-roledescription="carousel"/);
  assert.match(html, /OVERLAY/);
  assert.match(html, /data-reveal="photo"/);
  assert.ok(html.includes("h-120") && html.includes("md:h-svh"));
});

test("hero source draws no arrows and keeps the pause, hold and reduced-motion paths", () => {
  const source = readFileSync("components/ui/slider.tsx", "utf8");
  assert.match(source, /hero \? null : \(/, "arrows are skipped for the hero");
  assert.match(source, /autoplayAllowed && !reduced/);
});

test("strip and peek served HTML did not take the reveal wrapper", () => {
  for (const layout of ["strip", "peek"]) {
    const html = render({ images, labels, layout });
    assert.equal(/data-reveal/.test(html), false, layout);
    assert.equal((html.match(/<img\b/g) ?? []).length, 3);
  }
});
