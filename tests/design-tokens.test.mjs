import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SCOPES = ["app/globals.css", "app/layout.tsx", "app/design", "components"];
const ALLOWED_TYPE_TOKENS = [
  "--text-body",
  "--text-label",
  "--text-heading",
  "--text-display",
];
const BANNED = [
  "Bricolage",
  "Philosopher",
  "#f9f6f3",
  "#183e43",
  "#a98e58",
  "#0f677d",
];

function stripComments(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== "" && !trimmed.startsWith("//") && !trimmed.startsWith("*");
    })
    .join("\n");
}

function collectFiles(dir, acc) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      collectFiles(path, acc);
      continue;
    }
    if (name.endsWith(".test.mjs") || name.endsWith(".spec.ts") || name.endsWith("route.ts")) {
      continue;
    }
    if (/\.(css|tsx|ts|mjs|js)$/.test(name)) acc.push(path);
  }
}

test("design tokens are declared without banned strings", () => {
  assert.equal(
    existsSync("app/globals.css"),
    true,
    "app/globals.css does not exist",
  );

  const files = [];
  for (const scope of SCOPES) {
    if (!existsSync(scope)) continue;
    if (statSync(scope).isDirectory()) collectFiles(scope, files);
    else if (!scope.endsWith("route.ts")) files.push(scope);
  }

  const texts = new Map(
    files.map((file) => [file, stripComments(readFileSync(file, "utf8"))]),
  );
  const corpus = [...texts.values()].join("\n");

  for (const hex of ["#1f3b40", "#262626", "#d4ba8a", "#fffaf0"]) {
    assert.match(corpus, new RegExp(hex, "i"), `missing ${hex}`);
  }
  assert.match(corpus, /--color-warning/);
  assert.match(corpus, /#8a3b12/i);
  assert.match(corpus, /:focus-visible/);

  for (const [file, text] of texts) {
    for (const word of BANNED) {
      assert.equal(
        new RegExp(word, "i").test(text),
        false,
        `${file} contains banned ${word}`,
      );
    }
    assert.equal(/\.dark\b/.test(text), false, `${file} contains a .dark selector`);
    if (!/:focus-visible/.test(text)) {
      assert.equal(
        /outline\s*:\s*none/i.test(text),
        false,
        `${file} sets outline none without a :focus-visible rule`,
      );
    }
  }

  const css = texts.get("app/globals.css") ?? "";
  const declared = [
    ...new Set([...css.matchAll(/(--text-[a-z0-9-]+)\s*:/g)].map((match) => match[1])),
  ].sort();
  assert.deepEqual(declared, [...ALLOWED_TYPE_TOKENS].sort());
});

function classTokens(source) {
  const tokens = [];
  const patterns = [
    /className="([^"]*)"/g,
    /className='([^']*)'/g,
    /className=\{`([^`]*)`\}/g,
    /className=\{"([^"]*)"\}/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      tokens.push(...match[1].split(/\s+/).filter(Boolean));
    }
  }
  return tokens;
}

function isPhysicalClass(token) {
  const bare = token.replace(/^(?:[a-z0-9-]+:)+/, "");
  return (
    /^(?:ml|mr|pl|pr|left|right)-/.test(bare) ||
    /^text-(?:left|right)$/.test(bare)
  );
}

test("components avoid physical utilities and raw html injection", () => {
  if (!existsSync("components")) return;
  const files = [];
  collectFiles("components", files);
  for (const file of files.filter((path) => path.endsWith(".tsx"))) {
    const text = stripComments(readFileSync(file, "utf8"));
    assert.equal(
      text.includes("dangerouslySetInnerHTML"),
      false,
      `${file} contains dangerouslySetInnerHTML`,
    );
    for (const token of classTokens(text)) {
      assert.equal(
        isPhysicalClass(token),
        false,
        `${file} contains physical class ${token}`,
      );
    }
  }
});
