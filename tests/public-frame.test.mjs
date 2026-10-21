import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const src = readFileSync("components/site/public-frame.tsx", "utf8");

test("the frame composes nav, footer and WhatsApp once", () => {
  for (const name of ["SiteNav", "SiteFooter", "WhatsApp"]) assert.ok(src.includes(`<${name}`), name);
  // Plan 02 merged: the interim casts are gone, the real components take the real props.
  assert.equal(/as unknown as|FrameNav|FrameFooter|TODO\(plan 02 merge\)/.test(src), false);
  assert.equal((src.match(/<WhatsApp\s*\/>/g) ?? []).length, 1);
});

test("login is on (job 21): /<locale>/login, or /<locale>/account once the sign-in hint is there; no cart, no List with us, no form in the frame; the newsletter is on through PUBLIC_NEWSLETTER with subscribeToNewsletter", () => {
  assert.match(src, /loginHref: localePath\(locale, signedIn \? "\/account" : "\/login"\)/);
  assert.match(src, /setSignedIn\(hasSignedInHint\(\)\)/);
  assert.equal(/login: false/.test(src), false);
  assert.equal(/cart:\s*true|login:\s*true|listWithUs/.test(src), false);
  assert.equal(src.includes("<form"), false);
  // Plan 03.3-27: on for every page that wears the frame, through one constant; the request is lib/newsletter.ts's.
  assert.equal(/newsletter=\{false\}/.test(src), false);
  assert.match(src, /export const PUBLIC_NEWSLETTER = \{\s*newsletter: true,\s*onSubscribe: subscribeToNewsletter,\s*honeypotFields: NEWSLETTER_HONEYPOT_FIELDS,\s*\} as const;/);
  assert.match(src, /\{\.\.\.PUBLIC_NEWSLETTER\}/);
  assert.match(src, /from "\.\.\/\.\.\/lib\/newsletter"/);
  assert.equal(/fetch\(|emails\.send|type="submit"/.test(src), false);
});

test("PublicFrame is the only file under components/ and app/ that renders <SiteFooter (no page can drop the newsletter)", () => {
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path, out);
      else if (/\.(tsx?|jsx?)$/.test(name)) out.push(path);
    }
    return out;
  };
  const callers = [...walk("components"), ...walk("app")].filter((file) => readFileSync(file, "utf8").includes("<SiteFooter"));
  assert.deepEqual(callers, [join("components", "site", "public-frame.tsx")]);
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

test("plan 41: the light footer, Made by Koussay, the whatsapp toggle and the motion controller are wired once", () => {
  assert.match(src, /tone="light"/);
  assert.match(src, /label: footerCopy\.madeBy/);
  assert.match(src, /name: "Koussay"/);
  assert.match(src, /href: "https:\/\/koussay\.com"/);
  assert.match(src, /whatsapp = true/);
  assert.equal((src.match(/<MotionController\s*\/>/g) ?? []).length, 1);
  assert.match(src, /reveal/);
  assert.equal(/facebook|youtube|tiktok/i.test(src), false);
});

test("the frame carries no invented contact details", () => {
  assert.ok(src.includes("inquiries@almarprivatejourney.com"));
  // Displayed as the live footer and design 4.1 row 28 print it; the footer builds tel:+971563883302 from the digits.
  assert.ok(src.includes('phone: "+971 56 388 3302"'));
  assert.equal(src.includes('phone: "+971563883302"'), false);
});

test("plan 03.3-27 (checker finding 12): the client frame, the footer and the submit function value-import no copy table", () => {
  for (const file of ["components/site/public-frame.tsx", "components/ui/footer.tsx", "lib/newsletter.ts"]) {
    const text = readFileSync(file, "utf8");
    const valueImports = [...text.matchAll(/^import (?!type\b)[^;]*from "([^"]+)";/gm)].map((m) => m[1]);
    // Job 21 (header Login link): the frame reads the Login and Account labels from two copy tables, and only those two.
    const allowed = file === "components/site/public-frame.tsx" ? ["../../lib/copy/home", "../../lib/copy/guest"] : [];
    for (const from of valueImports) assert.equal(/lib\/copy\//.test(from) && !allowed.includes(from), false, `${file} imports ${from}`);
  }
});
