import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync("components/site/public-frame.tsx", "utf8");

test("the frame composes nav, footer and WhatsApp once", () => {
  for (const name of ["SiteNav", "SiteFooter", "WhatsApp"]) assert.ok(src.includes(`<${name === "SiteNav" ? "FrameNav" : name === "SiteFooter" ? "FrameFooter" : name}`), name);
  assert.equal((src.match(/<WhatsApp\s*\/>/g) ?? []).length, 1);
});

test("every held control is off: no login, no cart, no newsletter, no form", () => {
  assert.match(src, /login: false/);
  assert.match(src, /newsletter=\{false\}/);
  assert.equal(/cart:\s*true|login:\s*true|newsletter=\{true\}/.test(src), false);
  assert.equal(src.includes("<form"), false);
});

test("currency is off unless a page turns it on", () => {
  assert.match(src, /currency = false/);
  assert.match(src, /if \(!currency\) nav\.currency = false/);
});

test("a language switch only goes to a path of this site (T-3.3-04)", () => {
  assert.match(src, /startsWith\("\/"\)/);
  assert.match(src, /startsWith\("\/\/"\)/);
});

test("the frame carries the plan 02 merge TODO and no invented contact details", () => {
  assert.ok(src.includes("TODO(plan 02 merge)"));
  assert.ok(src.includes("inquiries@almarprivatejourney.com"));
  assert.ok(src.includes("+971563883302"));
});
