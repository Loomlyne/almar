import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  HIDDEN,
  KNOWN_DEAD,
  RETIRES_WITH_STAY_PAGES,
  SITE,
  deadKey,
  framerPagePath,
  framerRoutes,
  englishReactRoutes,
  reactPublicRoutes,
} from "./helpers/site-links.mjs";

// Job 04 item 11: no Framer page links to a path that has no route.
// 3.3: the route set is the Framer routes plus the React public pages in every locale. The HIDDEN and
// KNOWN_DEAD lists live in tests/helpers/site-links.mjs, shared with the built-output check.

const routes = framerRoutes();
const reactRoutes = reactPublicRoutes();
const pages = new Set([...routes.map(framerPagePath), ...reactRoutes.map((p) => (p.length > 1 ? p.replace(/\/$/, "") : p))]);
const hasRoute = (path) => pages.has(path) || (existsSync(join("public", path)) && statSync(join("public", path)).isFile());

// path -> pages that link to it, for every internal link with no route
const dead = new Map();
for (const file of routes) {
  const { GET } = await import(pathToFileURL(file).href);
  const html = await GET().text();
  for (const [, href] of html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
    if (/^(mailto:|tel:|#)/.test(href)) continue;
    const url = new URL(href.replaceAll("&amp;", "&"), SITE + framerPagePath(file));
    if (url.origin !== SITE) continue;
    const path = url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
    if (!hasRoute(path)) dead.set(path, [...(dead.get(path) ?? []), framerPagePath(file)]);
  }
}

const englishReact = englishReactRoutes();

test("the 26 English pages are all accounted for", () => {
  assert.equal(routes.length + englishReact.length, 26);
});

test("no page links to the paths hidden by job 04", () => {
  assert.deepEqual([...dead.keys()].filter((path) => HIDDEN.includes(deadKey(path))), []);
});

test("every link without a route is a known one", () => {
  const unknown = [...dead]
    .filter(([path]) => !KNOWN_DEAD.includes(deadKey(path)))
    .map(([path, from]) => `${path} (from ${from[0]})`);
  assert.deepEqual(unknown, []);
});

test("every known dead link is still linked and still has no route", () => {
  const linked = new Set([...dead.keys()].map(deadKey));
  const stayPagesGone = !routes.some((file) => /^\/private-stays\/[^/]+$/.test(framerPagePath(file)));
  const exempt = stayPagesGone ? RETIRES_WITH_STAY_PAGES : [];
  assert.deepEqual(KNOWN_DEAD.filter((path) => !linked.has(path) && !exempt.includes(path)), []);
});
