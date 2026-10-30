import type { Metadata } from "next";
import { PinIcon } from "../icons/icons";
import { DESTINATIONS_PAGE_COPY } from "../../lib/copy/destinations-page";
import { HOME_COPY } from "../../lib/copy/home";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getSiteLegalChrome } from "../../lib/data/legal";
import { getDestinations, getDestinationsPageHero } from "../../lib/data/destinations";
import { getPageContent, withPageWords } from "../../lib/data/page-content";
import { absoluteLocaleUrl, localeAlternates, type Locale } from "../../lib/locale-path";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { footerPageLinks, pageLinks } from "../site/page-links";
import { PublicFrame } from "../site/public-frame";
import { BackgroundMedia } from "../ui/background-media";
import { PortraitCard } from "../ui/card";
import { PageShell } from "../ui/page-shell";
import { Reveal } from "../ui/reveal";
import { Slider } from "../ui/slider";

// /destinations, /ar/destinations and /es/destinations are this one component (plan 03.3-13). Matched to the live Framer page as the
// owner signed it on 2026-10-04: the hero slideshow with the kicker and the h1, no intro sentence, then five photo cards with the
// name on the photo. It builds nothing of its own: Slider layout "hero", PortraitCard and Reveal are job 11's parts.

/** The English path of this page. localePath turns it into the address in each language. */
const PATH = "/destinations";

export async function DestinationsPage({ locale }: { locale: Locale }) {
  const [content, hero, destinations] = await Promise.all([
    getPageContent("destinations", locale),
    getDestinationsPageHero(locale),
    getDestinations(locale, { includeEmpty: true }),
  ]);
  // The kicker and heading the owner edits in Content -> Pages (plan 06-02); in fixtures mode the copy file's words.
  const copy = withPageWords(DESTINATIONS_PAGE_COPY[locale], "destinations", content);

  const nav = HOME_COPY[locale].nav;
  const links = pageLinks(locale, nav);
  const headline = (
    <Reveal kind="headline" className="grid justify-items-center gap-4 text-center">
      <p className="m-0 text-label uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal">{copy.kicker}</p>
      <h1 className="m-0 max-w-4xl font-display text-hero tracking-display text-ivory text-balance">{copy.heading}</h1>
    </Reveal>
  );
  // With a hero video set (plan 06-02), the video plays over the first slide's photo (the poster), as the home hero
  // draws it; with none, the slideshow is exactly as before.
  const poster = hero[0] ? { src: hero[0].url, alt: hero[0].alt } : null;

  return (
    <PublicFrame
      locale={locale}
      currentPath={PATH}
      navTone="on-image"
      links={links}
      footerLinks={footerPageLinks(locale)}
      footerCopy={SITE_FOOTER_COPY[locale]}
      legal={await getSiteLegalChrome(locale)}
      labels={nav}
    >
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <main id="content">
        {content.hero.video_url ? (
          <section className="relative isolate grid h-160 place-items-center overflow-hidden bg-teal text-ivory md:h-225">
            <BackgroundMedia className="-z-20" poster={poster} videoUrl={content.hero.video_url} />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/35" />
            <PageShell>{headline}</PageShell>
          </section>
        ) : (
          <Slider layout="hero" autoplay images={hero.map(({ url, alt }) => ({ src: url, alt }))} labels={copy.slider}>
            {headline}
          </Slider>
        )}
        <PageShell className="py-16">
          <ul role="list" className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-4 md:gap-8">
            {destinations.map((destination, index) => {
              if (!destination.hero_image) throw new Error(`destinations: ${destination.slug} has no hero image`);
              return (
                <Reveal
                  as="li"
                  kind="row"
                  key={destination.slug}
                  className={index === destinations.length - 1 && destinations.length % 2 === 1 ? "md:col-span-2 md:col-start-2" : "md:col-span-2"}
                >
                  <PortraitCard
                    ratio="square"
                    uppercase
                    image={{ src: destination.hero_image.url, alt: destination.hero_image.alt }}
                    title={destination.name}
                    facts={destination.region ? [{ icon: <PinIcon size={16} />, text: destination.region }] : []}
                  />
                </Reveal>
              );
            })}
          </ul>
        </PageShell>
      </main>
    </PublicFrame>
  );
}

/** Title, description, canonical, the four hreflang links and og:image, all from the copy, the data and the helpers. */
export async function destinationsMetadata(locale: Locale): Promise<Metadata> {
  const copy = DESTINATIONS_PAGE_COPY[locale];
  const hero = (await getDestinationsPageHero(locale))[0] ?? null;
  const images = hero ? [{ url: hero.url, alt: hero.alt }] : undefined;
  return {
    title: copy.meta.title,
    description: copy.meta.description,
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      type: "website",
      title: copy.meta.title,
      description: copy.meta.description,
      url: absoluteLocaleUrl(locale, PATH),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: copy.meta.title,
      description: copy.meta.description,
      images,
    },
  };
}
