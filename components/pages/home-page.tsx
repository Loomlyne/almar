import type { Metadata } from "next";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { pageLinks } from "../site/page-links";
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
import { toCatalogQuery } from "../../lib/data/catalog-filter";
import { getCatalogItems } from "../../lib/data/experiences";
import { getDestinations } from "../../lib/data/destinations";
import { getHomeBlocks, getJourneyTiers } from "../../lib/data/home";
import { getPageContent, withPageWords } from "../../lib/data/page-content";
import { getRates } from "../../lib/data/rates";
import { getStays } from "../../lib/data/stays";
import { getTeam } from "../../lib/data/team";
import type { Locale } from "../../lib/data/types";
import { HOME_COPY } from "../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../lib/copy/home-page";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getSiteLegalChrome } from "../../lib/data/legal";
import { absoluteLocaleUrl, localeAlternates, localePath, siteHref } from "../../lib/locale-path";

// The React home: / , /ar/ and /es/ are this one component (design 5.1). Each route file binds its locale
// and nothing else. Every string and picture comes from lib/data or lib/copy/home-page.ts; every address is
// built here, once, and passed down as plain props. The eleven sections keep the live page's order:
// Hero, Welcome, Gallery, Private Stays, Services & Experiences, Curated Experiences, Choose Your Journey,
// ALMAR Stories, Begin Your Journey, Meet the Team, Footer (the footer belongs to the frame).

const HOME = "/";

// The three services the signed home shows (slice 1, owner-signed); chosen by slug, not position — S2-2.
export const HOME_SERVICE_SLUGS = ["24-7-private-concierge", "luxury-ground-transport", "vip-airport-meet-greet"] as const;

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
  const [content, blocks, tiers, stays, allServices, destinations, team, rates] = await Promise.all([
    getPageContent("home", locale),
    getHomeBlocks(locale),
    getJourneyTiers(locale),
    getStays(locale),
    getCatalogItems(locale, { kind: "service" }),
    getDestinations(locale),
    getTeam(locale),
    getRates(),
  ]);
  const services = HOME_SERVICE_SLUGS.map((slug) => {
    const item = allServices.find((s) => s.slug === slug);
    if (!item) throw new Error(`home: no published service ${slug}`);
    return item;
  });
  // The section words the owner edits in Content -> Pages (plan 06-02); in fixtures mode the copy file's own words.
  const copy = withPageWords(HOME_PAGE_COPY[locale], "home", content);
  const nav = HOME_COPY[locale].nav;
  // A section the owner hid is not drawn; the others keep the code's order (SITE-02). The hero (booking bar) is always on.
  const on = (section: string) => content.shown.has(section);

  // Every public page exists in EN/AR/ES; siteHref returns its address in this locale (a path that is not a
  // public page comes back unchanged).
  // The header links the owner set in Content -> Navigation and footer (plan 06-02), baked at build.
  const links = pageLinks(locale, nav);
  const contactHref = siteHref(locale, "/contact");
  // Services live on the one /experiences page (design 4.2): the card opens that service's overlay, View All
  // selects Services. The query goes after localePath, which refuses a "?".
  const experiencesPath = localePath(locale, "/experiences");

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
            legal={await getSiteLegalChrome(locale)}
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
              {on("welcome") ? <HomeWelcome welcome={blocks.welcome} /> : null}
              {on("gallery") ? <HomeGallery gallery={blocks.gallery} labels={copy.gallery} /> : null}
              {on("stays") ? (
                <PageShell>
                  <HomeStays stays={stayCards} listHref={listHref} copy={copy.stays} />
                </PageShell>
              ) : null}
              <PageShell className="grid">
                {on("services") ? (
                  <Services
                    items={services}
                    hrefs={Object.fromEntries(
                      services.map((item) => [
                        item.slug,
                        experiencesPath + toCatalogQuery({ kind: "service", destinations: [], stays: [], item: item.slug }),
                      ]),
                    )}
                    viewAllHref={experiencesPath + toCatalogQuery({ kind: "service", destinations: [], stays: [] })}
                    copy={copy.services}
                  />
                ) : null}
                {on("moments") ? <Moments destinations={destinations} contactHref={contactHref} copy={copy.moments} /> : null}
                {on("journeys") ? (
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
                ) : null}
                {on("stories") ? (
                  <Stories
                    stories={blocks.stories}
                    hrefs={Object.fromEntries(blocks.stories.map((story) => [story.slug, siteHref(locale, `/blog/${story.slug}`)]))}
                    readAllHref={siteHref(locale, "/blog")}
                    copy={copy.stories}
                  />
                ) : null}
              </PageShell>
              {on("begin") ? <Begin contactHref={contactHref} copy={copy.begin} media={blocks.begin} /> : null}
              {on("team") ? (
                <PageShell>
                  <Team members={team} copy={copy.team} />
                </PageShell>
              ) : null}
            </main>
          </HomeFrame>
        </JourneyChoiceProvider>
      </CurrencyChoiceProvider>
    </>
  );
}
