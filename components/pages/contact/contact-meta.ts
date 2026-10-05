import type { Metadata } from "next";
import { CONTACT_PAGE_COPY } from "../../../lib/copy/contact-page";
import { absoluteLocaleUrl, localeAlternates, matchPublicPage, type Locale } from "../../../lib/locale-path";
import { CONTACT_PATH } from "./contact-links";

/**
 * Title, description, the canonical and, while /contact is in PUBLIC_PAGES, the four hreflang links. No og:image: the
 * live page's was on a Framer CDN host and this page carries no photo. localeAlternates throws for a path that is not a
 * public page, so it is called only inside the matchPublicPage branch; the other branch (not reachable today) keeps the
 * canonical alone, the same as aboutMetadata.
 */
export function contactMetadata(locale: Locale): Metadata {
  const copy = CONTACT_PAGE_COPY[locale];
  const url = absoluteLocaleUrl(locale, CONTACT_PATH);
  return {
    title: copy.meta.title,
    description: copy.meta.description,
    alternates: matchPublicPage(CONTACT_PATH) ? localeAlternates(locale, CONTACT_PATH) : { canonical: url },
    openGraph: {
      type: "website",
      title: copy.meta.title,
      description: copy.meta.description,
      url,
    },
    twitter: {
      card: "summary",
      title: copy.meta.title,
      description: copy.meta.description,
    },
  };
}
