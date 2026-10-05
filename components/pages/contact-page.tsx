import { HOME_COPY } from "../../lib/copy/home";
import { CONTACT_PAGE_COPY } from "../../lib/copy/contact-page";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getContactDetails } from "../../lib/data/contact";
import { getTeam } from "../../lib/data/team";
import { localeHrefs, siteHref, type Locale } from "../../lib/locale-path";
import { TeamSection } from "../journey/team-section";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { PublicFrame, type PublicFrameLink } from "../site/public-frame";
import { Divider } from "../ui/divider";
import { PageShell } from "../ui/page-shell";
import { Reveal } from "../ui/reveal";
import { SectionHead } from "../ui/section";
import { ContactDetailsBlock } from "./contact/contact-details";
import { CONTACT_PATH, contactLinks } from "./contact/contact-links";

export { contactMetadata } from "./contact/contact-meta";

/** The four pages the header and footer link to. siteHref gives each its address in this language, and keeps a page English-only until it is a public React page (Destinations and Experiences today). */
const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: "/about" },
  { key: "contact", path: CONTACT_PATH },
] as const;

/**
 * /contact, /ar/contact and /es/contact (design 12.2): the Framer page on job 11's parts. Title block, divider, two equal
 * columns from 1024 px (the details at the start, Travel With Confidence at the end), divider, the team (nothing today).
 * Part A has no form, so the end column holds Travel With Confidence and no column is empty (S3-3). Plan 26 moves that
 * block below the columns, centred, with the outlined `Start Your Inquiry`, and puts the framed form box (with
 * `Message on WhatsApp`) in the end column (S3-25).
 */
export async function ContactPage({ locale }: { locale: Locale }) {
  const copy = CONTACT_PAGE_COPY[locale];
  const [details, team] = await Promise.all([getContactDetails(locale), getTeam(locale)]);
  const links = contactLinks(details);

  const nav = HOME_COPY[locale].nav;
  const pageLinks: PublicFrameLink[] = PAGE_LINKS.map(({ key, path }) => ({
    label: nav[key],
    href: siteHref(locale, path),
  }));

  return (
    <PublicFrame
      locale={locale}
      currentPath={siteHref(locale, CONTACT_PATH)}
      localeHrefs={localeHrefs(CONTACT_PATH)}
      links={pageLinks}
      footerLinks={pageLinks}
      footerCopy={SITE_FOOTER_COPY[locale]}
      labels={nav}
    >
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <main id="content">
        <PageShell className="py-16 md:py-section">
          {/* The page's one h1: Framer's centred title, the signed type scale (hero: 64, 40 on a phone), A3 on load. */}
          <Reveal kind="headline" className="grid justify-items-center gap-6 text-center">
            <p className="m-0 text-label text-teal md:text-body">{copy.title.kicker}</p>
            <h1 className="m-0 max-w-4xl font-display text-hero tracking-display text-teal text-balance">
              {copy.title.heading}
            </h1>
            <p className="m-0 max-w-md text-label text-ink md:text-body">{copy.title.intro}</p>
          </Reveal>
        </PageShell>
        <PageShell>
          <Divider />
        </PageShell>
        <PageShell className="py-16 md:py-section">
          <div data-contact-columns className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <section aria-labelledby="contact-details-heading">
              <ContactDetailsBlock details={details} links={links} copy={copy} />
            </section>
            <section aria-labelledby="contact-confidence-heading" className="grid content-start gap-6">
              <SectionHead
                tone="plain"
                heading={copy.confidence.heading}
                headingId="contact-confidence-heading"
                intro={copy.confidence.body}
              />
            </section>
          </div>
        </PageShell>
        <PageShell>
          <Divider />
        </PageShell>
        {team.length > 0 ? (
          <PageShell className="py-16 md:py-section">
            <TeamSection
              title={copy.team.title}
              members={team.map((member) => ({
                id: member.id,
                name: member.name,
                role: member.role ?? "",
                photo: member.photo ? { src: member.photo.url, alt: member.photo.alt } : undefined,
              }))}
            />
          </PageShell>
        ) : null}
      </main>
    </PublicFrame>
  );
}
