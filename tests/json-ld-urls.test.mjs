import assert from "node:assert/strict";
import test from "node:test";
import { jsonLdUrlViolations } from "./helpers/json-ld-urls.mjs";

// The origin guard of tests/build/assembled-site.test.mjs: every URL in a JSON-LD block is on the real domain,
// except one place: a BlogPosting's `image` (the post cover), which is on the media host.

const SITE = "https://almarprivatejourney.com";
const MEDIA = "https://media.almarprivatejourney.com";
const check = (json) => jsonLdUrlViolations(json, SITE, MEDIA);

const organization = {
  "@context": "https://schema.org",
  "@type": ["Organization", "TravelAgency"],
  "@id": `${SITE}/#organization`,
  url: `${SITE}/`,
  logo: `${SITE}/brand/logo.svg`,
  sameAs: [`${SITE}/about`],
};
const blogPosting = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  url: `${SITE}/blog/a`,
  mainEntityOfPage: `${SITE}/blog/a`,
  image: `${MEDIA}/blog/a/cover.webp`,
  publisher: { "@id": `${SITE}/#organization` },
};

test("an Organization and a BlogPosting with its cover on the media host pass", () => {
  assert.deepEqual(check(organization), []);
  assert.deepEqual(check(blogPosting), []);
  assert.deepEqual(check([organization, blogPosting]), []);
});

test("an Organization URL on the media host fails, in any key", () => {
  assert.equal(check({ ...organization, url: `${MEDIA}/` }).length, 1);
  assert.equal(check({ ...organization, logo: `${MEDIA}/logo.svg` }).length, 1);
  assert.equal(check({ ...organization, image: `${MEDIA}/cover.webp` }).length, 1);
  assert.equal(check({ ...organization, sameAs: [`${MEDIA}/x`] }).length, 1);
});

test("on a BlogPosting only `image` may use the media host: url, mainEntityOfPage and nested objects may not", () => {
  assert.equal(check({ ...blogPosting, url: `${MEDIA}/blog/a` }).length, 1);
  assert.equal(check({ ...blogPosting, mainEntityOfPage: `${MEDIA}/blog/a` }).length, 1);
  assert.equal(check({ ...blogPosting, publisher: { url: `${MEDIA}/` } }).length, 1);
  assert.equal(check({ ...blogPosting, author: { "@type": "Organization", image: `${MEDIA}/x.webp` } }).length, 1);
  assert.equal(check({ ...blogPosting, image: { "@type": "ImageObject", url: `${MEDIA}/c.webp` } }).length, 1);
});

test("a BlogPosting image may not be on a third host or look like the media host", () => {
  assert.equal(check({ ...blogPosting, image: "https://files.catbox.moe/c.webp" }).length, 1);
  assert.equal(check({ ...blogPosting, image: `${MEDIA}.evil.test/c.webp` }).length, 1);
  assert.equal(check({ ...blogPosting, image: `${SITE}.evil.test/c.webp` }).length, 1);
});

test("an image array on a BlogPosting is checked element by element", () => {
  assert.deepEqual(check({ ...blogPosting, image: [`${MEDIA}/a.webp`, `${MEDIA}/b.webp`] }), []);
  assert.equal(check({ ...blogPosting, image: [`${MEDIA}/a.webp`, "https://elsewhere.test/b.webp"] }).length, 1);
});

test("@type must be exactly BlogPosting for the allowance; a list or another type does not get it", () => {
  assert.equal(check({ ...blogPosting, "@type": ["BlogPosting"] }).length, 1);
  assert.equal(check({ ...blogPosting, "@type": "Article" }).length, 1);
  const { "@type": _type, ...untyped } = blogPosting;
  assert.equal(check(untyped).length, 1);
});

test("@context is not a page and is skipped; non-URL strings are ignored", () => {
  assert.deepEqual(check({ "@context": "https://schema.org", name: "ALMAR", telephone: "+971 56 388 3302" }), []);
});

test("a violation names the key and the URL", () => {
  assert.deepEqual(check({ ...organization, logo: `${MEDIA}/l.svg` }), [`logo: ${MEDIA}/l.svg`]);
});
