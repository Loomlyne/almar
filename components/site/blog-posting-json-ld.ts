// The BlogPosting JSON-LD of one post page (plan 32). A leaf module (no imports) so Node tests load it directly;
// the page passes the canonical absolute URL it already built with absoluteLocaleUrl.
//
// Use in a server component, once per post, after the organisation script:
//   <script {...blogPostingJsonLd(post, url)} />
//
// inLanguage is post.locale: the language the text is in. A post asked for in Arabic with no Arabic translation is
// served the English record (resolveRow), and then post.locale is "en", not the page's locale.
//
// Publisher and author are the organisation's @id, so no Person is ever named. The raw HTML below is safe because
// every "<" in the JSON text is written as \u003c: no post text can close the script element or open a comment.

const ORGANIZATION_ID = "https://almarprivatejourney.com/#organization";

export type BlogPostingInput = {
  /** The language of the text below: "en" for an English fallback, whatever page it is served on. */
  locale: "en" | "ar" | "es";
  title: string;
  seo_title: string | null;
  excerpt: string;
  seo_description: string | null;
  published_at: string;
  cover_image: { url: string } | null;
};

export function blogPostingJsonLdText(post: BlogPostingInput, url: string): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seo_title ?? post.title,
    description: post.seo_description ?? post.excerpt,
    datePublished: post.published_at,
    inLanguage: post.locale,
    mainEntityOfPage: url,
    url,
    publisher: { "@id": ORGANIZATION_ID },
    author: { "@id": ORGANIZATION_ID },
  };
  if (post.cover_image) data.image = post.cover_image.url;
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function blogPostingJsonLd(post: BlogPostingInput, url: string) {
  return {
    id: "almar-blog-posting-schema",
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: blogPostingJsonLdText(post, url) },
  } as const;
}
