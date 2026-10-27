import { HOME_COPY } from "../../lib/copy/home";
import { CONTACT_PAGE_COPY } from "../../lib/copy/contact-page";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getContactDetails } from "../../lib/data/contact";
import { getPageContent, withPageWords } from "../../lib/data/page-content";
import { getTeam } from "../../lib/data/team";
import { localeHrefs, siteHref, type Locale } from "../../lib/locale-path";
import { TeamSection } from "../journey/team-section";
import { ORGANIZATION_JSON_LD_SCRIPT } from "../site/organization-json-ld";
import { footerPageLinks, pageLinks } from "../site/page-links";
import { PublicFrame } from "../site/public-frame";
import { Divider } from "../ui/divider";
import { PageShell } from "../ui/page-shell";
import { Reveal } from "../ui/reveal";
import { SectionHead } from "../ui/section";
import { ContactDetailsBlock } from "./contact/contact-details";
import { CONTACT_PATH, contactLinks } from "./contact/contact-links";
import { InquiryForm, InquiryStart } from "./contact/inquiry-form";
import { PageBand } from "./page-band";

export { contactMetadata } from "./contact/contact-meta";

/**
 * /contact, /ar/contact and /es/contact (design 12.2): the Framer page on job 11's parts. Title block, divider, two equal
 * columns from 1024 px (the details at the start, the framed inquiry form box with `Message on WhatsApp` at the end),
 * Travel With Confidence centred below with the outlined `Start Your Inquiry`, divider, the team (nothing today).
 * The form box and `Start Your Inquiry` appear only after hydration (plan 26): without JavaScript the columns hold the
 * details alone and Travel With Confidence follows them, so no control is shown that cannot work.
 */
export async function ContactPage({ locale }: { locale: Locale }) {
  const [content, details, team] = await Promise.all([getPageContent("contact", locale), getContactDetails(locale), getTeam(locale)]);
  // The title, Travel With Confidence and team heading the owner edits in Content -> Pages (plan 06-02); the contact
  // details and the inquiry form are not sections and stay fixed (SITE-13).
  const copy = withPageWords(CONTACT_PAGE_COPY[locale], "contact", content);
  const on = (section: string) => content.shown.has(section);
  const links = contactLinks(details);

  const nav = HOME_COPY[locale].nav;

  return (
    <PublicFrame
      locale={locale}
      currentPath={siteHref(locale, CONTACT_PATH)}
      localeHrefs={localeHrefs(CONTACT_PATH)}
      links={pageLinks(locale, nav)}
      footerLinks={footerPageLinks(locale)}
      footerCopy={SITE_FOOTER_COPY[locale]}
      labels={nav}
    >
      <script {...ORGANIZATION_JSON_LD_SCRIPT} />
      <main id="content">
        <PageBand image={content.hero.image} videoUrl={content.hero.video_url} />
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
            <InquiryForm
              locale={locale}
              copy={copy.form}
              whatsappCta={copy.whatsappCta}
              newTabLabel={copy.newTab}
              whatsappHref={links.whatsappMessage}
              mailto={links.mailto}
              email={details.email}
            />
          </div>
        </PageShell>
        {on("confidence") ? (
          <PageShell className="py-16 md:py-section">
            <section aria-labelledby="contact-confidence-heading" className="grid justify-items-center gap-6">
              <SectionHead
                tone="plain"
                align="center"
                heading={copy.confidence.heading}
                headingId="contact-confidence-heading"
                intro={copy.confidence.body}
              />
              <InquiryStart label={copy.startInquiry} />
            </section>
          </PageShell>
        ) : null}
        {on("confidence") ? (
          <PageShell>
            <Divider />
          </PageShell>
        ) : null}
        {on("team") && team.length > 0 ? (
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
