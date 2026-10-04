"use client";

import { CurrencyChoiceProvider } from "../../../components/pages/home/currency-choice";
import { HomeJourneys, type HomeTier } from "../../../components/pages/home/home-journeys";
import { HomeFrame } from "../../../components/pages/home/home-nav";
import { HOME_COPY } from "../../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../../lib/copy/home-page";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import type { Scenes, SceneContext } from "../scene-types";
import { harnessHref } from "./_images";

// The priced tiers with the currency control in the header (plan 03.3-04 Task 3). The three price texts are
// the published ones from lib/copy/home.ts, never typed here. Fixed rates so the spec can compute every
// expected text from lib/fx/rates.ts with the same numbers.

const RATES = { aed: 3.6725, eur: 0.92, date: "2026-10-01" };
const SLUGS = ["explorer", "resident", "sovereign"];

function tiers(ctx: SceneContext): HomeTier[] {
  return HOME_COPY[ctx.locale].journeys.map((tier, index) => ({
    slug: SLUGS[index],
    name: tier.name,
    price_label: tier.price,
    tagline: tier.text,
    duration_label: null,
    ideal_for_label: null,
    ideal_for: null,
    body: null,
    is_featured: index === 1,
    image: { src: tier.src, alt: tier.alt, width: null, height: null },
  }));
}

function Scene({ ctx, rates }: { ctx: SceneContext; rates: typeof RATES | null }) {
  const nav = HOME_COPY[ctx.locale].nav;
  const links = [
    { label: nav.destinations, href: harnessHref(ctx.locale, "nav-destinations") },
    { label: nav.experiences, href: harnessHref(ctx.locale, "nav-experiences") },
    { label: nav.about, href: harnessHref(ctx.locale, "nav-about") },
    { label: nav.contact, href: harnessHref(ctx.locale, "nav-contact") },
  ];
  return (
    <CurrencyChoiceProvider>
      <div data-testid="harness-home-journeys" className="min-h-96 bg-ivory">
        <HomeFrame
          locale={ctx.locale}
          links={links}
          labels={{ ...nav, currencyNone: nav.currency }}
          footerCopy={SITE_FOOTER_COPY[ctx.locale]}
          currencyEnabled={rates !== null}
          tone="solid"
        >
          <main id="content" className="p-4">
            <HomeJourneys tiers={tiers(ctx)} rates={rates} copy={HOME_PAGE_COPY[ctx.locale].journeys} locale={ctx.locale} />
          </main>
        </HomeFrame>
      </div>
    </CurrencyChoiceProvider>
  );
}

export const scenes: Scenes = {
  rates: (ctx) => <Scene ctx={ctx} rates={RATES} />,
  "no-rates": (ctx) => <Scene ctx={ctx} rates={null} />,
};
