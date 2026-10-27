import type { Metadata } from "next";
import { EXPERIENCES_PAGE_COPY } from "../../lib/copy/experiences-page";
import { HOME_COPY } from "../../lib/copy/home";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getDestinations } from "../../lib/data/destinations";
import { getCatalogItems } from "../../lib/data/experiences";
import { getPageContent, withPageWords } from "../../lib/data/page-content";
import { getStays } from "../../lib/data/stays";
import { absoluteLocaleUrl, localeAlternates, localePath, siteHref, type Locale } from "../../lib/locale-path";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { footerPageLinks, pageLinks } from "../site/page-links";
import { PublicFrame } from "../site/public-frame";
import { PageShell } from "../ui/page-shell";
import { SectionHead } from "../ui/section";
import { priceRanks } from "../../lib/data/catalog-filter";
import { CatalogBrowser, type BrowserItem } from "./experiences/catalog-browser";
import { PageBand } from "./page-band";

// /experiences, /ar/experiences and /es/experiences are this one component (plan 03.3-14): experiences and services on one
// page (owner answer 1, D-64), a filter rail from 1024px and a toolbar with a Filters sheet below it, every card opening
// its own overlay. It shows no price, no Add, no cart, no Login and no currency select: none of them can work yet (design 4.3).

/** The English path of this page. localePath turns it into the address in each language. */
const PATH = "/experiences";

/**
 * With JavaScript off the filters cannot work, so they are not shown: the 45 cards still are, in their two groups, and
 * each card's paragraph is shown in full, so nothing the clamp hides is lost.
 */
const NO_SCRIPT_RULE =
  "[data-catalog-filters]{display:none}[data-clamp]{display:block;-webkit-line-clamp:unset;overflow:visible}";

export async function ExperiencesPage({ locale }: { locale: Locale }) {
  const [content, catalog, destinations, stays] = await Promise.all([
    getPageContent("experiences", locale),
    getCatalogItems(locale),
    getDestinations(locale, { includeEmpty: true }),
    getStays(locale),
  ]);

  // The heading the owner edits in Content -> Pages (plan 06-02); in fixtures mode the copy file's words.
  const copy = withPageWords(EXPERIENCES_PAGE_COPY[locale], "experiences", content);

  // The browser gets a rank, never an amount (no catalogue number in the public HTML).
  const ranks = priceRanks(catalog);
  const items: BrowserItem[] = catalog.map((item) => {
    if (!item.image) throw new Error(`experiences: ${item.slug} has no image`);
    return {
      slug: item.slug,
      kind: item.kind,
      name: item.name,
      summary: item.summary,
      duration_label: item.duration_label,
      destination_slugs: item.destination_slugs,
      stay_slugs: item.stay_slugs,
      sort_rank: ranks.get(item.slug) ?? null,
      image: { src: item.image.url, alt: item.image.alt },
    };
  });

  // The places and stays the filters offer: those with at least one item, in the owner's order.
  const usedPlaces = new Set(items.flatMap((item) => item.destination_slugs));
  const usedStays = new Set(items.flatMap((item) => item.stay_slugs));
  const offeredDestinations = destinations.filter((d) => usedPlaces.has(d.slug)).map((d) => ({ slug: d.slug, name: d.name }));
  const offeredStays = stays
    .filter((s) => usedStays.has(s.slug))
    .map((s) => ({ slug: s.slug, title: s.title, destination_slug: s.destination_slug }));

  const stayHrefs: Record<string, string> = {};
  for (const stay of stays) stayHrefs[stay.slug] = localePath(locale, `/private-stays/${stay.slug}`);

  const nav = HOME_COPY[locale].nav;
  const links = pageLinks(locale, nav);

  return (
    <PublicFrame
      locale={locale}
      currentPath={PATH}
      links={links}
      footerLinks={footerPageLinks(locale)}
      footerCopy={SITE_FOOTER_COPY[locale]}
      labels={nav}
    >
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <noscript>
        <style>{NO_SCRIPT_RULE}</style>
      </noscript>
      <main id="content">
        <PageBand image={content.hero.image} videoUrl={content.hero.video_url} />
        <PageShell className="grid gap-6 pb-16 pt-12">
          {/* The page's one h1, in board 5e's head: the gold rule, 24px padding and teal Questa at the display size. */}
          <SectionHead heading={copy.heading} headingLevel={1} headingSize="display" />
          <CatalogBrowser
            locale={locale}
            items={items}
            destinations={offeredDestinations}
            stays={offeredStays}
            stayHrefs={stayHrefs}
            inquiryHref={siteHref(locale, "/contact")}
            basePath={localePath(locale, PATH)}
            copy={copy}
          />
        </PageShell>
      </main>
    </PublicFrame>
  );
}

/** Title, description, canonical, the four hreflang links and og:image, all from the copy, the data and the helpers. */
export async function experiencesMetadata(locale: Locale): Promise<Metadata> {
  const copy = EXPERIENCES_PAGE_COPY[locale];
  const first = (await getCatalogItems(locale))[0]?.image ?? null;
  const images = first ? [{ url: first.url, alt: first.alt }] : undefined;
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
