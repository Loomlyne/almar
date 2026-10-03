import type { Metadata } from "next";
import { HOME_COPY } from "../../lib/copy/home";
import { STAYS_LIST_COPY } from "../../lib/copy/stays-list";
import { getDestinations } from "../../lib/data/destinations";
import { getStays } from "../../lib/data/stays";
import { absoluteLocaleUrl, localeAlternates, localePath, siteHref, type Locale } from "../../lib/locale-path";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { PublicFrame, type PublicFrameLink } from "../site/public-frame";
import { PageShell } from "../ui/page-shell";
import { StayBrowser, type ListStay } from "./private-stays/stay-browser";

/** The English path of this page. localePath turns it into the address in each language. */
const PATH = "/private-stays";

/** The four pages the header and footer link to. Today they are English-only Framer pages (siteHref keeps them so). */
const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: "/about" },
  { key: "contact", path: "/contact" },
] as const;

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
    image: stay.hero_image ? { src: stay.hero_image.url, alt: stay.hero_image.alt } : null,
  }));

  const nav = HOME_COPY[locale].nav;
  const links: PublicFrameLink[] = PAGE_LINKS.map(({ key, path }) => ({
    label: nav[key],
    href: siteHref(locale, path),
  }));

  return (
    <PublicFrame
      locale={locale}
      currentPath={PATH}
      links={links}
      footerLinks={links}
      footerCopy={copy.frame.footer}
      labels={nav}
    >
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <noscript>
        <style>{NO_SCRIPT_RULE}</style>
      </noscript>
      <main id="content">
        <PageShell className="grid gap-6 pb-16 pt-12">
          {/* The page h1 in board 5h's head: SectionHead takes levels 2 to 4 only, so the same gold rule,
              padding and teal Questa are written here once. */}
          <div className="max-w-3xl border-t-2 border-gold pt-6">
            <h1 className="m-0 font-display text-display text-teal">{copy.heading}</h1>
          </div>
          <StayBrowser
            locale={locale}
            stays={listStays}
            destinations={destinations.map((d) => ({ slug: d.slug, name: d.name }))}
            hrefs={hrefs}
            basePath={localePath(locale, PATH)}
            copy={copy}
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
