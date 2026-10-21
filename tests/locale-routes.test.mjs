import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { PUBLIC_PAGES } from "../lib/locale-path.ts";

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const tsx = [...walk("app"), ...walk("components")].filter((f) => f.endsWith(".tsx"));

test("only components/site/locale-document.tsx renders <html> or <body>", () => {
  const holders = tsx.filter((f) => /<html[\s>]|<body[\s>]/.test(readFileSync(f, "utf8")));
  assert.deepEqual(holders.map((f) => relative(".", f)), ["components/site/locale-document.tsx"]);
});

function routeFile(locale, pattern) {
  const segments = pattern === "/" ? [] : pattern.split("/").slice(1);
  return join("app", locale, ...segments, "page.tsx");
}

test("each public page has its EN, AR and ES route files together, or none of them", () => {
  for (const pattern of PUBLIC_PAGES) {
    const files = ["en", "ar", "es"].map((l) => routeFile(l, pattern));
    const present = files.filter((f) => existsSync(f));
    assert.ok(
      present.length === 0 || present.length === 3,
      `${pattern}: found ${present.join(", ") || "none"}; the three locales must land together (${files.join(", ")})`,
    );
  }
});

test("the one dynamic first-level segment is app/[locale], and it holds only the guest pages; app/en, app/ar and app/es are literal", () => {
  const first = readdirSync("app", { withFileTypes: true }).filter((e) => e.isDirectory());
  const dynamic = first.filter((e) => /^\[.*\]$/.test(e.name));
  // Job 21: a dynamic root segment would also match the literal public pages, so it may hold nothing but the pages the
  // Worker renders itself (login, account, bookings); the public pages live in the literal app/en, app/ar, app/es.
  assert.deepEqual(dynamic.map((e) => e.name), ["[locale]"]);
  const held = readdirSync("app/[locale]", { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  assert.deepEqual(held.sort(), ["account", "bookings", "login"]);
  for (const l of ["en", "ar", "es"]) assert.equal(existsSync(join("app", l, "page.tsx")), true, `app/${l}/page.tsx`);
  assert.equal(existsSync("app/page.tsx"), false, "English has its prefix too: there is no unprefixed app/page.tsx");
});

test("no route file under app/en, app/ar or app/es is a client component, and none adds an <html> layout", () => {
  for (const l of ["en", "ar", "es"]) {
    for (const f of walk(join("app", l))) {
      if (/\/page\.tsx$/.test(f)) {
        const head = readFileSync(f, "utf8").trimStart();
        assert.equal(/^["']use client["']/.test(head), false, `${f} must be a server component`);
      }
      if (/\/layout\.tsx$/.test(f)) {
        assert.equal(/<html[\s>]|<body[\s>]/.test(readFileSync(f, "utf8")), false, `${f} must not render <html> or <body>`);
      }
    }
  }
});
