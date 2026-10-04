// The one private-stay detail template for all 12 stays in EN, AR and ES (phase 3.3 plans 06 and 45, design 1.3).
// A server component: every value is read through lib/data and every string through lib/copy. The only client
// parts are the booking island (state for the bar, the sheet and the dock), the page frame and the slideshow.
//
// What this page never does (design 3.9, 4.3):
//  - show an amount or a minimum stay: those fields are not read here, and the island never gets a Stay;
//  - render a submit, a Search button, an Add button, a Continue button, a cart, a Login or a newsletter form;
//  - hide a sentence with CSS: text that must not show is not in the data at all.
// Policies are headings only; nothing opens (owner, 2026-10-04) until real text is written in the dashboard.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StayBooking, StayBookingBar, StayBookingDock } from "./stay-detail/booking";
import { StayHero } from "./stay-detail/hero";
import { AMENITY_ICONS, BedIcon, GuestIcon } from "../icons/icons";
import { LinkButton } from "../ui/button";
import { MediaCard, PortraitCard } from "../ui/card";
import { FactList, type Fact } from "../ui/fact-list";
import { PageShell } from "../ui/page-shell";
import { Reveal } from "../ui/reveal";
import { Section } from "../ui/section";
import { Slider } from "../ui/slider";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { PublicFrame } from "../site/public-frame";
import { getCatalogForStay } from "../../lib/data/experiences";
import { getBlockedDates, getRelatedStays, getStay, getStaySlugs } from "../../lib/data/stays";
import type { CatalogItem, Locale } from "../../lib/data/types";
import { HOME_COPY } from "../../lib/copy/home";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { pickStayJourneyCopy } from "./stay-detail/booking-value";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { STAY_DETAIL_COPY } from "../../lib/copy/stay-detail";
import { fill } from "../../lib/journey-format";
import { absoluteLocaleUrl, localeAlternates, localePath, siteHref } from "../../lib/locale-path";

// Three cards from md, two below it (Framer shows two at 390): the third card is hidden below md.
const CARD_GRID = "m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-3";
const cardItem = (index: number) => (index >= 2 ? "hidden min-w-0 md:block" : "min-w-0");
const H2 = "m-0 font-display text-display text-teal";

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

function catalogCards(items: CatalogItem[], ratio: number, centered: boolean) {
  return items
    .filter((item) => item.image)
    .slice(0, 3)
    .map((item, index) => (
      <li key={item.slug} className={cardItem(index)}>
        <MediaCard
          image={{ src: item.image!.url, alt: item.image!.alt }}
          title={item.name}
          ratio={ratio}
          titleSize="heading"
          className="gap-6"
          align={centered ? "center" : "start"}
          detail={
            <>
              {item.summary}
              {item.duration_label ? <span className="block text-muted">{item.duration_label}</span> : null}
            </>
          }
        />
      </li>
    ));
}

/** Framer's two-column band: the head on the left (2 of 5), the content on the right (3 of 5). */
function SplitSection({
  id,
  heading,
  intro,
  children,
}: {
  id: string;
  heading: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="grid gap-8 py-16 md:grid-cols-5 md:py-section">
      <Reveal kind="heading" className="grid content-start gap-3 md:col-span-2">
        <h2 id={`${id}-heading`} className={H2}>
          {heading}
        </h2>
        {intro ? <p className="m-0 max-w-sm text-label md:text-body text-ink">{intro}</p> : null}
      </Reveal>
      <div className="min-w-0 md:col-span-3">{children}</div>
    </section>
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

  // Framer's order. A fact with no published value is left out: no dash, no placeholder.
  const facts: Fact[] = [
    { label: copy.facts.guests, value: stay.guests_label },
    { label: copy.facts.bathrooms, value: stay.bathrooms_label },
    { label: copy.facts.bedrooms, value: stay.bedrooms === null ? null : String(stay.bedrooms) },
    { label: copy.facts.beds, value: stay.beds_label },
    { label: copy.facts.neighborhood, value: stay.neighborhood },
  ].filter((fact) => fact.value !== null && fact.value !== "");

  const services = catalogCards(catalog.services, 2 / 3, false);
  const experiences = catalogCards(catalog.experiences, 1, true);
  const g = copy.gallery;

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
        request={{
          pageUrl: absoluteLocaleUrl(locale, pagePath),
          copy: copy.whatsapp,
          label: copy.whatsapp.button,
          opensNote: SITE_FOOTER_COPY[locale].newTab,
        }}
      >
        {/* The nav lies over the hero. The green WhatsApp float is not drawn here: the request button is the one WhatsApp control. */}
        <PublicFrame
          locale={locale}
          currentPath={pagePath}
          navTone="on-image"
          whatsapp={false}
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
          footerCopy={SITE_FOOTER_COPY[locale]}
        >
          <main id="content">
            <StayHero
              image={stay.hero_image}
              eyebrow={stay.destination_name}
              title={stay.title}
              subtitle={stay.neighborhood}
            >
              <StayBookingBar />
            </StayHero>

            <PageShell>
              <SplitSection id="about" heading={copy.about}>
                <Reveal kind="row" className="grid gap-8">
                  {facts.length > 0 ? (
                    // Framer's facts row: each fact is its small label over its value, the five in one row from md.
                    <dl className="m-0 flex flex-wrap gap-x-8 gap-y-4 border-b border-teal-tint pb-6">
                      {facts.map((fact) => (
                        <div key={fact.label} className="grid min-w-0 content-start gap-1">
                          <dt className="text-caption text-muted">{fact.label}</dt>
                          <dd className="m-0 text-label md:text-body text-ink">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <div className="grid gap-4">
                    {stay.description.map((paragraph, index) => (
                      <p key={index} className="m-0 text-label md:text-body text-ink">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {stay.inclusions.length > 0 ? (
                    <div className="grid gap-2">
                      <p className="m-0 text-label md:text-body text-ink">{copy.inclusionsLabel}</p>
                      <FactList layout="plain" items={stay.inclusions.map((value) => ({ value, icon: true }))} />
                    </div>
                  ) : null}
                  {stay.price_note ? (
                    <p className="m-0 border-t border-teal-tint pt-8 text-label md:text-body text-ink">{stay.price_note}</p>
                  ) : null}
                </Reveal>
                <Reveal kind="button" className="pt-8">
                  <LinkButton variant="outline" size="lg" href={siteHref(locale, "/contact")}>
                    {copy.requestInquiry}
                  </LinkButton>
                </Reveal>
              </SplitSection>
            </PageShell>

            {stay.gallery.length > 0 ? (
              <Reveal kind="row">
                <Slider
                  layout="peek"
                  autoplay
                  images={stay.gallery.map((image) => ({ src: image.url, alt: image.alt }))}
                  labels={{
                    region: fill(g.region, { title: stay.title }),
                    previous: g.previous,
                    next: g.next,
                    goTo: g.goTo,
                    slide: g.slide,
                    pause: g.pause,
                    play: g.play,
                  }}
                />
              </Reveal>
            ) : null}

            <PageShell>
              {stay.amenities.length > 0 ? (
                <SplitSection id="amenities" heading={copy.amenities} intro={copy.amenitiesIntro}>
                  <Reveal kind="row">
                    <FactList
                      layout="plain"
                      columns={2}
                      className="grid-cols-2 gap-x-4 gap-y-6 md:gap-x-8"
                      items={stay.amenities.map((value, index) => {
                        const Icon = AMENITY_ICONS[stay.amenity_icons[index] ?? "check"];
                        return { value, icon: <Icon size={20} aria-hidden="true" /> };
                      })}
                    />
                  </Reveal>
                </SplitSection>
              ) : null}

              {stay.policy_headings.length > 0 ? (
                <SplitSection id="policies" heading={copy.policies}>
                  <ul className="m-0 grid list-none border-t border-teal-tint p-0">
                    {stay.policy_headings.map((title, index) => (
                      <li key={index} className="border-b border-teal-tint py-4 text-label md:text-body text-ink">
                        <Reveal kind="row-sm">{title}</Reveal>
                      </li>
                    ))}
                  </ul>
                </SplitSection>
              ) : null}

              {services.length > 0 ? (
                <Section id="services" variant="page" heading={copy.services} intro={copy.servicesIntro}>
                  <Reveal kind="row">
                    <ul className={CARD_GRID}>{services}</ul>
                  </Reveal>
                </Section>
              ) : null}

              {experiences.length > 0 ? (
                <Section id="experiences" variant="page" heading={copy.experiences} intro={copy.experiencesIntro}>
                  <Reveal kind="row">
                    <ul className={CARD_GRID}>{experiences}</ul>
                  </Reveal>
                </Section>
              ) : null}

              {related.length > 0 ? (
                <Section
                  id="related"
                  variant="page"
                  heading={copy.related}
                  action={
                    <LinkButton variant="outline" size="lg" href={localePath(locale, "/private-stays")}>
                      {copy.relatedViewAll}
                    </LinkButton>
                  }
                >
                  <Reveal kind="row">
                    <ul className={CARD_GRID}>
                      {related
                        .filter((other) => other.hero_image)
                        .map((other, index) => (
                          <li key={other.slug} className={cardItem(index)}>
                            <PortraitCard
                              href={localePath(locale, `/private-stays/${other.slug}`)}
                              image={{ src: other.hero_image!.url, alt: other.hero_image!.alt }}
                              title={other.title}
                              facts={[
                                ...(other.beds_label ? [{ icon: <BedIcon size={16} />, text: other.beds_label }] : []),
                                ...(other.guests_label ? [{ icon: <GuestIcon size={16} />, text: other.guests_label }] : []),
                              ]}
                            />
                          </li>
                        ))}
                    </ul>
                  </Reveal>
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
