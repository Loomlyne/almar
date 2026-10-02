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

test("wrangler.toml pins the ALMAR Cloudflare account", () => {
  // Account "Almar Private Journey"; the Vamos account must never receive a deploy.
  assert.match(wrangler, /^account_id = "f1d9a1fa3abdda98c15161b00b40385c"$/m);
});

test("wrangler.toml turns off the workers.dev address", () => {
  assert.match(wrangler, /^workers_dev = false$/m);
});
