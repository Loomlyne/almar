"use client";

import type { ComponentProps, ReactNode } from "react";
import { SiteFooter, type FooterCopy } from "../ui/footer";
import { SiteNav, type NavLabels } from "../ui/nav";
import { WhatsApp } from "../ui/whatsapp";
import {
  localeHrefs as localeHrefsOf,
  matchPublicPage,
  type Locale,
} from "../../lib/locale-path";

// The one frame every public React page wears: nav, footer and the WhatsApp link, composed once
// (3.3 reconcile R-2). Pages 04, 05 and 06 render

//   <PublicFrame locale="ar" currentPath="/private-stays" links={...} footerLinks={...} footerCopy={...}>
//     <main id="content">...</main>
//   </PublicFrame>

// and supply their own <main id="content"> (the skip link in the root document points at it).

// Every held control is off here, so a page cannot show one by accident: no Login, no cart, no newsletter
// form, no "List with us" column. Currency is off unless a page turns it on.

export type PublicFrameLink = { label: string; href: string };

type NavTone = "solid" | "on-image";

/** Contact details already published in the live HTML. Not invented here. */
export const SITE_CONTACT = {
  email: "inquiries@almarprivatejourney.com",
  phone: "+971563883302",
  instagram: "https://www.instagram.com/almarprivatejourney/",
} as const;

/** Language names are never translated: each language is named in itself. */
const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };

export function PublicFrame({
  locale,
  currentPath,
  links,
  footerLinks,
  footerCopy,
  localeHrefs,
  homeHref,
  labels,
  navTone = "solid",
  currency = false,
  children,
}: {
  locale: Locale;
  /** The page's English path, e.g. "/private-stays". Marks the matching nav link; none when it is not in the nav. */
  currentPath: string;
  /** Nav links, already localised by siteHref(locale, ...). */
  links: PublicFrameLink[];
  /** Footer page links, already localised. */
  footerLinks: PublicFrameLink[];
  /** The footer's string table, in this page's language. */
  footerCopy: FooterCopy;
  /** The page in each language. Defaults to localeHrefs(currentPath) when currentPath is a public page. */
  localeHrefs?: Record<Locale, string>;
  /** The logo link. Defaults to this locale's home. */
  homeHref?: string;
  labels?: Partial<NavLabels>;
  navTone?: NavTone;
  /** Currency select on or off. Off by default: it works on pages that show prices only. */
  currency?: boolean;
  children: ReactNode;
}) {
  const hrefs = localeHrefs ?? (matchPublicPage(currentPath) ? localeHrefsOf(currentPath) : undefined);
  const home = homeHref ?? (hrefs ? hrefs[locale] : "/");

  const nav: ComponentProps<typeof SiteNav> = {
    locale,
    labels,
    tone: navTone,
    links,
    homeHref: home,
    localeHrefs: hrefs,
    currentPath,
    login: false,
  };
  if (!currency) nav.currency = false;

  return (
    <>
      <SiteNav {...nav} />
      {children}
      <SiteFooter
        copy={footerCopy}
        links={footerLinks}
        contact={SITE_CONTACT}
        languageLinks={
          hrefs
            ? (["en", "ar", "es"] as const).map((l) => ({
                label: LANGUAGE_NAMES[l],
                href: hrefs[l],
                lang: l,
                current: l === locale,
              }))
            : []
        }
        newsletter={false}
      />
      <WhatsApp />
    </>
  );
}
