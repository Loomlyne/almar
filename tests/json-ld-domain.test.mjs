import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Job 04 item 12: the JSON-LD on every Framer page names the real domain, never Framer's.
const DOMAIN = "https://almarprivatejourney.com/";

function framerRoutes(dir = "app", out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) framerRoutes(path, out);
    else if (name === "route.ts" && readFileSync(path, "utf8").includes('const HTML = "')) out.push(path);
  }
  return out;
}

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

test("there are Framer pages to check", () => {
  assert.equal(routes.length, 26);
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
