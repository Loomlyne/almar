import type { Metadata } from "next";
import { HOME_COPY } from "../../lib/copy/home";
import { ABOUT_PAGE_COPY } from "../../lib/copy/about-page";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getAboutBlocks } from "../../lib/data/about";
import { getPageContent, withPageWords } from "../../lib/data/page-content";
import { getTeam } from "../../lib/data/team";
import {
  absoluteLocaleUrl,
  localeAlternates,
  localeHrefs,
  matchPublicPage,
  siteHref,
  type Locale,
} from "../../lib/locale-path";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { footerPageLinks, pageLinks } from "../site/page-links";
import { PublicFrame } from "../site/public-frame";
import { Divider } from "../ui/divider";
import { PageShell } from "../ui/page-shell";
import { AboutHero, AboutIntro, AboutStill, AboutStory, AboutValues, GetInTouch } from "./about/about-sections";
import { Team } from "./home/home-sections";

/** The English path of this page. localePath turns it into the address in each language. */
const PATH = "/about";

/**
 * /about, /ar/about and /es/about (design 12.1): the Framer page on job 11's parts. Hero, the scroll-tied intro collage,
 * the wide still, Our Story, a divider, Our Values, the team (nothing until a member is published), Get In Touch, and
 * job 11's light footer from the frame. Nothing that cannot work is drawn inside <main>.
 */
export async function AboutPage({ locale }: { locale: Locale }) {
  const [content, blocks, team] = await Promise.all([getPageContent("about", locale), getAboutBlocks(locale), getTeam(locale)]);
  // The headings and intro lines the owner edits in Content -> Pages (plan 06-02); in fixtures mode the copy file's words.
  const copy = withPageWords(ABOUT_PAGE_COPY[locale], "about", content);
  // A section the owner hid is not drawn; the rest keep their order (F-09). The hero is always shown.
  const on = (section: string) => content.shown.has(section);

  const nav = HOME_COPY[locale].nav;
  const links = pageLinks(locale, nav);

  return (
    <PublicFrame
      locale={locale}
      currentPath={siteHref(locale, PATH)}
      localeHrefs={localeHrefs(PATH)}
      links={links}
      footerLinks={footerPageLinks(locale)}
      footerCopy={SITE_FOOTER_COPY[locale]}
      labels={nav}
      navTone="on-image"
    >
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <main id="content">
        <AboutHero kicker={blocks.hero.kicker} headline={blocks.hero.headline} image={blocks.hero.image} videoUrl={content.hero.video_url} />
        {on("intro") ? <AboutIntro statement={blocks.intro.statement} images={blocks.intro.images} /> : null}
        {on("intro") ? <AboutStill image={blocks.intro.still} /> : null}
        {on("story") ? <AboutStory heading={copy.story.heading} intro={copy.story.intro} cards={blocks.story} /> : null}
        {on("story") && on("values") ? (
          <PageShell>
            <Divider />
          </PageShell>
        ) : null}
        {on("values") ? <AboutValues heading={copy.values.heading} intro={copy.values.intro} cards={blocks.values} /> : null}
        {on("team") && team.length > 0 ? (
          <PageShell>
            <Team members={team} copy={copy.team} />
          </PageShell>
        ) : null}
        {on("get_in_touch") ? (
          <GetInTouch
            heading={copy.getInTouch.heading}
            intro={copy.getInTouch.intro}
            cta={copy.getInTouch.cta}
            href={siteHref(locale, "/contact")}
            image={blocks.cta_image}
          />
        ) : null}
      </main>
    </PublicFrame>
  );
}

/**
 * Title, description, og:image (the hero photo), the canonical and, while /about is in PUBLIC_PAGES, the four hreflang links.
 * localeAlternates throws for a path that is not a public page, so it is called only inside the matchPublicPage branch;
 * the other branch (not reachable today) keeps the canonical alone, the same as contactMetadata.
 */
export async function aboutMetadata(locale: Locale): Promise<Metadata> {
  const copy = ABOUT_PAGE_COPY[locale];
  const { hero } = await getAboutBlocks(locale);
  const url = absoluteLocaleUrl(locale, PATH);
  const images = hero.image
    ? [{ url: hero.image.url, width: hero.image.width ?? undefined, height: hero.image.height ?? undefined, alt: hero.image.alt }]
    : undefined;
  return {
    title: copy.meta.title,
    description: copy.meta.description,
    alternates: matchPublicPage(PATH) ? localeAlternates(locale, PATH) : { canonical: url },
    openGraph: {
      type: "website",
      title: copy.meta.title,
      description: copy.meta.description,
      url,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: copy.meta.title,
      description: copy.meta.description,
      images: images?.map(({ url: src, alt }) => ({ url: src, alt })),
    },
  };
}
