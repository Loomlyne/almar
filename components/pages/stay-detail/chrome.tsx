"use client";

import type { ReactNode } from "react";
import { SiteFooter, type FooterCopy } from "../../ui/footer";
import { SiteNav, type NavLabels } from "../../ui/nav";
import { WhatsApp } from "../../ui/whatsapp";
import { SITE_CONTACT, type PublicFrameLink } from "../../site/public-frame";
import { localeHrefs, type Locale } from "../../../lib/locale-path";

// The same chrome as components/site/public-frame.tsx (nav, footer, WhatsApp; every held control off), with one
// difference: the WhatsApp float is lifted above the pinned dock. PublicFrame renders <WhatsApp /> with no way
// to pass a class, and that file is plan 03's, so this page composes the chrome itself. Proposed follow-up for
// the controller: a `whatsappClassName` prop on PublicFrame, and this file goes.

/** Language names are never translated: each language is named in itself. */
const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };

export function StayChrome({
  locale,
  currentPath,
  homeHref,
  links,
  footerLinks,
  footerCopy,
  labels,
  children,
}: {
  locale: Locale;
  /** The page's English path, for example "/private-stays/getsemani-colonial-house". */
  currentPath: string;
  /** The wordmark's target: this language's home. */
  homeHref: string;
  links: PublicFrameLink[];
  footerLinks: PublicFrameLink[];
  footerCopy: FooterCopy;
  labels: Partial<NavLabels>;
  children: ReactNode;
}) {
  const hrefs = localeHrefs(currentPath);
  return (
    <>
      {/* SiteNav's "on-image" tone emits both `sticky` (base) and `absolute` (variant) and `sticky` wins, so on its
          own the header takes 61px of the page and sits ivory-on-ivory above the hero. This wrapper lays it over
          the hero instead. The fix belongs in components/ui/nav.tsx (plan 02): merge the two with cn(). */}
      <div className="absolute inset-x-0 top-0">
        <SiteNav
          locale={locale}
          labels={labels}
          tone="on-image"
          links={links}
          homeHref={homeHref}
          localeHrefs={hrefs}
          currentPath={currentPath}
          login={false}
          currency={false}
        />
      </div>
      {children}
      <SiteFooter
        copy={footerCopy}
        links={footerLinks}
        contact={SITE_CONTACT}
        languageLinks={(["en", "ar", "es"] as const).map((l) => ({
          label: LANGUAGE_NAMES[l],
          href: hrefs[l],
          lang: l,
          current: l === locale,
        }))}
        newsletter={false}
      />
      <WhatsApp className="bottom-dock mb-4" />
    </>
  );
}
