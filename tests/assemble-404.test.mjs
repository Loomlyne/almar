import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderStaticNotFound } from "../lib/not-found-document.ts";

test("static 404 html matches the contract and the assemble script ignores the catch-all", () => {
  const html = renderStaticNotFound();
  assert.match(html, /Page not found/);
  assert.match(html, /Return home/);
  assert.match(html, /href="\/"/);
  assert.match(html, /Curves_black\.svg/);
  assert.equal(html.includes("Bricolage"), false);
  assert.equal(html.includes("#f9f6f3"), false);
  assert.equal(html.includes("Destinations"), false);

  const script = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  assert.equal(script.includes("app/[...not_found]/route.ts"), false);
  assert.equal(script.includes("const HTML = `"), false);
});
