import assert from "node:assert/strict";
import test from "node:test";
import { blogPostingJsonLd, blogPostingJsonLdText } from "../components/site/blog-posting-json-ld.ts";

const post = {
  locale: "ar",
  title: "A title",
  seo_title: null,
  excerpt: "An excerpt.",
  seo_description: "A description.",
  published_at: "2025-06-01T00:00:00.000Z",
  cover_image: { url: "https://media.example/cover.jpg" },
};
const URL = "https://almarprivatejourney.com/blog/a-title";

test("BlogPosting has the signed shape, with the organisation as publisher and author", () => {
  const data = JSON.parse(blogPostingJsonLdText(post, URL));
  assert.equal(data["@type"], "BlogPosting");
  assert.equal(data.headline, "A title");
  assert.equal(data.description, "A description.");
  assert.equal(data.datePublished, post.published_at);
  assert.equal(data.image, post.cover_image.url);
  assert.equal(data.inLanguage, "ar");
  assert.equal(data.mainEntityOfPage, URL);
  assert.equal(data.url, URL);
  assert.deepEqual(data.publisher, { "@id": "https://almarprivatejourney.com/#organization" });
  assert.deepEqual(data.author, data.publisher);
  assert.equal(blogPostingJsonLdText(post, URL).includes("Person"), false);
});

test("seo_title and a missing cover are honoured", () => {
  const data = JSON.parse(blogPostingJsonLdText({ ...post, seo_title: "SEO", seo_description: null, cover_image: null }, URL));
  assert.equal(data.headline, "SEO");
  assert.equal(data.description, "An excerpt.");
  assert.equal("image" in data, false);
});

test("a title with a closing script tag cannot close the script", () => {
  const text = blogPostingJsonLd({ ...post, title: "x</script><b>" }, URL).dangerouslySetInnerHTML.__html;
  assert.equal(text.includes("</script>"), false);
  assert.equal(text.includes("<"), false);
  assert.ok(text.includes("\\u003c/script>"));
  assert.equal(JSON.parse(text).headline, "x</script><b>");
});

test("inLanguage is the language the text is in, not the page's: an English fallback says en", () => {
  // A page asked for in Arabic whose translation is missing is served the English record (resolveRow: locale "en").
  const fallback = JSON.parse(blogPostingJsonLdText({ ...post, locale: "en" }, URL));
  assert.equal(fallback.inLanguage, "en");
  for (const locale of ["en", "ar", "es"]) {
    assert.equal(JSON.parse(blogPostingJsonLdText({ ...post, locale }, URL)).inLanguage, locale);
  }
});
