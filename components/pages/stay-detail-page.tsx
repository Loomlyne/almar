// The one private-stay detail template for all 12 stays in EN, AR and ES (phase 3.3 plan 06, design 1.3).
// A server component: every value is read through lib/data and every string through lib/copy. The only client
// parts are the booking island (state for the bar, the sheet and the dock), the page frame and the gallery.
//
// What this page never does (design 3.9, 4.3):
//  - show an amount or a minimum stay: those fields are not read here, and the island never gets a Stay;
//  - render a submit, a Search button, an Add button, a Continue button, a cart, a Login or a newsletter form;
//  - hide a sentence with CSS: text that must not show is not in the data at all.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StayBooking, StayBookingBar, StayBookingDock } from "./stay-detail/booking";
import { StayHero } from "./stay-detail/hero";
import { MediaCard } from "../ui/card";
import { FactList, type Fact } from "../ui/fact-list";
import { Gallery } from "../ui/gallery";
import { Link } from "../ui/link";
import { PageShell } from "../ui/page-shell";
import { Section } from "../ui/section";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { PublicFrame } from "../site/public-frame";
import { getCatalogForStay } from "../../lib/data/experiences";
import { getBlockedDates, getRelatedStays, getStay, getStaySlugs } from "../../lib/data/stays";
import type { CatalogItem, Locale } from "../../lib/data/types";
import { HOME_COPY } from "../../lib/copy/home";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { pickStayJourneyCopy } from "./stay-detail/booking-value";
import { STAY_DETAIL_COPY } from "../../lib/copy/stay-detail";
import { absoluteLocaleUrl, localeAlternates, localePath, siteHref } from "../../lib/locale-path";

const CARD_GRID = "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3";

/** The twelve published slugs, for each route's generateStaticParams. */
export async function generateStayParams(): Promise<Array<{ stay: string }>> {
  return (await getStaySlugs()).map((stay) => ({ stay }));
}

export async function generateStayMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const stay = await getStay(locale, slug);
  if (!stay) return {};
  const copy = STAY_DETAIL_COPY[locale];
  const path = `/private-stays/${slug}`;
  const title = copy.metaTitle.replace("{title}", stay.title);
  const description = copy.metaDescription.replace("{title}", stay.title);
  const hero = stay.hero_image;
  return {
    title,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      type: "website",
      siteName: "ALMAR Private Journeys",
      title,
      description,
      url: absoluteLocaleUrl(locale, path),
      images: hero
        ? [{ url: hero.url, width: hero.width ?? undefined, height: hero.height ?? undefined, alt: hero.alt }]
        : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: hero ? [hero.url] : undefined },
  };
}

function catalogCards(items: CatalogItem[]) {
  return items.flatMap((item) =>
    item.image
      ? [
          <MediaCard
            key={item.slug}
            image={{ src: item.image.url, alt: item.image.alt }}
            title={item.name}
            detail={
              <>
                {item.duration_label ? <span className="block text-ink">{item.duration_label}</span> : null}
                {item.summary}
              </>
            }
          />,
        ]
      : [],
  );
}

export async function StayDetailPage({ locale, slug }: { locale: Locale; slug: string }) {
  const stay = await getStay(locale, slug);
  if (!stay) notFound();

  const [related, blockedDates, catalog] = await Promise.all([
    getRelatedStays(locale, slug, { limit: 3 }),
    getBlockedDates(slug),
    getCatalogForStay(locale, slug),
  ]);

  const copy = STAY_DETAIL_COPY[locale];
  const home = HOME_COPY[locale];
  const pagePath = `/private-stays/${slug}`;

  const navLinks = [
    { label: home.nav.destinations, href: siteHref(locale, "/destinations") },
    { label: home.nav.experiences, href: siteHref(locale, "/experiences") },
    { label: home.nav.about, href: siteHref(locale, "/about") },
    { label: home.nav.contact, href: siteHref(locale, "/contact") },
  ];

  // A fact with no published value is left out: no dash, no placeholder.
  const facts: Fact[] = [
    { label: copy.facts.guests, value: stay.guests_label },
    { label: copy.facts.bedrooms, value: stay.bedrooms === null ? null : String(stay.bedrooms) },
    { label: copy.facts.bathrooms, value: stay.bathrooms_label },
    { label: copy.facts.beds, value: stay.beds_label },
    { label: copy.facts.neighborhood, value: stay.neighborhood },
  ].filter((fact) => fact.value !== null && fact.value !== "");

  const services = catalogCards(catalog.services);
  const experiences = catalogCards(catalog.experiences);

  return (
    <>
      <StayBooking
        locale={locale}
        destinationSlug={stay.destination_slug}
        destinationName={stay.destination_name}
        title={stay.title}
        blockedDates={blockedDates}
        copy={pickStayJourneyCopy(JOURNEY_COPY[locale])}
        sampleNote={stay.sample_fields.includes("blocked_dates") ? copy.sampleDatesNote : null}
      >
        {/* The nav lies over the hero; the WhatsApp float is lifted above the pinned dock. */}
        <PublicFrame
          locale={locale}
          currentPath={pagePath}
          navTone="on-image"
          whatsappClassName="bottom-dock mb-4"
          links={navLinks}
          footerLinks={navLinks}
          labels={{
            destinations: home.nav.destinations,
            experiences: home.nav.experiences,
            about: home.nav.about,
            contact: home.nav.contact,
            language: home.nav.language,
            menu: home.nav.menu,
            close: home.nav.close,
          }}
          footerCopy={{
            pages: home.pages,
            contact: home.nav.contact,
            instagram: "Instagram",
            newTab: copy.footer.newTab,
            language: copy.footer.language,
            copyright: copy.footer.copyright,
          }}
        >
          <main id="content">
            <StayHero
              image={stay.hero_image}
              eyebrow={stay.destination_name}
              title={stay.title}
              tagline={stay.tagline}
            >
              <StayBookingBar />
            </StayHero>

            <PageShell className="pt-12 pb-16">
              <FactList items={facts} columns={2} />

              <div className="pt-12">
                <Gallery
                  images={stay.gallery.map((image) => ({ src: image.url, alt: image.alt }))}
                  labels={copy.gallery}
                />
              </div>

              <Section id="about" heading={copy.about}>
                <div className="grid max-w-prose gap-4">
                  {stay.description.map((paragraph, index) => (
                    <p key={index} className="m-0 text-body text-ink">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {stay.inclusions.length > 0 ? (
                  <div className="grid gap-3">
                    <p className="m-0 text-body text-ink">{copy.inclusionsLabel}</p>
                    <FactList items={stay.inclusions.map((value) => ({ value, icon: true }))} />
                  </div>
                ) : null}
                {stay.price_note ? <p className="m-0 max-w-prose text-body text-ink">{stay.price_note}</p> : null}
                <div>
                  <Link href={siteHref(locale, "/contact")}>{copy.requestInquiry}</Link>
                </div>
              </Section>

              {stay.amenities.length > 0 ? (
                <Section id="amenities" heading={copy.amenities} intro={copy.amenitiesIntro}>
                  <FactList items={stay.amenities.map((value) => ({ value, icon: true }))} columns={2} />
                </Section>
              ) : null}

              {stay.policy_headings.length > 0 ? (
                <Section id="policies" heading={copy.policies}>
                  <FactList items={stay.policy_headings.map((value) => ({ value }))} />
                </Section>
              ) : null}

              {services.length > 0 ? (
                <Section id="services" heading={copy.services} intro={copy.servicesIntro}>
                  <div className={CARD_GRID}>{services}</div>
                </Section>
              ) : null}

              {experiences.length > 0 ? (
                <Section id="experiences" heading={copy.experiences} intro={copy.experiencesIntro}>
                  <div className={CARD_GRID}>{experiences}</div>
                </Section>
              ) : null}

              {related.length > 0 ? (
                <Section id="related" heading={copy.related}>
                  <div className={CARD_GRID}>
                    {related.flatMap((other) =>
                      other.hero_image
                        ? [
                            <MediaCard
                              key={other.slug}
                              href={localePath(locale, `/private-stays/${other.slug}`)}
                              image={{ src: other.hero_image.url, alt: other.hero_image.alt }}
                              title={other.title}
                              detail={[other.neighborhood, other.guests_label].filter(Boolean).join(" · ")}
                            />,
                          ]
                        : [],
                    )}
                  </div>
                </Section>
              ) : null}
            </PageShell>
          </main>
        </PublicFrame>
        <StayBookingDock />
      </StayBooking>
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
    </>
  );
}
