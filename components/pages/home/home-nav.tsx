"use client";

import type { ReactNode } from "react";
import { SiteFooter, type FooterCopy } from "../../ui/footer";
import { SiteNav, type NavLabels, type NavLink } from "../../ui/nav";
import { WhatsApp } from "../../ui/whatsapp";
import { SITE_CONTACT } from "../../site/public-frame";
import { localeHrefs as localeHrefsOf, type Locale } from "../../../lib/locale-path";
import { useCurrencyChoice } from "./currency-choice";

// The home page's chrome. PublicFrame (plan 03) composes the same nav, footer and WhatsApp for every other
// public page, but it takes no page-supplied nav, and the home page is the one page whose currency select is
// bound to a saved browser choice (reconcile R-3, plan 04's fallback). So this file renders the SAME parts
// with the same held controls off: no Login, no cart, no newsletter, no "List with us". The contact details
// come from PublicFrame's own constant so the two can never drift.

/** Language names are never translated: each language is named in itself. */
const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };

const HOME_PATH = "/";

export function HomeNav({
  locale,
  links,
  labels,
  currencyEnabled,
  tone = "on-image",
}: {
  locale: Locale;
  links: NavLink[];
  labels: Partial<NavLabels>;
  /** False when the build had no exchange rates: with nothing to convert there is no currency control. */
  currencyEnabled: boolean;
  tone?: "solid" | "on-image";
}) {
  const { selected, choose } = useCurrencyChoice();
  const hrefs = localeHrefsOf(HOME_PATH);
  const nav = (
    <SiteNav
      locale={locale}
      labels={labels}
      tone={tone}
      links={links}
      homeHref={hrefs[locale]}
      localeHrefs={hrefs}
      currentPath={HOME_PATH}
      login={false}
      currency={currencyEnabled ? selected : false}
      onCurrency={choose}
    />
  );
  // SiteNav's on-image tone lists both `sticky` and `absolute` in one class string and the stylesheet lets
  // `sticky` win, so the bar would sit in the flow above the hero instead of over it (measured 2026-10-03:
  // position sticky, 61px). components/ui/nav.tsx is plan 02's; until it is fixed there, the over-the-hero
  // bar is taken out of the flow here. The docked planner takes over from it once the hero has scrolled away.
  return tone === "on-image" ? <div className="absolute inset-x-0 top-0 z-40">{nav}</div> : nav;
}

export function HomeFrame({
  locale,
  links,
  labels,
  footerCopy,
  currencyEnabled,
  children,
}: {
  locale: Locale;
  /** Destinations, Experiences, About, Contact, already localised. The nav and the footer use the same four. */
  links: NavLink[];
  labels: Partial<NavLabels>;
  footerCopy: FooterCopy;
  currencyEnabled: boolean;
  children: ReactNode;
}) {
  const hrefs = localeHrefsOf(HOME_PATH);
  return (
    <>
      <HomeNav locale={locale} links={links} labels={labels} currencyEnabled={currencyEnabled} />
      {children}
      <SiteFooter
        copy={footerCopy}
        links={links}
        contact={SITE_CONTACT}
        languageLinks={(["en", "ar", "es"] as const).map((l) => ({
          label: LANGUAGE_NAMES[l],
          href: hrefs[l],
          lang: l,
          current: l === locale,
        }))}
        newsletter={false}
      />
      <WhatsApp />
    </>
  );
}
