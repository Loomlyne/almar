import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { footerPageLinks } from "../site/page-links";
import { PublicFrame } from "../site/public-frame";
import { blogFrameLinks } from "./blog/frame-links";
import { PageShell } from "../ui/page-shell";
import { RichText, type RichTextBlock } from "../ui/rich-text";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { generateLegalParams, getLegalPage, getSiteLegalChrome } from "../../lib/data/legal";
import { legalKindFromSlug } from "../../lib/legal/kinds";
import { absoluteLocaleUrl, localeAlternates, type Locale } from "../../lib/locale-path";

// A legal page (plan 06-04, F-07, SITE-09): /<locale>/legal/<slug> in three languages, one component; each route file binds a
// locale. The page is the owner's text only: title, heading, paragraphs and quotes, plain text through RichText, never HTML.
// With none published generateStaticParams is empty: no file reaches out/ and every /…/legal/* is the branded 404.

export const generateLegalStaticParams = generateLegalParams;

async function pageFor(locale: Locale, slug: string) {
  const kind = legalKindFromSlug(slug);
  return kind ? getLegalPage(locale, kind) : null;
}

export async function legalMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const page = await pageFor(locale, slug);
  if (!page) return {};
  const path = `/legal/${slug}`;
  const title = `${page.seo_title ?? page.title} | ALMAR`;
  const description = page.seo_description ?? undefined;
  return {
    title,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: { type: "website", siteName: "ALMAR Private Journeys", title, description, url: absoluteLocaleUrl(locale, path) },
  };
}

export async function LegalPage({ locale, slug }: { locale: Locale; slug: string }) {
  const page = await pageFor(locale, slug);
  if (!page) notFound();
  const { nav, links } = blogFrameLinks(locale);
  const blocks: RichTextBlock[] = page.body.map((block, i) => (block.type === "heading" ? { type: "heading", text: block.text, id: `section-${i + 1}` } : { type: block.type, text: block.text }));
  return (
    <PublicFrame
      locale={locale}
      currentPath={`/legal/${slug}`}
      links={links}
      footerLinks={footerPageLinks(locale)}
      footerCopy={SITE_FOOTER_COPY[locale]}
      labels={nav}
      legal={await getSiteLegalChrome(locale)}
    >
      <main id="content">
        <PageShell className="pb-16 pt-12">
          <article className="grid max-w-calendar gap-6">
            <h1 className="m-0 text-balance font-display text-heading font-normal text-teal md:text-display">{page.title}</h1>
            <RichText blocks={blocks} quote="line" />
          </article>
        </PageShell>
      </main>
    </PublicFrame>
  );
}
