import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONTACT_PAGE_COPY } from "../../lib/copy/contact-page";
import { HOME_COPY } from "../../lib/copy/home";
import { PACKAGE_PAGE_COPY } from "../../lib/copy/package-page";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { generatePackageParams, getPackage } from "../../lib/data/journeys";
import { getSiteLegalChrome } from "../../lib/data/legal";
import { absoluteLocaleUrl, localeAlternates, localeHrefs, type Locale } from "../../lib/locale-path";
import { buildPackageAskMessage } from "../../lib/site-requests/package";
import { stayRequestHref } from "../../lib/whatsapp-request";
import { footerPageLinks, pageLinks } from "../site/page-links";
import { PublicFrame } from "../site/public-frame";
import { PackageRequestForm } from "./package/package-request-form";
import { PackageView } from "./package/package-view";

// /<locale>/journeys/<slug> (plan 06-06, CMS-03, BOOK-05, ADDN-03, F-01; pictures/06-06): one static page per published package in
// each language, opened from its card in Choose Your Journey. The guest reads the route and what is included, and asks: Request
// this journey posts a `package` request through 06-05's route; the owner prices it and makes the booking by hand. No amount, no
// checkout, no card. A hidden package has no page (`dynamicParams = false`, published slugs only).

export { generatePackageParams };

const pathOf = (slug: string) => `/journeys/${slug}`;

export async function packageMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const pkg = await getPackage(locale, slug);
  if (!pkg) return {};
  const path = pathOf(slug);
  const title = `${pkg.name} | ALMAR`;
  const description = pkg.tagline ?? pkg.body ?? undefined;
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
      images: pkg.image ? [{ url: pkg.image.url, width: pkg.image.width ?? undefined, height: pkg.image.height ?? undefined, alt: pkg.image.alt }] : undefined,
    },
  };
}

export async function PackagePage({ locale, slug }: { locale: Locale; slug: string }) {
  const [pkg, legal] = await Promise.all([getPackage(locale, slug), getSiteLegalChrome(locale)]);
  if (!pkg) notFound();
  const path = pathOf(slug);
  const nav = HOME_COPY[locale].nav;
  const copy = PACKAGE_PAGE_COPY[locale];
  // A city named twice on the route is one box on the form.
  const cities = [...new Set(pkg.legs.map((leg) => leg.destination_name))];
  const whatsappHref = stayRequestHref(buildPackageAskMessage({ name: pkg.name, pageUrl: absoluteLocaleUrl(locale, path) }, copy));

  return (
    <PublicFrame
      locale={locale}
      currentPath={path}
      localeHrefs={localeHrefs(path)}
      links={pageLinks(locale, nav)}
      footerLinks={footerPageLinks(locale)}
      footerCopy={SITE_FOOTER_COPY[locale]}
      legal={legal}
      labels={nav}
    >
      <PackageView
        pkg={pkg}
        copy={copy}
        locale={locale}
        whatsappHref={whatsappHref}
        newTabLabel={CONTACT_PAGE_COPY[locale].newTab}
        form={<PackageRequestForm tierSlug={pkg.slug} cities={cities} copy={copy} locale={locale} />}
      />
    </PublicFrame>
  );
}
