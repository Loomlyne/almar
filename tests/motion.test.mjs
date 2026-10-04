import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { MOTION_BOOT_SRC, MOTION_SAFETY_MS, dropOffset, fadeOpacity } from "../lib/motion.ts";

// Plan 41: the motion vocabulary (11-DESIGN section 3). The boot script is a static, content-hashed file; it is the only
// thing that hides content, and only under <html data-motion="on">.

const tokens = JSON.parse(readFileSync("tokens.json", "utf8"));
const css = readFileSync("app/globals.css", "utf8");

const bootFiles = readdirSync("public/assets/js").filter((name) => /^motion-boot\.[0-9a-f]{8}\.js$/.test(name));

test("exactly one boot file, named by the first 8 hex of its sha256, and MOTION_BOOT_SRC points at it", () => {
  assert.equal(bootFiles.length, 1, bootFiles.join(", "));
  const bytes = readFileSync(`public/assets/js/${bootFiles[0]}`);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  assert.equal(bootFiles[0], `motion-boot.${hash}.js`);
  assert.equal(MOTION_BOOT_SRC, `/assets/js/${bootFiles[0]}`);
});

test("the boot file is small and plain ES5: no arrow, let or const", () => {
  const text = readFileSync(`public/assets/js/${bootFiles[0]}`, "utf8");
  assert.ok(Buffer.byteLength(text) < 1024);
  assert.equal(/=>|\blet\b|\bconst\b/.test(text), false);
});

/** Runs the boot file against a stub page. */
function runBoot({ reduce = false, throws = false } = {}) {
  const attrs = new Map();
  const timers = [];
  const documentElement = {
    setAttribute: (name, value) => attrs.set(name, String(value)),
    getAttribute: (name) => (attrs.has(name) ? attrs.get(name) : null),
    hasAttribute: (name) => attrs.has(name),
  };
  const window = {
    matchMedia: (query) => {
      if (throws) throw new Error("no matchMedia");
      assert.equal(query, "(prefers-reduced-motion: reduce)");
      return { matches: reduce };
    },
  };
  const context = vm.createContext({
    window,
    document: { documentElement },
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
  });
  vm.runInContext(readFileSync(`public/assets/js/${bootFiles[0]}`, "utf8"), context);
  return { attrs, timers };
}

test("motion allowed: data-motion is on; after 3000 ms with no controller it is off (the safety reveal)", () => {
  const { attrs, timers } = runBoot();
  assert.equal(attrs.get("data-motion"), "on");
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 3000);
  assert.equal(MOTION_SAFETY_MS, 3000);
  timers[0].fn();
  assert.equal(attrs.get("data-motion"), "off");
});

test("a controller that set data-motion-ready before the timer keeps motion on", () => {
  const { attrs, timers } = runBoot();
  attrs.set("data-motion-ready", "");
  timers[0].fn();
  assert.equal(attrs.get("data-motion"), "on");
});

test("reduced motion: no attribute, no timer", () => {
  const { attrs, timers } = runBoot({ reduce: true });
  assert.equal(attrs.has("data-motion"), false);
  assert.equal(timers.length, 0);
});

test("matchMedia throwing: no attribute, no timer", () => {
  const { attrs, timers } = runBoot({ throws: true });
  assert.equal(attrs.has("data-motion"), false);
  assert.equal(timers.length, 0);
});

test("fadeOpacity: 1 until half the hero has scrolled, 0 at 1.5 heights, never outside [0, 1]", () => {
  assert.equal(fadeOpacity(0, 900), 1);
  assert.equal(fadeOpacity(450, 900), 1);
  assert.equal(fadeOpacity(900, 900), 0.5);
  assert.equal(fadeOpacity(1350, 900), 0);
  for (const y of [-500, 0, 100, 700, 1349, 2000, 99999]) {
    const v = fadeOpacity(y, 900);
    assert.ok(v >= 0 && v <= 1, `${y} -> ${v}`);
  }
});

test("dropOffset: -height at the bottom edge, 0 from mid-screen up", () => {
  assert.equal(dropOffset(900, 900, 360), -360);
  assert.equal(dropOffset(900, 450, 360), 0);
  assert.equal(dropOffset(900, 540, 360), -72);
  assert.equal(dropOffset(900, 100, 360), 0);
  assert.equal(Object.is(dropOffset(900, 100, 360), -0), false, "no negative zero");
});

test("tokens: the reveal easing, the eight durations, spacing.section, and no new text size", () => {
  assert.equal(tokens.ease.reveal, "cubic-bezier(0.22, 1, 0.36, 1)");
  assert.deepEqual(
    {
      "reveal-photo": tokens["transition-duration"]["reveal-photo"],
      "reveal-nav": tokens["transition-duration"]["reveal-nav"],
      "reveal-headline": tokens["transition-duration"]["reveal-headline"],
      "reveal-heading": tokens["transition-duration"]["reveal-heading"],
      "reveal-button": tokens["transition-duration"]["reveal-button"],
      "reveal-row": tokens["transition-duration"]["reveal-row"],
      slide: tokens["transition-duration"].slide,
      hover: tokens["transition-duration"].hover,
    },
    {
      "reveal-photo": "1600ms",
      "reveal-nav": "1000ms",
      "reveal-headline": "900ms",
      "reveal-heading": "1070ms",
      "reveal-button": "880ms",
      "reveal-row": "1180ms",
      slide: "1400ms",
      hover: "400ms",
    },
  );
  assert.equal(tokens.spacing.section, "120px");
  assert.deepEqual(Object.keys(tokens.text), ["caption", "label", "body", "title", "heading", "display", "hero"]);
});

test("globals.css: under 200 lines, one pre-reveal variant that only matches under data-motion=on and before data-revealed", () => {
  assert.ok(css.split("\n").length < 200, `${css.split("\n").length} lines`);
  const lines = css.split("\n").filter((line) => line.startsWith("@custom-variant pre-reveal"));
  assert.deepEqual(lines, ['@custom-variant pre-reveal (&:where([data-motion="on"] *):not([data-revealed]));']);
});
