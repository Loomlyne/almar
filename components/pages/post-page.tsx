import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PostHero } from "./blog/post-hero";
import { PostShare } from "./blog/share";
import { blogFrameLinks } from "./blog/frame-links";
import { JourneyChoiceProvider } from "./home/journey-choice";
import { blogPostingJsonLd } from "../site/blog-posting-json-ld";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { PublicFrame } from "../site/public-frame";
import { LinkButton } from "../ui/button";
import { PortraitCard } from "../ui/card";
import { Divider } from "../ui/divider";
import { Link } from "../ui/link";
import { OnThisPage } from "../ui/on-this-page";
import { PageShell } from "../ui/page-shell";
import { Reveal } from "../ui/reveal";
import { RichText } from "../ui/rich-text";
import { BLOG_COPY } from "../../lib/copy/blog";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getDestinations } from "../../lib/data/destinations";
import { getCatalogItem } from "../../lib/data/experiences";
import { getPost, getPostSlugs, getRelatedPosts } from "../../lib/data/posts";
import { getStay } from "../../lib/data/stays";
import { formatPlural } from "../../lib/journey-format";
import { absoluteLocaleUrl, localeAlternates, localePath, siteHref, type Locale } from "../../lib/locale-path";

// The post template (design 13, owner's v4): /blog/<slug> in three languages, one component; each route file binds a
// locale and a slug. A server component: the client parts are the hero (planner), the share control and the journey
// provider. Held and absent: Continue, Add, cart, Login, any form or newsletter. The hero's Search is live.

/** The published slugs, for each route's generateStaticParams. */
export async function generatePostParams(): Promise<Array<{ post: string }>> {
  return (await getPostSlugs()).map((post) => ({ post }));
}

export async function postMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const post = await getPost(locale, slug);
  if (!post) return {};
  const path = `/blog/${slug}`;
  const title = `${post.seo_title ?? post.title} | ALMAR`;
  const description = post.seo_description ?? post.excerpt;
  const cover = post.cover_image;
  const images = cover
    ? [{ url: cover.url, width: cover.width ?? undefined, height: cover.height ?? undefined, alt: cover.alt }]
    : undefined;
  return {
    title,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      type: "article",
      siteName: "ALMAR Private Journeys",
      title,
      description,
      url: absoluteLocaleUrl(locale, path),
      publishedTime: post.published_at,
      images,
    },
    twitter: { card: "summary_large_image", title, description, images: cover ? [cover.url] : undefined },
  };
}

/** A centred head: 12px kicker, a short gold rule, the display heading (Framer's section head, v4). */
function CentredHead({ kicker, heading }: { kicker: string; heading: string }) {
  return (
    <Reveal kind="heading" className="grid justify-items-center gap-4 text-center">
      <p className="m-0 text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{kicker}</p>
      <Divider className="w-12" />
      <h2 className="m-0 font-display text-display text-teal">{heading}</h2>
    </Reveal>
  );
}

function CardRow({ children }: { children: ReactNode }) {
  return (
    <Reveal kind="row">
      <ul className="m-0 mx-auto grid max-w-sm list-none grid-cols-1 justify-center gap-6 p-0 md:max-w-lg md:grid-cols-2">
        {children}
      </ul>
    </Reveal>
  );
}

export async function PostPage({ locale, slug }: { locale: Locale; slug: string }) {
  const post = await getPost(locale, slug);
  if (!post) notFound();
  const copy = BLOG_COPY[locale].post;

  const [related, destinations, stay, experience] = await Promise.all([
    getRelatedPosts(locale, slug, { limit: 2 }),
    getDestinations(locale),
    post.featured_stay_slug ? getStay(locale, post.featured_stay_slug) : Promise.resolve(null),
    post.featured_experience_slug ? getCatalogItem(locale, post.featured_experience_slug) : Promise.resolve(null),
  ]);

  const { nav, links } = blogFrameLinks(locale);
  const barDestinations = destinations.map((destination) => ({
    id: destination.id,
    name: destination.name,
    shortLine: destination.short_line ?? destination.region ?? "",
  }));
  const destinationSlugById = Object.fromEntries(destinations.map((destination) => [destination.id, destination.slug]));

  const url = absoluteLocaleUrl(locale, `/blog/${slug}`);
  const cover = post.cover_image ? { src: post.cover_image.url, alt: post.cover_image.alt } : null;
  const headings = post.body.flatMap((block) => (block.type === "heading" ? [{ id: block.id, text: block.text }] : []));
  // One paragraph reads as a lead and is centred; from the second block on the body is start-aligned.
  const lead = post.body.length === 1 && post.body[0].type === "paragraph";
  const fallback = post.translation_status === "fallback";

  const stayCard =
    stay && stay.hero_image ? (
      <li className="min-w-0">
        <PortraitCard
          href={localePath(locale, `/private-stays/${stay.slug}`)}
          image={{ src: stay.hero_image.url, alt: stay.hero_image.alt }}
          title={stay.title}
          kicker={copy.featuredStay}
        />
      </li>
    ) : null;
  // No href: the experience has no detail page and no deep link exists (D-67).
  const experienceCard =
    experience && experience.image ? (
      <li className="min-w-0">
        <PortraitCard
          image={{ src: experience.image.url, alt: experience.image.alt }}
          title={experience.name}
          kicker={copy.featuredExperience}
        />
      </li>
    ) : null;
  const relatedCards = related.filter((item) => item.cover_image);

  const article = (
    <article
      {...(fallback ? { lang: "en", dir: "ltr" } : {})}
      className="mx-auto grid w-full max-w-180 justify-items-center gap-8 text-center"
    >
      {headings.length >= 2 ? (
        <OnThisPage label={copy.onThisPage} items={headings} className="w-full text-start" />
      ) : null}
      <RichText blocks={post.body} className={lead ? "justify-items-center text-center" : "w-full justify-items-start text-start"} />
    </article>
  );

  return (
    <>
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <script {...blogPostingJsonLd(post, locale, url)} />
      <JourneyChoiceProvider destinationSlugById={destinationSlugById} initialDestinationId={post.destination_id}>
        <PublicFrame
          locale={locale}
          currentPath={`/blog/${slug}`}
          links={links}
          footerLinks={links}
          footerCopy={SITE_FOOTER_COPY[locale]}
          labels={nav}
          navTone="on-image"
        >
          <main id="content">
            <PostHero
              kicker={copy.kicker}
              title={post.title}
              date={post.date_label}
              readingTime={formatPlural(copy.readingTime, post.reading_minutes, locale)}
              tag={post.destination_name}
              cover={cover}
              intro={copy.intro}
              destinations={barDestinations}
              destinationSlugById={destinationSlugById}
              listHref={localePath(locale, "/private-stays")}
              journeyCopy={JOURNEY_COPY[locale]}
              locale={locale}
              barLabel={copy.barLabel}
            />
            <PageShell className="grid justify-items-center gap-8 py-16 md:py-section">
              {fallback ? <p className="m-0 text-label text-muted">{copy.englishOnly}</p> : null}
              {article}
              <div className="grid justify-items-center gap-6 text-center">
                <LinkButton href={siteHref(locale, "/contact")} size="lg">
                  {copy.cta}
                </LinkButton>
                <nav aria-label={copy.links.back} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                  <Link href={localePath(locale, "/blog")} inline>
                    {copy.links.back}
                  </Link>
                  <Link href={localePath(locale, "/")} inline>
                    {copy.links.home}
                  </Link>
                  <Link href={siteHref(locale, "/destinations")} inline>
                    {copy.links.destinations}
                  </Link>
                </nav>
                <PostShare
                  url={url}
                  label={copy.share}
                  labels={{ copy: copy.copyLink, copied: copy.copied, failed: copy.copyFailed }}
                />
              </div>
            </PageShell>
            {stayCard || experienceCard ? (
              <PageShell className="grid gap-12 pb-16 md:pb-section">
                <CentredHead kicker={copy.pairKicker} heading={copy.pairHeading} />
                <CardRow>
                  {stayCard}
                  {experienceCard}
                </CardRow>
              </PageShell>
            ) : null}
            {relatedCards.length > 0 ? (
              <PageShell className="grid gap-12 pb-16 md:pb-section">
                <CentredHead kicker={copy.relatedKicker} heading={copy.related} />
                <CardRow>
                  {relatedCards.map((item) => (
                    <li key={item.slug} className="min-w-0">
                      <PortraitCard
                        href={localePath(locale, `/blog/${item.slug}`)}
                        image={{ src: item.cover_image!.url, alt: item.cover_image!.alt }}
                        title={item.title}
                        kicker={item.date_label}
                      />
                    </li>
                  ))}
                </CardRow>
              </PageShell>
            ) : null}
          </main>
        </PublicFrame>
      </JourneyChoiceProvider>
    </>
  );
}
