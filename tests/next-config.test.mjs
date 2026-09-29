import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

test("next.config.ts is the only Next config", () => {
  const configs = readdirSync(".").filter((f) => /^next\.config\./.test(f));
  assert.deepEqual(configs, ["next.config.ts"]);
});

test("Stacked_Charcoal.svg is a valid charcoal lockup", () => {
  const file = "brand/Logo Typography/Stacked_Charcoal.svg";
  assert.ok(existsSync(file));
  const svg = readFileSync(file, "utf8");
  assert.match(svg, /<svg/);
  assert.match(svg, /#262626/i);
  assert.doesNotMatch(svg, /<script|foreignObject/i);
  assert.ok(svg.length < 200 * 1024);
});
