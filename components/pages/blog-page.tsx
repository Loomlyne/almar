import type { Metadata } from "next";
import { PublicFrame } from "../site/public-frame";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { MediaCard } from "../ui/card";
import { PageShell } from "../ui/page-shell";
import { SectionHead } from "../ui/section";
import { blogFrameLinks } from "./blog/frame-links";
import { BLOG_COPY } from "../../lib/copy/blog";
import { HOME_PAGE_COPY } from "../../lib/copy/home-page";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getPosts } from "../../lib/data/posts";
import { absoluteLocaleUrl, localeAlternates, localePath, type Locale } from "../../lib/locale-path";

/** The English path of this page. localePath turns it into the address in each language. */
const PATH = "/blog";

/** The blog list (design 1, board 5j): every published post, newest first, as the home's Stories card. No filter, no paging. */
export async function BlogPage({ locale }: { locale: Locale }) {
  const copy = BLOG_COPY[locale].list;
  const posts = await getPosts(locale);
  const { nav, links } = blogFrameLinks(locale);

  return (
    <PublicFrame
      locale={locale}
      currentPath={PATH}
      links={links}
      footerLinks={links}
      footerCopy={SITE_FOOTER_COPY[locale]}
      labels={nav}
    >
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <main id="content">
        <PageShell className="grid gap-12 pb-16 pt-12">
          <SectionHead
            kicker={copy.kicker}
            heading={copy.heading}
            headingLevel={1}
            headingSize="display"
            intro={HOME_PAGE_COPY[locale].stories.intro}
          />
          {posts.length === 0 ? (
            <p className="m-0 text-body text-ink">{copy.empty}</p>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
              {posts.map((post) => (
                <li key={post.slug} className="min-w-0">
                  <MediaCard
                    href={localePath(locale, `${PATH}/${post.slug}`)}
                    image={{ src: post.cover_image.url, alt: post.cover_image.alt }}
                    title={post.title}
                    titleSize="title"
                    ratio={2 / 3}
                    zoom="sm"
                    detail={
                      <>
                        <span className="block text-caption">{post.date_label}</span>
                        {post.excerpt ? <span className="mt-2 block">{post.excerpt}</span> : null}
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </PageShell>
      </main>
    </PublicFrame>
  );
}

/** Title, description, canonical, the four hreflang links, og:image (the newest post's cover). */
export async function blogMetadata(locale: Locale): Promise<Metadata> {
  const { meta } = BLOG_COPY[locale].list;
  const newest = (await getPosts(locale, { limit: 1 }))[0]?.cover_image ?? null; // none only while there is no post
  const images = newest ? [{ url: newest.url, alt: newest.alt }] : undefined;
  return {
    title: meta.title,
    description: meta.description,
    alternates: localeAlternates(locale, PATH),
    openGraph: { type: "website", title: meta.title, description: meta.description, url: absoluteLocaleUrl(locale, PATH), images },
    twitter: { card: "summary_large_image", title: meta.title, description: meta.description, images },
  };
}
