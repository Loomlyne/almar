import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cn, TOKEN_GROUPS } from "../lib/cn.ts";

const tokens = JSON.parse(readFileSync("tokens.json", "utf8"));
const set = (s) => s.split(" ").sort().join(" ");

test("size and colour are different groups", () => {
  assert.equal(set(cn("text-body", "text-teal")), set("text-body text-teal"));
});

test("two font sizes collapse to the last", () => {
  assert.equal(cn("text-body", "text-title"), "text-title");
});

test("background colours collapse, text colour survives", () => {
  assert.equal(cn("bg-teal", "bg-surface"), "bg-surface");
  assert.equal(set(cn("bg-teal", "text-ivory")), set("bg-teal text-ivory"));
});

test("shadow tokens collapse", () => {
  assert.equal(cn("shadow-float", "shadow-lg"), "shadow-lg");
  assert.equal(cn("shadow-rule-primary", "shadow-selected"), "shadow-selected");
});

test("dimension tokens collapse per axis", () => {
  assert.equal(cn("h-control", "h-bar"), "h-bar");
  assert.equal(set(cn("h-control", "w-search")), set("h-control w-search"));
});

test("container tokens collapse on max-w", () => {
  assert.equal(cn("max-w-menu", "max-w-calendar"), "max-w-calendar");
});

test("falsy values and arrays are accepted", () => {
  assert.equal(cn("p-4", false, null, undefined, ["gap-2", ["text-label"]]), "p-4 gap-2 text-label");
});

test("TOKEN_GROUPS match tokens.json (drift)", () => {
  assert.deepEqual([...TOKEN_GROUPS.color], Object.keys(tokens.color));
  assert.deepEqual([...TOKEN_GROUPS.text], Object.keys(tokens.text));
  assert.deepEqual([...TOKEN_GROUPS.shadow], Object.keys(tokens.shadow));
  assert.deepEqual([...TOKEN_GROUPS.spacing], Object.keys(tokens.spacing));
  assert.deepEqual([...TOKEN_GROUPS.container], Object.keys(tokens.container));
});
