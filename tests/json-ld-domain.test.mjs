import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { englishReactRoutes, framerRoutes } from "./helpers/site-links.mjs";

// Job 04 item 12: the JSON-LD on every Framer page names the real domain, never Framer's.
const DOMAIN = "https://almarprivatejourney.com/";

function urls(value, out = []) {
  if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) out.push(value);
  } else if (value && typeof value === "object") {
    // "@context" names the schema.org vocabulary, not a page of the site.
    for (const [k, v] of Object.entries(value)) if (k !== "@context") urls(v, out);
  }
  return out;
}

const routes = framerRoutes();

// The 26 English pages are Framer route handlers plus React pages (3.3 converts 14 of them). The per-page
// JSON-LD check below runs on the Framer ones; the React documents are checked in the built output by
// tests/build/assembled-site.test.mjs.
test("the 26 English pages are all accounted for", () => {
  assert.equal(routes.length + englishReactRoutes().length, 26);
});

for (const file of routes) {
  test(`JSON-LD points at ${DOMAIN} in ${file}`, async () => {
    const { GET } = await import(pathToFileURL(file).href);
    const html = await GET().text();
    const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length > 0, "no JSON-LD block");
    for (const [, body] of blocks) {
      for (const url of urls(JSON.parse(body))) assert.ok(url.startsWith(DOMAIN), url);
    }
    assert.equal(html.includes("framer.website"), false);
  });
}
