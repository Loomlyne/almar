import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The owner, 2026-10-30: nothing on the site is underlined, link or not, at rest or on hover. How each kind of link looks
// instead lives in components/ui/link.tsx. `no-underline` is allowed (it removes a line); so is line-through (a blocked day).
// The Framer route.ts exports are left out: they are exported pages, checked by hand.

const SOURCE = /\.(?:tsx?|mjs|css)$/;

function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) collect(path, out);
    else if (SOURCE.test(name) && name !== "route.ts") out.push(path);
  }
  return out;
}

/** The source without its comments, so a comment may name the rule. */
function code(file) {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** Every class-like word, with its variants taken off. */
const bareWords = (text) => text.split(/[\s"'`{}()]+/).map((word) => word.replace(/^(?:[^:[\]]+:)+/, "").replace(/^!/, ""));

test("no underline or decoration- class in components or app", () => {
  const found = [];
  for (const file of [...collect("components"), ...collect("app")]) {
    for (const word of bareWords(code(file))) {
      if (/^(?:underline|underline-offset-.+|decoration-.+)$/.test(word)) found.push(`${file}: ${word}`);
    }
  }
  assert.deepEqual(found, []);
});

test("no CSS or inline style draws an underline in components, app or lib", () => {
  const found = [];
  for (const file of [...collect("components"), ...collect("app"), ...collect("lib")]) {
    if (/text-decoration(?:-line)?\s*:\s*underline|textDecoration(?:Line)?\s*:\s*["'`]underline/.test(code(file))) found.push(file);
  }
  assert.deepEqual(found, []);
});

test("every link in an email says text-decoration:none itself, because a mail app adds a line otherwise", () => {
  for (const file of ["lib/email/shell.ts", "lib/email/magic-link.ts", "lib/site-requests/email.ts"]) {
    const anchors = [...code(file).matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(anchors.length > 0, file);
    for (const anchor of anchors) assert.match(anchor, /text-decoration:none/, `${file}: ${anchor}`);
  }
});
