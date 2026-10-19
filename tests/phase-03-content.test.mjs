import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { DASHBOARD_COPY } from "../lib/copy/dashboard.ts";
import { OPS_CONTENT_COPY } from "../lib/copy/ops-content.ts";

const CONTENT_DIR = "app/dashboard/(ops)/content";
// Plan 03.2-08: Team is its own screen on the kit editor; content-screen.tsx is gone.
const TEAM_SCREEN = `${CONTENT_DIR}/team/team-screen.tsx`;
const TEAM_PAGE = `${CONTENT_DIR}/team/page.tsx`;

const COMING_SOON = `${CONTENT_DIR}/coming-soon.tsx`;
const KINDS = ["pages", "blog", "legal", "navigation"];
// Plan 03.2-12: pages, blog, legal and navigation are Coming soon pages.
const PAGES = KINDS.map((kind) => ({ path: `${CONTENT_DIR}/${kind}/page.tsx`, kind, screen: "coming-soon" }));

test("each content page has no page gate (02-04 owner gate in the layout), is noindex and delegates to its screen with its kind", () => {
  for (const { path, kind, screen } of PAGES) {
    const text = readFileSync(path, "utf8");
    assert.equal(text.includes("use client"), false, `${path} must not be a client component`);
    assert.equal(/NODE_ENV|notFound\(\)/.test(text), false);
    assert.match(text, /robots: \{ index: false, follow: false \}/);
    assert.match(text, new RegExp(`from ["']\\.\\./${screen}["']`));
    assert.match(text, new RegExp(`kind=["']${kind}["']`));
    if (screen === "coming-soon") assert.match(text, /<ComingSoonScreen kind=/);
  }
});

test("the team page has no page gate, is noindex and renders the wired Team screen; the old content screen is gone", () => {
  const text = readFileSync(TEAM_PAGE, "utf8");
  assert.equal(text.includes("use client"), false);
  assert.equal(/NODE_ENV|notFound\(\)/.test(text), false);
  assert.match(text, /robots: \{ index: false, follow: false \}/);
  assert.match(text, /from ["']\.\/team-screen["']/);
  assert.match(text, /<TeamScreen \/>/);
  assert.equal(existsSync(`${CONTENT_DIR}/content-screen.tsx`), false);
});

test("coming-soon.tsx has no control: no Field, Button, input, button, link or onClick", () => {
  const text = readFileSync(COMING_SOON, "utf8");
  for (const word of ["Field", "Button", "<input", "<button", "<a ", "<Link", "onClick", "fetch(", "<textarea", "<select"]) {
    assert.equal(text.includes(word), false, `coming-soon.tsx must not contain ${word}`);
  }
  assert.match(text, /OPS_CONTENT_COPY\[locale\]/);
  assert.match(text, /export function ComingSoonScreen\(\{ kind \}: \{ kind: ComingSoonKind \}\)/);
});

test("OPS_CONTENT_COPY: en, ar and es have the same keys, every string is non-empty and none is an object where a string belongs", () => {
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  function walk(en, other, path, problems) {
    if (Array.isArray(en)) {
      if (!Array.isArray(other)) return problems.push(`${path}: expected array`);
      if (en.length !== other.length) problems.push(`${path}: length ${other.length}, en has ${en.length}`);
      en.forEach((item, i) => walk(item, other[i], `${path}[${i}]`, problems));
    } else if (isObj(en)) {
      if (!isObj(other)) return problems.push(`${path}: expected object`);
      for (const key of Object.keys(en)) {
        if (!(key in other)) problems.push(`${path}.${key}: missing`);
        else walk(en[key], other[key], `${path}.${key}`, problems);
      }
      for (const key of Object.keys(other)) if (!(key in en)) problems.push(`${path}.${key}: not in en`);
    } else if (typeof en === "string") {
      if (typeof other !== "string" || other.trim() === "") problems.push(`${path}: not a non-empty string`);
    } else problems.push(`${path}: unexpected ${typeof en}`);
  }
  for (const locale of ["ar", "es"]) {
    const problems = [];
    walk(OPS_CONTENT_COPY.en, OPS_CONTENT_COPY[locale], locale, problems);
    assert.deepEqual(problems, []);
  }
});

test("rail labels and Coming soon blocks are separate namespaces, and every rail string is a real string in en, ar and es", () => {
  for (const locale of ["en", "ar", "es"]) {
    const c = OPS_CONTENT_COPY[locale];
    // `rail` holds labels only; `comingSoon` holds blocks only; the two never share a key.
    for (const [key, value] of Object.entries(c.rail)) assert.equal(typeof value, "string", `${locale}.rail.${key}`);
    assert.deepEqual(Object.keys(c.comingSoon).sort(), [...KINDS].sort());
    for (const kind of KINDS) {
      const block = c.comingSoon[kind];
      assert.equal(typeof block, "object", `${locale}.comingSoon.${kind}`);
      assert.equal(typeof block.title, "string");
      assert.equal(typeof block.line, "string");
      assert.ok(Array.isArray(block.list));
    }
    const labels = [
      ...Object.values(DASHBOARD_COPY[locale].rail),
      ...Object.values(c.rail),
      c.soon,
      c.soonNamed.replace("{label}", c.rail.navigation),
    ];
    for (const label of labels) {
      assert.equal(typeof label, "string");
      assert.ok(label.trim().length > 0);
      assert.equal(/\[object|undefined|NaN/.test(label), false, `${locale}: ${label}`);
    }
    assert.ok(c.soonNamed.includes("{label}"), `${locale}.soonNamed needs {label}`);
  }
  // Pages and Blog are the canvas words (DashContent / DashPosts), word for word.
  assert.equal(OPS_CONTENT_COPY.en.comingSoon.pages.title, "Page editing is coming soon");
  assert.equal(OPS_CONTENT_COPY.en.comingSoon.blog.title, "The blog editor is coming soon");
  assert.equal(OPS_CONTENT_COPY.ar.comingSoon.pages.title, "تحرير الصفحات قريبًا");
  assert.equal(OPS_CONTENT_COPY.es.comingSoon.blog.title, "El editor del blog llega pronto");
  assert.equal(OPS_CONTENT_COPY.en.comingSoon.pages.list.length, 6);
  assert.equal(OPS_CONTENT_COPY.en.comingSoon.blog.list.length, 6);
  // Legal and Navigation are two short blocks: no capability list, no legal or policy wording.
  for (const locale of ["en", "ar", "es"]) {
    for (const kind of ["legal", "navigation"]) assert.deepEqual(OPS_CONTENT_COPY[locale].comingSoon[kind].list, []);
  }
});

test("Team starts empty: its list reads the server only, with the empty line and New member; no row is written in", () => {
  const text = readFileSync(TEAM_SCREEN, "utf8");
  assert.match(text, /copy\.empty/);
  assert.match(text, /copy\.newMember/);
  assert.match(text, /opsFetch<ListReply<TeamSummary>>\(PATH\)/);
  assert.equal(/name_en:\s*["']/.test(text), false, "no member is written into the screen");
  // The photo is a Media library pick, not a typed URL.
  assert.match(text, /<MediaField id=\{`\$\{idBase\}-photo`\}/);
});

test("no file input and no SEO field anywhere in the content screens", () => {
  const text = readFileSync(TEAM_SCREEN, "utf8");
  assert.equal(text.includes('type="file"'), false, "no file input");
  assert.equal(/seo/i.test(text), false, "CMS-05 is deferred; no SEO field");
  for (const { path } of PAGES) {
    assert.equal(readFileSync(path, "utf8").includes('type="file"'), false);
  }
  assert.equal(/seo/i.test(readFileSync(COMING_SOON, "utf8")), false, "no SEO field on the Coming soon screen");
  assert.equal(/seo/i.test(readFileSync("lib/copy/ops-content.ts", "utf8")), false, "no SEO field in the Coming soon copy");
});

test("Team's Publish and Unpublish are real: the contract's publish call with entity team_member", () => {
  const text = readFileSync(TEAM_SCREEN, "utf8");
  assert.match(text, /saveThenPublish\(opsSend, PATH, "team_member", payload\.item, publish\)/);
  assert.match(text, /opsSend<PublishResult>\("\/api\/ops\/publish", \{ entity: "team_member", id: open\.form\.id, published: false \}\)/);
});

test("no content row is seeded and no file under content is named seed", () => {
  const offenders = [];
  walk(CONTENT_DIR, offenders);
  assert.deepEqual(offenders, []);
});

function walk(dir, offenders) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      walk(full, offenders);
      continue;
    }
    if (/seed/i.test(entry.name)) offenders.push(full);
  }
}
