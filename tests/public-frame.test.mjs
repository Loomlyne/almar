import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync("components/site/public-frame.tsx", "utf8");

test("the frame composes nav, footer and WhatsApp once", () => {
  for (const name of ["SiteNav", "SiteFooter", "WhatsApp"]) assert.ok(src.includes(`<${name}`), name);
  // Plan 02 merged: the interim casts are gone, the real components take the real props.
  assert.equal(/as unknown as|FrameNav|FrameFooter|TODO\(plan 02 merge\)/.test(src), false);
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
  // The frame hands localeHrefs to SiteNav and no onLocale; LocaleSelect drops any href that is not a path of this site.
  assert.equal(/onLocale/.test(src), false);
  const select = readFileSync("components/ui/locale-select.tsx", "utf8");
  assert.match(select, /startsWith\("\/"\)/);
  assert.match(select, /startsWith\("\/\/"\)/);
});

test("the frame carries no invented contact details", () => {
  assert.ok(src.includes("inquiries@almarprivatejourney.com"));
  assert.ok(src.includes("+971563883302"));
});
