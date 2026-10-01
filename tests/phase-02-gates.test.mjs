import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib"];
const NEEDLES = ["eyJ", "re_"];

function collectFiles(dir, acc) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === "node_modules") continue;
    if (statSync(path).isDirectory()) {
      collectFiles(path, acc);
      continue;
    }
    acc.push(path);
  }
}

test("package.json has no vercel script", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
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
  const wrangler = readFileSync("wrangler.toml", "utf8");
  assert.equal(wrangler.includes("dashboard.almarprivatejourney.com"), false);
});

test("next stays 15.5.26", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.dependencies.next, "15.5.26");
});

test("app, components, and lib contain no key material", () => {
  const files = [];
  for (const root of ROOTS) collectFiles(root, files);
  const hits = [];
  for (const path of files) {
    const text = readFileSync(path, "utf8");
    for (const needle of NEEDLES) {
      if (text.includes(needle)) hits.push(`${path} contains ${needle}`);
    }
  }
  assert.deepEqual(hits, []);
});

function readJsonc(path) {
  const text = readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(text);
}

test("wrangler.server.jsonc names almar with no routes, R2 or dashboard host", () => {
  const raw = readFileSync("wrangler.server.jsonc", "utf8");
  const config = readJsonc("wrangler.server.jsonc");
  assert.equal(config.name, "almar");
  assert.equal(config.main, ".open-next/worker.js");
  assert.equal(config.routes, undefined);
  assert.equal(config.route, undefined);
  assert.equal(config.r2_buckets, undefined);
  assert.equal(raw.includes("dashboard.almarprivatejourney.com"), false);
  assert.ok(config.compatibility_flags.includes("nodejs_compat"));
});

test("host:server builds and never deploys", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const script = pkg.scripts["host:server"];
  assert.ok(script.includes("opennextjs-cloudflare build"));
  for (const word of ["deploy", "upload", "preview"]) {
    assert.equal(script.includes(word), false, `host:server contains ${word}`);
  }
});

test("open-next.config.ts does not set a static export", () => {
  const source = readFileSync("open-next.config.ts", "utf8");
  assert.ok(source.includes("defineCloudflareConfig"));
  assert.equal(/output\s*:/.test(source), false);
});
