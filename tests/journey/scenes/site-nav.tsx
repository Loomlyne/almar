"use client";

import type { ReactNode } from "react";

import { useState } from "react";
import { SiteNav } from "../../../components/ui/nav";
import type { Scenes, SceneContext } from "../scene-types";
import { harnessHref } from "./_images";

const links = (locale: string) =>
  ["destinations", "experiences", "about", "contact"].map((name) => ({
    label: `[${name}]`,
    href: harnessHref(locale, `nav-${name}`),
  }));

const localeHrefs = {
  en: harnessHref("en"),
  ar: harnessHref("ar"),
  es: harnessHref("es"),
};

const frame = (node: ReactNode) => (
  <div data-testid="harness-nav" className="min-h-96 bg-ivory">
    {node}
    <main id="content" className="p-4">
      [Page content]
    </main>
  </div>
);

function CurrencyNav({ ctx }: { ctx: SceneContext }) {
  const [currency, setCurrency] = useState<"AED" | "USD" | "EUR" | null>(null);
  return frame(
    <SiteNav
      locale={ctx.locale}
      links={links(ctx.locale)}
      localeHrefs={localeHrefs}
      currentPath={links(ctx.locale)[0].href}
      currency={currency}
      onCurrency={setCurrency}
    />,
  );
}

export const scenes: Scenes = {
  // Today's output: no new props. The four anchors, the first one current, Login, currency AED.
  defaults: (ctx: SceneContext) => frame(<SiteNav locale={ctx.locale} onLocale={() => undefined} />),
  // A real page: links, home, address-based language switch, no Login, no currency, current page.
  page: (ctx: SceneContext) =>
    frame(
      <SiteNav
        locale={ctx.locale}
        links={links(ctx.locale)}
        homeHref={harnessHref(ctx.locale, "home")}
        localeHrefs={localeHrefs}
        currentPath={links(ctx.locale)[0].href}
        login={false}
        currency={false}
      />,
    ),
  // The page is not one of the nav links (a stay page): nothing is current.
  "not-in-nav": (ctx: SceneContext) =>
    frame(
      <SiteNav
        locale={ctx.locale}
        links={links(ctx.locale)}
        localeHrefs={localeHrefs}
        currentPath="/private-stays/some-stay"
        login={false}
        currency={false}
      />,
    ),
  // A page with an amount: currency present with no choice yet; Login stays.
  "currency-none": (ctx: SceneContext) => <CurrencyNav ctx={ctx} />,
};
