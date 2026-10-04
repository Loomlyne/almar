import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// D-29 guardrail. Strict on the whole scope: no allowlist of unconverted files.

const SCAN_DIRS = ["app", "components", "lib"];
const SCAN_EXTRA = ["app/globals.css", "app/layout.tsx"];
const SKIP_PREFIXES = ["lib/copy/"];
const SKIP_FILES = ["lib/not-found-document.ts"];
const STEPS = ["caption", "label", "body", "title", "heading", "display", "hero"];
const SPACING_ALLOWED = new Set(["0", "px", "0.5", "1", "2", "3", "4", "6", "8", "12", "16"]);
const FONT_BOLD_ALLOWLIST = [
  "journey-cart.tsx",
  "stepper.tsx",
  "date-range-panel.tsx",
  "journey-bar.tsx",
  "journey-sheet.tsx",
];
const BANNED = ["Bricolage", "Philosopher", "#f9f6f3", "#183e43", "#a98e58", "#0f677d"];
const LAYER_ORDER = "@layer theme, base, components, utilities;";
const CLASS_DIRS = ["components/journey", "components/ui"];

const tokens = JSON.parse(readFileSync("tokens.json", "utf8"));

function tokenHexes() {
  const found = new Set();
  const walk = (value) => {
    if (typeof value === "string") {
      for (const m of value.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
        found.add(m[0].toLowerCase());
      }
    } else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(tokens);
  return found;
}
const TOKEN_HEX = tokenHexes();

export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t !== "" && !t.startsWith("//") && !t.startsWith("*");
    })
    .join("\n");
}

function collect(dir, acc) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      collect(path, acc);
      continue;
    }
    acc.push(path);
  }
}

function scopedFiles() {
  const all = [];
  for (const dir of SCAN_DIRS) if (existsSync(dir)) collect(dir, all);
  const files = all.filter((f) => {
    if (SKIP_FILES.includes(f) || SKIP_PREFIXES.some((p) => f.startsWith(p))) return false;
    const name = f.split("/").pop();
    if (name.endsWith(".d.ts")) return false;
    if (/\.(test|spec)\.(ts|tsx|mjs)$/.test(name) || name === "route.ts") return false;
    return /\.(css|tsx|ts)$/.test(name);
  });
  for (const extra of SCAN_EXTRA) if (existsSync(extra) && !files.includes(extra)) files.push(extra);
  return files.sort();
}

// ---- class extraction -------------------------------------------------------

function quotedStrings(text) {
  const out = [];
  for (const m of text.matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'|`([^`\\]*)`/g)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return out;
}

function callArguments(text, names) {
  const out = [];
  const re = new RegExp(`\\b(?:${names.join("|")})\\(`, "g");
  let match;
  while ((match = re.exec(text))) {
    let depth = 1;
    let i = re.lastIndex;
    let quote = null;
    for (; i < text.length && depth > 0; i += 1) {
      const c = text[i];
      if (quote) {
        if (c === "\\") i += 1;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "(") depth += 1;
      else if (c === ")") depth -= 1;
    }
    out.push(text.slice(re.lastIndex, i - 1));
  }
  return out;
}

const UTILITY_HINT =
  /^(?:[a-z0-9-]+:)*!?-?(?:p[xytblrse]?|m[xytblrse]?|gap|space|inset|top|bottom|start|end|left|right|rounded|border|bg|text|fill|stroke|font|shadow|ring|w|h|size|min|max|flex|grid|items|justify)(?:-|$)/;

export function classTokens(source, file) {
  const strings = [];
  const attr = [
    /className="([^"]*)"/g,
    /className='([^']*)'/g,
    /className=\{`([^`]*)`\}/g,
    /className=\{"([^"]*)"\}/g,
  ];
  for (const re of attr) for (const m of source.matchAll(re)) strings.push(m[1]);
  for (const args of callArguments(source, ["cva", "cn", "twMerge"])) strings.push(...quotedStrings(args));
  if (CLASS_DIRS.some((d) => file.startsWith(`${d}/`))) {
    for (const s of quotedStrings(source)) {
      const parts = s.split(/\s+/).filter(Boolean);
      if (parts.length > 0 && parts.every((p) => /^[A-Za-z0-9:!\-_/.[\]#%(),@&>*=~+']+$/.test(p)) && parts.some((p) => UTILITY_HINT.test(p))) {
        strings.push(s);
      }
    }
  }
  return strings.flatMap((s) => s.split(/\s+/).filter(Boolean));
}

const bare = (token) => token.replace(/^(?:[^:[\]]+:)+/, "").replace(/^!/, "");

function tokenViolations(token, file) {
  const out = [];
  const b = bare(token);
  if (/\[[^\]]*\]/.test(token)) out.push(`arbitrary value ${token}`);
  if (/^-?(?:ml|mr|pl|pr|left|right)-/.test(b) || /^text-(?:left|right)$/.test(b) || /^border-[lr](?:-|$)/.test(b)) {
    out.push(`physical utility ${token}`);
  }
  if (/^rounded(?:-|$)/.test(b) && b !== "rounded-none") out.push(`rounded utility ${token}`);
  if (/^(?:bg|text|fill|stroke)-gold(?:\/|$)/.test(b)) out.push(`gold used as fill or text ${token}`);
  const sp = b.match(/^-?(?:p[xytbse]?|m[xytbse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|bottom|start|end)-(.+)$/);
  if (sp && /^\d+(?:\.\d+)?$/.test(sp[1]) && !SPACING_ALLOWED.has(sp[1])) {
    out.push(`off-scale spacing ${token}`);
  }
  if (b === "font-bold" && !FONT_BOLD_ALLOWLIST.includes(file.split("/").pop())) {
    out.push(`font-bold outside allowlist (${token})`);
  }
  return out;
}

function fileViolations(file) {
  const out = [];
  if (file.endsWith(".module.css")) out.push("module.css is not allowed (Tailwind v4 only)");
  const text = stripComments(readFileSync(file, "utf8"));
  for (const hex of new Set([...text.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((m) => m[0].toLowerCase()))) {
    if (!TOKEN_HEX.has(hex)) out.push(`hex ${hex} is not in tokens.json`);
  }
  for (const word of BANNED) {
    if (new RegExp(word, "i").test(text)) out.push(`banned string ${word}`);
  }
  if (/\.dark\b/.test(text)) out.push("contains a .dark selector");
  // One exemption, approved by the controller 2026-10-03: JSON-LD cannot be rendered without raw HTML
  // (React escapes a <script> text child). Allowed only while the file's payload is a fixed literal.
  const JSON_LD_FILE = "components/site/organization-json-ld.ts";
  const BLOG_JSON_LD_FILE = "components/site/blog-posting-json-ld.ts";
  if (/dangerouslySetInnerHTML/.test(text)) {
    const fixedLiteral = /export const ORGANIZATION_JSON_LD =\s*'[^'`$]*';/.test(text) && !/[`]|\$\{/.test(text);
    if (file === BLOG_JSON_LD_FILE) {
      // Plan 32: the post's BlogPosting carries data, so it is allowed only while every "<" of the JSON text is escaped
      // (JSON.stringify(...).replace(/</g, "\\u003c")) and nothing is assigned through innerHTML.
      const escaped = text.includes('.replace(/</g, "\\\\u003c")') && !/\.innerHTML\s*=/.test(text);
      if (!escaped) out.push("dangerouslySetInnerHTML without the < escape");
    } else if (file !== JSON_LD_FILE || !fixedLiteral) out.push("dangerouslySetInnerHTML");
  }
  if (/\.(tsx|ts)$/.test(file)) {
    for (const token of classTokens(text, file)) out.push(...tokenViolations(token, file));
  }
  return [...new Set(out)];
}

// ---- css layer analysis -----------------------------------------------------

/** Top-level statements of a stylesheet with their prelude and (for blocks) the depth-1 preludes. */
export function topLevel(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const statements = [];
  let depth = 0;
  let start = 0;
  let current = null;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (c === "{") {
      if (depth === 0) current = { prelude: src.slice(start, i).trim(), inner: [], body: "" };
      else if (depth === 1 && current) current.inner.push(src.slice(start, i).trim());
      depth += 1;
      start = i + 1;
    } else if (c === "}") {
      depth -= 1;
      start = i + 1;
      if (depth === 0 && current) {
        statements.push(current);
        current = null;
      }
    } else if (c === ";" && depth === 0) {
      statements.push({ prelude: src.slice(start, i).trim(), inner: [], statement: true });
      start = i + 1;
    } else if (c === ";" && depth === 1) {
      start = i + 1;
    }
  }
  return statements;
}

export function unlayered(css) {
  return topLevel(css)
    .map((s) => s.prelude)
    .filter((p) => !/^@(?:layer|import|custom-variant|theme)\b/.test(p));
}

// ---- tests ------------------------------------------------------------------

test("tokens.json holds design values only", () => {
  const raw = readFileSync("tokens.json", "utf8");
  assert.equal(/https?:\/\//.test(raw), false, "tokens.json has a URL");
  assert.equal(/secret|api[-_]?key|password/i.test(raw), false, "tokens.json has a secret-looking key");
  assert.match(tokens.color["teal-tint"], /#d1dfe0/i);
  assert.equal(tokens.radius.control, "0");
  assert.equal(tokens.radius.overlay, "0");
  assert.equal(tokens.spacing.control, "44px");
});

test("app/globals.css declares layer order first and keeps every rule layered", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  assert.ok(stripped.startsWith(LAYER_ORDER), `first statement must be ${LAYER_ORDER}`);
  assert.ok(stripped.indexOf(LAYER_ORDER) < stripped.indexOf('@import "tailwindcss"'), "layer order must precede @import");
  assert.deepEqual(unlayered(css), [], "unlayered rules beat utilities; wrap them in @layer");
  assert.match(css, /GENERATED:THEME:START/);
  assert.match(css, /@custom-variant ar /);
  assert.match(css, /@custom-variant dense /);
  const base = topLevel(css).filter((s) => s.prelude === "@layer base");
  assert.ok(base.length > 0, "@layer base must exist");
  assert.ok(base.some((b) => b.inner.some((p) => /^h1\b/.test(p))), "h1 rule must live in @layer base");
  assert.deepEqual(topLevel(css).map((s) => s.prelude).filter((p) => /^@layer\s+\w+$/.test(p) && p !== "@layer base"), [], "only @layer base is allowed");
});

test("app/globals.css has no class or id selector outside the generated theme", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const outside = css.replace(/\/\* GENERATED:THEME:START \*\/[\s\S]*?\/\* GENERATED:THEME:END \*\//, "");
  const stripped = outside.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = [];
  for (const s of topLevel(stripped)) {
    if (/^@layer\s+base$/.test(s.prelude)) selectors.push(...s.inner);
    else if (!/^@(?:layer|import|custom-variant|theme)\b/.test(s.prelude)) selectors.push(s.prelude);
  }
  const bad = selectors.filter((p) => !p.startsWith("@") && /(?:^|[\s,>+~])[.#][A-Za-z_-]/.test(p));
  assert.deepEqual(bad, [], "class or id selectors belong in components as utilities");
  assert.equal(/nav-tools|Comment \d+/.test(stripped), false, "no route-keyed patches");
  assert.ok(css.split("\n").length < 200, "globals.css must stay under 200 lines");
});

test("no module.css and no framerusercontent in components or non-route app code", () => {
  const all = [];
  for (const dir of SCAN_DIRS) if (existsSync(dir)) collect(dir, all);
  assert.deepEqual(all.filter((f) => f.endsWith(".module.css")), []);
  const hits = all.filter(
    (f) => /\.(tsx|ts)$/.test(f) && !f.endsWith("route.ts") && !f.startsWith("lib/copy/") && /framerusercontent/.test(readFileSync(f, "utf8")),
  );
  assert.deepEqual(hits, [], "framerusercontent logo references are not allowed");
});

test("layer analysis flags an unlayered probe rule", () => {
  assert.deepEqual(unlayered("@layer base { a { color: red } } h1 { color: red }"), ["h1"]);
  assert.deepEqual(unlayered('@layer a, b;\n@import "x";\n@theme { --a: 1 }\n@layer base { a { b: c } }'), []);
});

test("exactly the seven type steps are declared", () => {
  const css = stripComments(readFileSync("app/globals.css", "utf8"));
  const declared = [
    ...new Set([...css.matchAll(/(--text-[a-z0-9-]+)\s*:/g)].map((m) => m[1]).filter((n) => !n.includes("--line-height"))),
  ].sort();
  assert.deepEqual(declared, STEPS.map((s) => `--text-${s}`).sort());
  assert.deepEqual(Object.keys(tokens.text), STEPS);
});

test("required brand hexes and focus rule exist", () => {
  const css = readFileSync("app/globals.css", "utf8");
  for (const hex of ["#1f3b40", "#262626", "#d4ba8a", "#fffaf0", "#8a3b12", "#d1dfe0"]) {
    assert.match(css, new RegExp(hex, "i"), `missing ${hex}`);
  }
  assert.match(css, /:focus-visible/);
});

test("standalone 404 document only uses tokens.json hexes", () => {
  const text = readFileSync("lib/not-found-document.ts", "utf8");
  for (const m of text.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    assert.ok(TOKEN_HEX.has(m[0].toLowerCase()), `not-found-document.ts hex ${m[0]} is not in tokens.json`);
  }
});

test("every scoped file passes the token rules", () => {
  const bad = [];
  for (const file of scopedFiles()) {
    const v = fileViolations(file);
    if (v.length > 0) bad.push(`${file}\n    ${v.slice(0, 8).join("\n    ")}`);
  }
  assert.deepEqual(bad, [], `violations:\n${bad.join("\n")}`);
});
