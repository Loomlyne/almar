import type { Metadata } from "next";
import { PinIcon } from "../icons/icons";
import { DESTINATIONS_PAGE_COPY } from "../../lib/copy/destinations-page";
import { HOME_COPY } from "../../lib/copy/home";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getDestinations, getDestinationsPageHero } from "../../lib/data/destinations";
import { absoluteLocaleUrl, localeAlternates, siteHref, type Locale } from "../../lib/locale-path";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { PublicFrame, type PublicFrameLink } from "../site/public-frame";
import { PortraitCard } from "../ui/card";
import { PageShell } from "../ui/page-shell";
import { Reveal } from "../ui/reveal";
import { Slider } from "../ui/slider";

// /destinations, /ar/destinations and /es/destinations are this one component (plan 03.3-13). Matched to the live Framer page as the
// owner signed it on 2026-10-04: the hero slideshow with the kicker and the h1, no intro sentence, then five photo cards with the
// name on the photo. It builds nothing of its own: Slider layout "hero", PortraitCard and Reveal are job 11's parts.

/** The English path of this page. localePath turns it into the address in each language. */
const PATH = "/destinations";

/** The four pages the header and footer link to. */
const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: "/about" },
  { key: "contact", path: "/contact" },
] as const;

export async function DestinationsPage({ locale }: { locale: Locale }) {
  const copy = DESTINATIONS_PAGE_COPY[locale];
  const [hero, destinations] = await Promise.all([
    getDestinationsPageHero(locale),
    getDestinations(locale, { includeEmpty: true }),
  ]);

  const nav = HOME_COPY[locale].nav;
  const links: PublicFrameLink[] = PAGE_LINKS.map(({ key, path }) => ({
    label: nav[key],
    href: siteHref(locale, path),
  }));

  return (
    <PublicFrame
      locale={locale}
      currentPath={PATH}
      navTone="on-image"
      links={links}
      footerLinks={links}
      footerCopy={SITE_FOOTER_COPY[locale]}
      labels={nav}
    >
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <main id="content">
        <Slider layout="hero" autoplay images={hero.map(({ url, alt }) => ({ src: url, alt }))} labels={copy.slider}>
          <Reveal kind="headline" className="grid justify-items-center gap-4 text-center">
            <p className="m-0 text-label uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal">{copy.kicker}</p>
            <h1 className="m-0 max-w-4xl font-display text-hero tracking-display text-ivory text-balance">{copy.heading}</h1>
          </Reveal>
        </Slider>
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
