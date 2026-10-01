import test from "node:test";
import assert from "node:assert/strict";
import { canBecomeHttpsUrl, isHttpsUrl } from "../lib/https-url.ts";

test("every prefix of https:// can still become a URL, so typing is kept", () => {
  for (const partial of ["", "h", "ht", "https", "https:", "https:/", "https://", "https://cdn.example.com/a.jpg"]) {
    assert.equal(canBecomeHttpsUrl(partial), true, partial);
  }
});

test("a value that can never be https:// is flagged", () => {
  for (const bad of ["x", "http://", "http://cdn.example.com", "ftp://a", "javascript:alert(1)", "Https://a"]) {
    assert.equal(canBecomeHttpsUrl(bad), false, bad);
  }
});

test("only a complete https:// URL counts as savable", () => {
  assert.equal(isHttpsUrl("https://cdn.example.com/a.jpg"), true);
  for (const value of ["", "h", "https://", "http://cdn.example.com"]) {
    assert.equal(isHttpsUrl(value), false, value);
  }
});
