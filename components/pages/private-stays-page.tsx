import type { Metadata } from "next";
import { HOME_COPY } from "../../lib/copy/home";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { STAY_DETAIL_COPY } from "../../lib/copy/stay-detail";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { STAYS_LIST_COPY } from "../../lib/copy/stays-list";
import { getDestinations } from "../../lib/data/destinations";
import { getStays } from "../../lib/data/stays";
import { pageLinks } from "../site/page-links";
import { absoluteLocaleUrl, localeAlternates, localePath, type Locale } from "../../lib/locale-path";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { PublicFrame, type PublicFrameLink } from "../site/public-frame";
import { PageShell } from "../ui/page-shell";
import { SectionHead } from "../ui/section";
import { StayBrowser, type ListStay } from "./private-stays/stay-browser";

/** The English path of this page. localePath turns it into the address in each language. */
const PATH = "/private-stays";

/** With JavaScript off the filters cannot work, so they are not shown: the 12 linked cards still are. */
const NO_SCRIPT_RULE = "[data-stay-filters]{display:none}";

/** The published stays in the owner's order, in this language, as plain data for the client list. */
export async function PrivateStaysPage({ locale }: { locale: Locale }) {
  const copy = STAYS_LIST_COPY[locale];
  const [stays, destinations] = await Promise.all([getStays(locale), getDestinations(locale)]);

  const hrefs: Record<string, string> = {};
  for (const stay of stays) hrefs[stay.slug] = localePath(locale, `${PATH}/${stay.slug}`);

  const listStays: ListStay[] = stays.map((stay) => ({
    slug: stay.slug,
    title: stay.title,
    neighborhood: stay.neighborhood,
    guests_label: stay.guests_label,
    price_label: stay.price_label,
    max_guests: stay.max_guests,
    bedrooms: stay.bedrooms,
    destination_slug: stay.destination_slug,
    destination_name: stay.destination_name,
    blocked_dates: stay.blocked_dates,
    image: stay.hero_image ? { src: stay.hero_image.url, alt: stay.hero_image.alt } : null,
  }));

  const nav = HOME_COPY[locale].nav;
  const links: PublicFrameLink[] = pageLinks(locale, nav);

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
      <noscript>
        <style>{NO_SCRIPT_RULE}</style>
      </noscript>
      <main id="content">
        <PageShell className="grid gap-6 pb-16 pt-12">
          {/* The page's one h1, in board 5h's head: the gold rule, 24px padding and teal Questa at the display size. */}
          <SectionHead heading={copy.heading} headingLevel={1} headingSize="display" />
          <StayBrowser
            locale={locale}
            stays={listStays}
            destinations={destinations.map((d) => ({ slug: d.slug, name: d.name }))}
            hrefs={hrefs}
            basePath={localePath(locale, PATH)}
            copy={copy}
            journeyCopy={JOURNEY_COPY[locale]}
            datesNote={stays.some((s) => s.sample_fields.includes("blocked_dates")) ? STAY_DETAIL_COPY[locale].sampleDatesNote : null}
          />
        </PageShell>
      </main>
    </PublicFrame>
  );
}

/** Title, description, canonical, the four hreflang links and og:image, all from the data and the helpers. */
export async function privateStaysMetadata(locale: Locale): Promise<Metadata> {
  const copy = STAYS_LIST_COPY[locale];
  const stays = await getStays(locale);
  const hero = stays[0]?.hero_image ?? null;
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
