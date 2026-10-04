import type { Metadata } from "next";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { PageShell } from "../ui/page-shell";
import { HomeFrame } from "./home/home-nav";
import { CurrencyChoiceProvider } from "./home/currency-choice";
import { JourneyChoiceProvider } from "./home/journey-choice";
import { HomeHero } from "./home/home-hero";
import { HomeStays, type HomeStayCard } from "./home/home-stays";
import { HomeJourneys } from "./home/home-journeys";
import { HomeWelcome } from "./home/home-welcome";
import { HomeGallery } from "./home/home-gallery";
import { Begin, Moments, Services, Stories, Team } from "./home/home-sections";
import { getCatalogItems } from "../../lib/data/experiences";
import { getDestinations } from "../../lib/data/destinations";
import { getHomeBlocks, getJourneyTiers } from "../../lib/data/home";
import { getRates } from "../../lib/data/rates";
import { getStays } from "../../lib/data/stays";
import { getTeam } from "../../lib/data/team";
import type { Locale } from "../../lib/data/types";
import { HOME_COPY } from "../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../lib/copy/home-page";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { absoluteLocaleUrl, localeAlternates, localePath, siteHref } from "../../lib/locale-path";

// The React home: / , /ar/ and /es/ are this one component (design 5.1). Each route file binds its locale
// and nothing else. Every string and picture comes from lib/data or lib/copy/home-page.ts; every address is
// built here, once, and passed down as plain props. The eleven sections keep the live page's order:
// Hero, Welcome, Gallery, Private Stays, Services & Experiences, Curated Experiences, Choose Your Journey,
// ALMAR Stories, Begin Your Journey, Meet the Team, Footer (the footer belongs to the frame).

const HOME = "/";

export async function homeMetadata(locale: Locale): Promise<Metadata> {
  const { meta } = HOME_PAGE_COPY[locale];
  const { hero } = await getHomeBlocks(locale);
  const url = absoluteLocaleUrl(locale, HOME);
  return {
    title: meta.title,
    description: meta.description,
    alternates: localeAlternates(locale, HOME),
    openGraph: {
      type: "website",
      title: meta.title,
      description: meta.description,
      url,
      images: hero.poster
        ? [{ url: hero.poster.url, width: hero.poster.width ?? undefined, height: hero.poster.height ?? undefined, alt: hero.poster.alt }]
        : undefined,
    },
  };
}

export async function HomePage({ locale }: { locale: Locale }) {
  const [blocks, tiers, stays, services, destinations, team, rates] = await Promise.all([
    getHomeBlocks(locale),
    getJourneyTiers(locale),
    getStays(locale),
    getCatalogItems(locale, { kind: "service" }),
    getDestinations(locale),
    getTeam(locale),
    getRates(),
  ]);
  const copy = HOME_PAGE_COPY[locale];
  const nav = HOME_COPY[locale].nav;

  // Pages that exist in every locale go through localePath; the Framer pages that stay English-only in this
  // slice keep their one address in every language (siteHref returns them unchanged).
  const links = [
    { label: nav.destinations, href: siteHref(locale, "/destinations") },
    { label: nav.experiences, href: siteHref(locale, "/experiences") },
    { label: nav.about, href: siteHref(locale, "/about") },
    { label: nav.contact, href: siteHref(locale, "/contact") },
  ];
  const contactHref = siteHref(locale, "/contact");

  // The first three published stays with a photo, fixed: the hero bar does not filter them (Search does that on the list page).
  const stayCards: HomeStayCard[] = stays
    .flatMap((stay) =>
      stay.hero_image
        ? [
            {
              slug: stay.slug,
              title: stay.title,
              href: localePath(locale, `/private-stays/${stay.slug}`),
              image: { src: stay.hero_image.url, alt: stay.hero_image.alt },
              beds: stay.beds_label,
              guests: stay.guests_label,
            },
          ]
        : [],
    )
    .slice(0, 3);
  const listHref = localePath(locale, "/private-stays");

  const barDestinations = destinations.map((destination) => ({
    id: destination.id,
    name: destination.name,
    shortLine: destination.short_line ?? destination.region ?? "",
  }));
  const destinationSlugById = Object.fromEntries(destinations.map((destination) => [destination.id, destination.slug]));

  return (
    <>
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <CurrencyChoiceProvider>
        <JourneyChoiceProvider destinationSlugById={destinationSlugById}>
          <HomeFrame
            locale={locale}
            links={links}
            labels={{ ...nav, currencyNone: nav.currency }}
            footerCopy={SITE_FOOTER_COPY[locale]}
            currencyEnabled={rates !== null}
          >
            <main id="content">
              <HomeHero
                headline={blocks.hero.headline}
                poster={
                  blocks.hero.poster
                    ? {
                        src: blocks.hero.poster.url,
                        alt: blocks.hero.poster.alt,
                        width: blocks.hero.poster.width,
                        height: blocks.hero.poster.height,
                      }
                    : null
                }
                videoUrl={blocks.hero.video_url}
                destinations={barDestinations}
                destinationSlugById={destinationSlugById}
                listHref={listHref}
                journeyCopy={JOURNEY_COPY[locale]}
                locale={locale}
                barLabel={copy.hero.barLabel}
              />
              <HomeWelcome welcome={blocks.welcome} />
              <HomeGallery gallery={blocks.gallery} labels={copy.gallery} />
              <PageShell>
                <HomeStays stays={stayCards} listHref={listHref} copy={copy.stays} />
              </PageShell>
              <PageShell className="grid">
                <Services
                  items={services}
                  hrefs={Object.fromEntries(services.map((item) => [item.slug, siteHref(locale, `/services/${item.slug}`)]))}
                  viewAllHref={siteHref(locale, "/experiences")}
                  copy={copy.services}
                />
                <Moments destinations={destinations} contactHref={contactHref} copy={copy.moments} />
                <HomeJourneys
                  tiers={tiers.map((tier) => ({
                    slug: tier.slug,
                    name: tier.name,
                    price_label: tier.price_label,
                    tagline: tier.tagline,
                    duration_label: tier.duration_label,
                    ideal_for_label: tier.ideal_for_label,
                    ideal_for: tier.ideal_for,
                    body: tier.body,
                    is_featured: tier.is_featured,
                    image: tier.image
                      ? { src: tier.image.url, alt: tier.image.alt, width: tier.image.width, height: tier.image.height }
                      : null,
                  }))}
                  rates={rates}
                  copy={copy.journeys}
                  locale={locale}
                />
                <Stories
                  stories={blocks.stories}
                  hrefs={Object.fromEntries(blocks.stories.map((story) => [story.slug, siteHref(locale, `/blog/${story.slug}`)]))}
                  readAllHref={siteHref(locale, "/blog")}
                  copy={copy.stories}
                />
              </PageShell>
              <Begin contactHref={contactHref} copy={copy.begin} media={blocks.begin} />
              <PageShell>
                <Team members={team} copy={copy.team} />
              </PageShell>
            </main>
          </HomeFrame>
        </JourneyChoiceProvider>
      </CurrencyChoiceProvider>
    </>
  );
}
