import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const wrangler = readFileSync("wrangler.toml", "utf8");

test("package.json has no vercel script", () => {
  const scripts = pkg.scripts ?? {};
  for (const [name, command] of Object.entries(scripts)) {
    assert.equal(
      name.includes("vercel") || String(command).includes("vercel"),
      false,
      `${name} is a vercel script`,
    );
  }
});

test("wrangler.toml does not name the dashboard host", () => {
  assert.equal(wrangler.includes("dashboard.almarprivatejourney.com"), false);
});
