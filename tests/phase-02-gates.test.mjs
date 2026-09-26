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
