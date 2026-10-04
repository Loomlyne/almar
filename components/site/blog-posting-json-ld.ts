// The BlogPosting JSON-LD of one post page (plan 32). A leaf module (no imports) so Node tests load it directly;
// the page passes the canonical absolute URL it already built with absoluteLocaleUrl.
//
// Use in a server component, once per post, after the organisation script:
//   <script {...blogPostingJsonLd(post, locale, url)} />
//
// Publisher and author are the organisation's @id, so no Person is ever named. The raw HTML below is safe because
// every "<" in the JSON text is written as \u003c: no post text can close the script element or open a comment.

const ORGANIZATION_ID = "https://almarprivatejourney.com/#organization";

export type BlogPostingInput = {
  title: string;
  seo_title: string | null;
  excerpt: string;
  seo_description: string | null;
  published_at: string;
  cover_image: { url: string } | null;
};

export function blogPostingJsonLdText(post: BlogPostingInput, locale: "en" | "ar" | "es", url: string): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seo_title ?? post.title,
    description: post.seo_description ?? post.excerpt,
    datePublished: post.published_at,
    inLanguage: locale,
    mainEntityOfPage: url,
    url,
    publisher: { "@id": ORGANIZATION_ID },
    author: { "@id": ORGANIZATION_ID },
  };
  if (post.cover_image) data.image = post.cover_image.url;
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function blogPostingJsonLd(post: BlogPostingInput, locale: "en" | "ar" | "es", url: string) {
  return {
    id: "almar-blog-posting-schema",
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: blogPostingJsonLdText(post, locale, url) },
  } as const;
}
