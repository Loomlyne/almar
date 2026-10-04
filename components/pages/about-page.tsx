import type { Metadata } from "next";
import { HOME_COPY } from "../../lib/copy/home";
import { ABOUT_PAGE_COPY } from "../../lib/copy/about-page";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getAboutBlocks } from "../../lib/data/about";
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
import { PublicFrame, type PublicFrameLink } from "../site/public-frame";
import { Divider } from "../ui/divider";
import { PageShell } from "../ui/page-shell";
import { AboutHero, AboutIntro, AboutStill, AboutStory, AboutValues, GetInTouch } from "./about/about-sections";
import { Team } from "./home/home-sections";

/** The English path of this page. localePath turns it into the address in each language. */
const PATH = "/about";

/** The four pages the header and footer link to. siteHref keeps a page English-only until it is a public React page. */
const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: PATH },
  { key: "contact", path: "/contact" },
] as const;

/**
 * /about, /ar/about and /es/about (design 12.1): the Framer page on job 11's parts. Hero, the scroll-tied intro collage,
 * the wide still, Our Story, a divider, Our Values, the team (nothing until a member is published), Get In Touch, and
 * job 11's light footer from the frame. Nothing that cannot work is drawn inside <main>.
 */
export async function AboutPage({ locale }: { locale: Locale }) {
  const copy = ABOUT_PAGE_COPY[locale];
  const [blocks, team] = await Promise.all([getAboutBlocks(locale), getTeam(locale)]);

  const nav = HOME_COPY[locale].nav;
  const links: PublicFrameLink[] = PAGE_LINKS.map(({ key, path }) => ({
    label: nav[key],
    href: siteHref(locale, path),
  }));

  return (
    <PublicFrame
      locale={locale}
      currentPath={siteHref(locale, PATH)}
      localeHrefs={localeHrefs(PATH)}
      links={links}
      footerLinks={links}
      footerCopy={SITE_FOOTER_COPY[locale]}
      labels={nav}
      navTone="on-image"
    >
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <main id="content">
        <AboutHero kicker={blocks.hero.kicker} headline={blocks.hero.headline} image={blocks.hero.image} />
        <AboutIntro statement={blocks.intro.statement} images={blocks.intro.images} />
        <AboutStill image={blocks.intro.still} />
        <AboutStory heading={copy.story.heading} intro={copy.story.intro} cards={blocks.story} />
        <PageShell>
          <Divider />
        </PageShell>
        <AboutValues heading={copy.values.heading} intro={copy.values.intro} cards={blocks.values} />
        {team.length > 0 ? (
          <PageShell>
            <Team members={team} copy={copy.team} />
          </PageShell>
        ) : null}
        <GetInTouch
          heading={copy.getInTouch.heading}
          intro={copy.getInTouch.intro}
          cta={copy.getInTouch.cta}
          href={siteHref(locale, "/contact")}
          image={blocks.cta_image}
        />
      </main>
    </PublicFrame>
  );
}

/**
 * Title, description, og:image (the hero photo) and, once /about is in PUBLIC_PAGES, canonical and the four hreflang links.
 * localeAlternates throws for a path that is not a public page, so it is called only inside the matchPublicPage branch:
 * the page builds before plan 25 adds the line and gains its links the moment that line lands, with no edit here.
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
