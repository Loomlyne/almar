import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// Plan 03.3-08, Task 2. The review host's Worker config, and the three things that keep its noindex off the live
// site: wrangler.toml untouched, the root _headers free of any robots header, public/ free of crawl files.
// Tests run from the repo root. No wrangler is run here: the files are read as text.

const preview = readFileSync("wrangler.preview.toml", "utf8");
const live = readFileSync("wrangler.toml", "utf8");

/** The lines of a `[table]` up to the next blank line. */
function block(text, header) {
  const lines = text.split("\n");
  const start = lines.indexOf(header);
  assert.notEqual(start, -1, `${header} is missing`);
  const out = [];
  for (let i = start + 1; i < lines.length && lines[i].trim() !== ""; i += 1) out.push(lines[i]);
  return out;
}

/** The top-level key lines (before the first table), comments excluded. */
function topLevel(text) {
  const out = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("[")) break;
    if (line.trim() !== "" && !line.startsWith("#")) out.push(line);
  }
  return out;
}

// Job 10 (plan 02-20) gave both Worker files the same server runtime on purpose: main, flags, preview_urls and the
// ASSETS binding. Everything else in this file is plan 08's, unchanged.
const RUNTIME_LINES = [
  'compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]',
  'main = "worker/almar.mjs"',
];

test("wrangler.preview.toml: the Worker, the account, the date and the job 10 runtime", () => {
  assert.deepEqual(topLevel(preview), [
    'name = "almar-preview"',
    'account_id = "f1d9a1fa3abdda98c15161b00b40385c"',
    'compatibility_date = "2026-09-23"',
    ...RUNTIME_LINES,
    "workers_dev = false",
    "preview_urls = false",
  ]);
  assert.equal(/^\[vars\]|^\[\[.*(bindings|kv|r2|d1|queues|services)/im.test(preview), false, "no vars and no binding");
});

test("wrangler.preview.toml: the compatibility date and the account are wrangler.toml's", () => {
  assert.equal(topLevel(preview).find((l) => l.startsWith("compatibility_date")), topLevel(live).find((l) => l.startsWith("compatibility_date")));
  assert.equal(topLevel(preview).find((l) => l.startsWith("account_id")), topLevel(live).find((l) => l.startsWith("account_id")));
});

test("wrangler.preview.toml: [assets] is wrangler.toml's, except that it serves out-preview/", () => {
  const previewAssets = block(preview, "[assets]");
  const liveAssets = block(live, "[assets]");
  assert.deepEqual(liveAssets, ['directory = "./out"', 'binding = "ASSETS"', 'run_worker_first = ["/api/*"]', 'html_handling = "auto-trailing-slash"', 'not_found_handling = "404-page"']);
  assert.deepEqual(previewAssets, ['directory = "./out-preview"', ...liveAssets.slice(1)]);
});

test("wrangler.preview.toml: exactly one route, the preview custom domain", () => {
  assert.equal((preview.match(/^\[\[routes\]\]$/gm) ?? []).length, 1);
  assert.deepEqual(block(preview, "[[routes]]"), ['pattern = "preview.almarprivatejourney.com"', "custom_domain = true"]);
  assert.equal(/almarprivatejourney\.com"/.test(preview.replace('pattern = "preview.almarprivatejourney.com"', "")), false, "no second hostname");
});

test("wrangler.toml still serves out/ for the live Worker and its two custom domains, and says nothing about preview", () => {
  assert.deepEqual(topLevel(live), [
    'name = "almar"',
    'account_id = "f1d9a1fa3abdda98c15161b00b40385c"',
    'compatibility_date = "2026-09-23"',
    ...RUNTIME_LINES,
    "workers_dev = false",
    "preview_urls = false",
  ]);
  assert.equal((live.match(/^\[\[routes\]\]$/gm) ?? []).length, 2);
  assert.ok(live.includes('pattern = "almarprivatejourney.com"'));
  assert.ok(live.includes('pattern = "www.almarprivatejourney.com"'));
  assert.ok(live.includes('directory = "./out"'));
  // `preview_urls` holds the word on purpose (job 10); the preview Worker and host never appear.
  assert.equal(/almar-preview|preview\.almarprivatejourney/i.test(live), false, "wrangler.toml names neither the preview host nor almar-preview");
});

test("wrangler.toml: exactly the live routes, the account and no workers.dev address (job 10 replaced the origin/main identity check)", () => {
  assert.deepEqual(block(live, "[[routes]]"), ['pattern = "almarprivatejourney.com"', "custom_domain = true"]);
  const routes = live.split("\n").filter((l) => l.startsWith("pattern = "));
  assert.deepEqual(routes, ['pattern = "almarprivatejourney.com"', 'pattern = "www.almarprivatejourney.com"']);
  assert.match(live, /^account_id = "f1d9a1fa3abdda98c15161b00b40385c"$/m);
  assert.match(live, /^workers_dev = false$/m);
});

test("the repo-root _headers (served by production) carries no robots header", () => {
  const headers = readFileSync("_headers", "utf8");
  assert.equal(/noindex/i.test(headers), false);
  assert.equal(/x-robots-tag/i.test(headers), false);
});

test("the preview-only header block and robots file live in deploy/preview/ and nowhere else", () => {
  assert.equal(readFileSync("deploy/preview/_headers", "utf8"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
  assert.equal(readFileSync("deploy/preview/robots.txt", "utf8"), "User-agent: *\nDisallow: /\n");
  assert.equal(readFileSync("deploy/production/robots.txt", "utf8"), "User-agent: *\nAllow: /\n\nSitemap: https://almarprivatejourney.com/sitemap.xml\n");
  assert.equal(/noindex|x-robots-tag/i.test(readFileSync("deploy/production/robots.txt", "utf8")), false);
});

test("public/ holds no robots.txt, sitemap.xml or _headers", () => {
  for (const name of ["robots.txt", "sitemap.xml", "_headers"]) {
    assert.equal(existsSync(`public/${name}`), false, `public/${name}`);
  }
});

test("out-preview/ is gitignored, so a preview build can never be committed", () => {
  assert.ok(readFileSync(".gitignore", "utf8").split("\n").includes("/out-preview/"));
});
