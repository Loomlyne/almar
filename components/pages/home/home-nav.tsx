"use client";

import type { ReactNode } from "react";
import type { FooterCopy } from "../../ui/footer";
import type { NavLabels, NavLink } from "../../ui/nav";
import { PublicFrame } from "../../site/public-frame";
import type { Locale } from "../../../lib/locale-path";
import { useCurrencyChoice } from "./currency-choice";

// The home page's chrome: the one PublicFrame (nav, footer, WhatsApp; every held control off), with the nav's
// currency select bound to the visitor's saved choice. That choice is the state the three journey prices read
// (CurrencyChoiceProvider, above this component), so the select and the prices always agree and picking AED
// as the first choice is a real change (reconcile R-8). The bar lies over the hero (tone "on-image");
// the docked planner takes over from it once the hero has scrolled away.

const HOME_PATH = "/";

export function HomeFrame({
  locale,
  links,
  labels,
  footerCopy,
  currencyEnabled,
  tone = "on-image",
  children,
}: {
  locale: Locale;
  /** Destinations, Experiences, About, Contact, already localised. The nav and the footer use the same four. */
  links: NavLink[];
  labels: Partial<NavLabels>;
  footerCopy: FooterCopy;
  /** False when the build had no exchange rates: with nothing to convert there is no currency control. */
  currencyEnabled: boolean;
  tone?: "solid" | "on-image";
  children: ReactNode;
}) {
  const { selected, choose } = useCurrencyChoice();
  return (
    <PublicFrame
      locale={locale}
      currentPath={HOME_PATH}
      links={links}
      footerLinks={links}
      footerCopy={footerCopy}
      labels={labels}
      navTone={tone}
      currency={currencyEnabled ? { selected, onChange: choose } : false}
    >
      {children}
    </PublicFrame>
  );
}
