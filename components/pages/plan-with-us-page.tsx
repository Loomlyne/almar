import type { Metadata } from "next";
import { CONTACT_PAGE_COPY } from "../../lib/copy/contact-page";
import { HOME_COPY } from "../../lib/copy/home";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { SITE_REQUESTS_COPY } from "../../lib/copy/site-requests";
import { getContactDetails } from "../../lib/data/contact";
import { getDestinations } from "../../lib/data/destinations";
import { getSiteLegalChrome } from "../../lib/data/legal";
import { absoluteLocaleUrl, localeAlternates, localeHrefs, type Locale } from "../../lib/locale-path";
import { footerPageLinks, pageLinks } from "../site/page-links";
import { PublicFrame } from "../site/public-frame";
import { PageShell } from "../ui/page-shell";
import { contactLinks } from "./contact/contact-links";
import { PlanForm } from "./plan-with-us/plan-form";

// /<locale>/plan-with-us (plan 06-05, SITE-04, F-10; pictures/06-05 plan-*): the title block and the form. Linked from the home
// Begin section and from Contact. Nothing is paid here. The form appears only after hydration (the contact form's rule).

const PATH = "/plan-with-us";

export function planMetadata(locale: Locale): Metadata {
  const { title, intro } = SITE_REQUESTS_COPY[locale].plan;
  const name = `${title} | ALMAR`;
  return {
    title: name,
    description: intro,
    alternates: localeAlternates(locale, PATH),
    openGraph: { type: "website", siteName: "ALMAR Private Journeys", title: name, description: intro, url: absoluteLocaleUrl(locale, PATH) },
  };
}

export async function PlanWithUsPage({ locale }: { locale: Locale }) {
  const [details, destinations, legal] = await Promise.all([getContactDetails(locale), getDestinations(locale, { includeEmpty: true }), getSiteLegalChrome(locale)]);
  const links = contactLinks(details);
  const nav = HOME_COPY[locale].nav;
  const copy = SITE_REQUESTS_COPY[locale];
  const contact = CONTACT_PAGE_COPY[locale];

  return (
    <PublicFrame
      locale={locale}
      currentPath={PATH}
      localeHrefs={localeHrefs(PATH)}
      links={pageLinks(locale, nav)}
      footerLinks={footerPageLinks(locale)}
      footerCopy={SITE_FOOTER_COPY[locale]}
      legal={legal}
      labels={nav}
    >
      <main id="content">
        <PageShell className="py-16 md:py-section">
          <div className="grid gap-6">
            <p className="m-0 text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{contact.title.kicker}</p>
            <h1 className="m-0 text-balance font-display text-heading font-normal text-teal md:text-display">{copy.plan.title}</h1>
            <p className="m-0 max-w-md text-body text-ink">{copy.plan.intro}</p>
            <PlanForm
              locale={locale}
              copy={copy}
              destinations={destinations.map((destination) => destination.name)}
              tooLong={contact.form.errors.tooLong}
              email={details.email}
              mailto={links.mailto}
              whatsappHref={links.whatsappMessage}
              newTabLabel={contact.newTab}
            />
          </div>
        </PageShell>
      </main>
    </PublicFrame>
  );
}
