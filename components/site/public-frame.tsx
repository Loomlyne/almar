"use client";

import type { ComponentProps, ReactNode } from "react";
import { SiteFooter, type FooterCopy } from "../ui/footer";
import { MotionController } from "./motion-controller";
import { SiteNav, type NavLabels } from "../ui/nav";
import { WhatsApp } from "../ui/whatsapp";
import type { SelectedCurrency } from "../../lib/fx/rates";
import {
  localeHrefs as localeHrefsOf,
  localePath,
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
// form, no "List with us" column. Currency is off unless a page passes the state its own amounts use.

export type PublicFrameLink = { label: string; href: string };

type NavTone = "solid" | "on-image";

/** Contact details already published in the live HTML. Not invented here. The footer builds tel: from the digits. */
export const SITE_CONTACT = {
  email: "inquiries@almarprivatejourney.com",
  phone: "+971 56 388 3302",
  instagram: "https://www.instagram.com/almarprivatejourney/",
} as const;

/** The studio credit in the footer: a name and an address, not copy. The "Made by" label is footerCopy.madeBy. */
const MADE_BY = { name: "Koussay", href: "https://koussay.com" } as const;

/** Language names are never translated: each language is named in itself. */
const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };

/**
 * The currency a page converts its amounts with. `selected` is the visitor's saved choice (null: none yet, so
 * nothing is selected and picking AED is a real change); `onChange` stores a pick. The page owns the state,
 * so the select and the prices it moves always read the same value.
 */
export type PublicFrameCurrency = {
  selected: SelectedCurrency | null;
  onChange: (next: SelectedCurrency) => void;
};

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
  whatsappClassName,
  whatsapp = true,
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
  /** The logo link. Defaults to this locale's home ("/", "/ar/", "/es/"), never the page's own address. */
  homeHref?: string;
  labels?: Partial<NavLabels>;
  navTone?: NavTone;
  /**
   * Currency select. false (the default): none, because a page with no amount has nothing to convert.
   * Otherwise the select is controlled by the page's own state (see PublicFrameCurrency).
   */
  currency?: false | PublicFrameCurrency;
  /** Merged onto the WhatsApp float, for a page with a pinned bar that the float must clear. */
  whatsappClassName?: string;
  /** The green WhatsApp float. false: none, for a page whose own button already is the one WhatsApp action. */
  whatsapp?: boolean;
  children: ReactNode;
}) {
  const hrefs = localeHrefs ?? (matchPublicPage(currentPath) ? localeHrefsOf(currentPath) : undefined);
  const home = homeHref ?? localePath(locale, "/");

  const nav: ComponentProps<typeof SiteNav> = {
    locale,
    labels,
    tone: navTone,
    links,
    homeHref: home,
    localeHrefs: hrefs,
    currentPath,
    login: false,
    currency: currency === false ? false : currency.selected,
    reveal: true,
  };
  if (currency !== false) nav.onCurrency = currency.onChange;

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
        tone="light"
        madeBy={{ label: footerCopy.madeBy ?? "", name: MADE_BY.name, href: MADE_BY.href }}
      />
      {whatsapp ? whatsappClassName ? <WhatsApp className={whatsappClassName} /> : <WhatsApp /> : null}
      <MotionController />
    </>
  );
}
