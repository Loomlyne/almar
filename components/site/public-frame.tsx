"use client";

import type { ComponentType, ReactNode } from "react";
import { SiteFooter } from "../ui/footer";
import { SiteNav, type NavLabels } from "../ui/nav";
import { WhatsApp } from "../ui/whatsapp";
import {
  localeHrefs as localeHrefsOf,
  matchPublicPage,
  type Locale,
} from "../../lib/locale-path";

// The one frame every public React page wears: nav, footer and the WhatsApp link, composed once
// (3.3 reconcile R-2). Pages 04, 05 and 06 render
//
//   <PublicFrame locale="ar" currentPath="/private-stays" links={...} footerLinks={...} footerCopy={...}>
//     <main id="content">...</main>
//   </PublicFrame>
//
// and supply their own <main id="content"> (the skip link in the root document points at it).
//
// Every held control is off here, so a page cannot show one by accident: no Login, no cart, no newsletter
// form, no "List with us" column. Currency is off unless a page turns it on.
//
// ---------------------------------------------------------------------------------------------------------
// TODO(plan 02 merge). Plan 02 extends components/ui/nav.tsx, footer.tsx and locale-select.tsx in a parallel
// branch. This file is written against the props they have TODAY plus the props plan 02 specifies, behind
// the two casts below, so it compiles now. At merge the controller deletes the casts, the TODO props and
// the interim onLocale, and passes the real props straight through:
//   SiteNav    + links, homeHref, localeHrefs, currentPath, login={false}, cart (default off), currency={false}
//              onLocale becomes optional (localeHrefs navigates)
//   SiteFooter + copy, links, contact, languageLinks, newsletter={false}
// Until then a built page would still show today's footer (newsletter form, English text): do not ship a
// page on this frame before plan 02 is merged.
// ---------------------------------------------------------------------------------------------------------

export type PublicFrameLink = { label: string; href: string };

type NavTone = "solid" | "on-image";

/** The nav props plan 02 adds (TODO(plan 02 merge)). */
type NavExtensions = {
  links?: PublicFrameLink[];
  homeHref?: string;
  localeHrefs?: Record<Locale, string>;
  currentPath?: string;
  login?: false;
  cart?: false;
  currency?: false;
};

/** The footer props plan 02 specifies (TODO(plan 02 merge)). */
type FooterExtensions = {
  copy: Record<string, string>;
  links: PublicFrameLink[];
  contact: { email: string; phone: string; instagram: string };
  languageLinks: { label: string; href: string; lang: Locale; current: boolean }[];
  newsletter: false;
};

type NavProps = {
  locale: Locale;
  onLocale?: (next: Locale) => void;
  labels?: Partial<NavLabels>;
  tone?: NavTone;
  markCurrent?: boolean;
} & NavExtensions;

// TODO(plan 02 merge): delete both casts.
const FrameNav = SiteNav as unknown as ComponentType<NavProps>;
const FrameFooter = SiteFooter as unknown as ComponentType<FooterExtensions>;

/** Contact details already published in the live HTML. Not invented here. */
export const SITE_CONTACT = {
  email: "inquiries@almarprivatejourney.com",
  phone: "+971563883302",
  instagram: "https://www.instagram.com/almarprivatejourney/",
} as const;

/** Language names are never translated: each language is named in itself. */
const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };

/** A language switch goes to a path of this site only (T-3.3-04). */
function sameSitePath(href: string | undefined): href is string {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !href.includes("\\");
}

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
  /** TODO(plan 02 merge): the footer's string table, as plan 02's SiteFooter copy prop defines it. */
  footerCopy: Record<string, string>;
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

  const nav: NavProps = {
    locale,
    labels,
    tone: navTone,
    links,
    homeHref: home,
    localeHrefs: hrefs,
    currentPath,
    login: false,
    // TODO(plan 02 merge): remove. Interim only: today's SiteNav needs onLocale to do anything.
    onLocale: (next) => {
      const target = hrefs?.[next];
      if (sameSitePath(target)) window.location.assign(target);
    },
  };
  if (!currency) nav.currency = false;

  return (
    <>
      <FrameNav {...nav} />
      {children}
      <FrameFooter
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
