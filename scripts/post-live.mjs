// scripts/post-live.mjs
//
// A leaf (no imports, no import.meta) so that Node tests, the media scripts and the Playwright specs, which load
// helpers through their own CommonJS-style loader, can all import it.
//
// A post is a document only when it is published and its date has come: the rule of lib/data/posts.ts (isLive).
// tests/media-guard.test.mjs holds the two equal. Every enumerator of post pages uses this one: scripts/media-lib.mjs
// (readPostSlugs), tests/helpers/site-links.mjs (reactPublicRoutes) and tests/build/locale-routing.spec.ts.

/** @param {{ is_published: boolean, published_at: string }} row @param {Date} [now] */
export function isLivePost(row, now = new Date()) {
  return row.is_published === true && new Date(row.published_at).getTime() <= now.getTime();
}
