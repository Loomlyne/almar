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

test("currency is off unless a page passes the state its own amounts use", () => {
  assert.match(src, /currency = false/);
  // Controlled: the select reads the page's `selected` and reports a pick through the page's `onChange`.
  assert.match(src, /currency: currency === false \? false : currency\.selected/);
  assert.match(src, /nav\.onCurrency = currency\.onChange/);
  // The old on/off boolean left the select uncontrolled, starting at AED.
  assert.equal(/currency\?: boolean/.test(src), false);
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
  // Displayed as the live footer and design 4.1 row 28 print it; the footer builds tel:+971563883302 from the digits.
  assert.ok(src.includes('phone: "+971 56 388 3302"'));
  assert.equal(src.includes('phone: "+971563883302"'), false);
});
