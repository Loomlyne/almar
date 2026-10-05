import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

// Every post has a cover. The list, the post page, the sitemap, the home stories and the media guard all keep a
// post, so a post without a cover must stop the build at the data door instead of vanishing from one page only.
// The fixtures are read from process.cwd() and cached per loaded module, so each case runs on a scratch copy of them
// with a freshly loaded data module.

const REPO = process.cwd();
const FIXTURES = join(REPO, "lib", "data", "fixtures");

function scratchRoot(mutate) {
  const root = mkdtempSync(join(tmpdir(), "almar-post-cover-"));
  const dir = join(root, "lib", "data", "fixtures");
  mkdirSync(dir, { recursive: true });
  cpSync(FIXTURES, dir, { recursive: true });
  const rows = JSON.parse(readFileSync(join(FIXTURES, "posts.json"), "utf8"));
  mutate(rows);
  writeFileSync(join(dir, "posts.json"), JSON.stringify(rows, null, 2));
  return root;
}

async function inRoot(root, run) {
  const posts = await loadTs("lib/data/posts.ts"); // bundled from the repo, before the move
  process.chdir(root);
  try {
    return await run(posts);
  } finally {
    process.chdir(REPO);
  }
}

test("a post whose cover is null fails loudly in getPosts, getPost, getRelatedPosts, naming the post", async () => {
  let victim = "";
  let other = "";
  const root = scratchRoot((rows) => {
    other = rows[0].slug;
    victim = rows[1].slug;
    rows[1].cover_image = null;
  });
  await inRoot(root, async (posts) => {
    for (const locale of ["en", "ar", "es"]) {
      await assert.rejects(posts.getPosts(locale), (error) => error.message.includes(victim) && /cover/i.test(error.message));
      await assert.rejects(posts.getPost(locale, victim), /cover/i);
      // The post asked about is fine, but its related list reads the one without a cover.
      await assert.rejects(posts.getRelatedPosts(locale, other), /cover/i);
    }
  });
});

test("the same fixtures with every cover present: all three posts resolve, each with a cover", async () => {
  const root = scratchRoot(() => {});
  await inRoot(root, async (posts) => {
    const list = await posts.getPosts("en");
    assert.equal(list.length, 3);
    for (const post of list) {
      assert.equal(typeof post.cover_image.url, "string", post.slug);
      assert.ok(post.cover_image.alt.length > 0, post.slug);
    }
  });
});
