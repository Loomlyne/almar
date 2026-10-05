// The origin rule for the URLs in a JSON-LD block (tests/build/assembled-site.test.mjs, tests/json-ld-urls.test.mjs).
//
// Every http(s) URL in a block starts with the site origin, with one exception: a BlogPosting's `image` (the post
// cover) is on the media host. The exception is read from the key path, not from the URL: it applies only when the
// object that holds the key has "@type": "BlogPosting" and the key is "image". An Organization (or anything else) with
// a media-host URL, or any other key of a BlogPosting, fails. An array keeps the key of the property that holds it.

/** Every http(s) URL string in `value` with the key that holds it and the object that holds the key. "@context" is skipped. */
export function jsonLdUrls(value, parent = null, key = null, out = []) {
  if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) out.push({ url: value, parent, key });
  } else if (Array.isArray(value)) {
    for (const item of value) jsonLdUrls(item, parent, key, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) if (k !== "@context") jsonLdUrls(v, value, k, out);
  }
  return out;
}

/** The URLs of one parsed block that break the rule, as "key: url" (empty when the block is clean). */
export function jsonLdUrlViolations(json, siteOrigin, mediaBase) {
  return jsonLdUrls(json)
    .filter(({ url, parent, key }) => {
      if (url.startsWith(`${siteOrigin}/`)) return false;
      const postCover = parent?.["@type"] === "BlogPosting" && key === "image";
      return !(postCover && url.startsWith(`${mediaBase}/`));
    })
    .map(({ url, key }) => `${key ?? "(root)"}: ${url}`);
}
