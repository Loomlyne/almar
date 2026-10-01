import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const CONTENT_DIR = "app/dashboard/(ops)/content";
const SCREEN = `${CONTENT_DIR}/content-screen.tsx`;

const PAGES = [
  { path: `${CONTENT_DIR}/pages/page.tsx`, kind: "pages" },
  { path: `${CONTENT_DIR}/blog/page.tsx`, kind: "blog" },
  { path: `${CONTENT_DIR}/team/page.tsx`, kind: "team" },
  { path: `${CONTENT_DIR}/legal/page.tsx`, kind: "legal" },
];

test("each content page has no page gate (02-04 owner gate in the layout) and delegates to ContentScreen with its kind", () => {
  for (const { path, kind } of PAGES) {
    const text = readFileSync(path, "utf8");
    assert.equal(text.includes("use client"), false, `${path} must not be a client component`);
    assert.equal(/NODE_ENV|notFound\(\)/.test(text), false);
    assert.match(text, /from ["']\.\.\/content-screen["']/);
    assert.match(text, new RegExp(`kind=["']${kind}["']`));
  }
});

test("the four empty lines and their New actions are wired to dashboard copy", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /copy\.noPagesYet/);
  assert.match(text, /copy\.newPage/);
  assert.match(text, /copy\.noPostsYet/);
  assert.match(text, /copy\.newPost/);
  assert.match(text, /copy\.noTeamMembersYet/);
  assert.match(text, /copy\.newMember/);
  assert.match(text, /copy\.noLegalPagesYet/);
  assert.match(text, /copy\.newLegalPage/);
  assert.match(text, /<tbody\s*\/>/, "content list must not render a sample row");
});

test("team editor has a Photo URL field and rejects a non-https value", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.equal(text.includes("Photo"), true, "missing team field: Photo");
  assert.match(text, /startsWith\(HTTPS_PREFIX\)/);
  assert.match(text, /setPhotoInvalid\(true\)/);
});

test("no file input and no SEO field anywhere in the content screens", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.equal(text.includes('type="file"'), false, "no file input");
  assert.equal(/seo/i.test(text), false, "CMS-05 is deferred; no SEO field");
  for (const { path } of PAGES) {
    assert.equal(readFileSync(path, "utf8").includes('type="file"'), false);
  }
});

test("Publish is a Button that does not publish; Close closes", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /<Button onClick=\{\(\) => undefined\}>\{copy\.publish\}<\/Button>/);
  assert.match(text, /onOpenChange=\{setOpen\}/);
  assert.equal(text.includes("fetch("), false, "Publish must not call a server");
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
