// lib/data/media.ts
//
// The ONLY file in the repo that knows the image host (design 10.1). Fixtures and, later, Supabase rows
// store a media key such as "stays/getsemani-colonial-house/gallery-1.webp", never a URL. The data layer
// turns a key into ImageRef.url with mediaUrl(); components only ever see `url`.
//
// The controller owns the real value of the two constants below. The bucket and its public hostname are the
// owner's gate (Cloudflare R2), so until the controller supplies the hostname the base is the reserved
// ".invalid" name, which can never resolve (RFC 2606). MEDIA_BASE_URL_IS_PLACEHOLDER = true makes the
// assemble script refuse a preview or production build. Both constants change in one commit.

export const MEDIA_BASE_URL = "https://media-pending.invalid";
export const MEDIA_BASE_URL_IS_PLACEHOLDER = true;

/** Joins a media key onto the media base URL. Rejects anything that is not a plain relative key. */
export function mediaUrl(key: string): string {
  if (
    typeof key !== "string" ||
    key.length === 0 ||
    key.includes("://") ||
    key.includes("..") ||
    key.startsWith("/") ||
    key.includes("\\")
  ) {
    throw new Error(`mediaUrl: refusing media key ${JSON.stringify(key)}`);
  }
  return `${MEDIA_BASE_URL}/${key}`;
}
