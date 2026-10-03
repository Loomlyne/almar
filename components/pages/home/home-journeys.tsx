"use client";

import { Amount } from "../../ui/amount";
import { Chip } from "../../ui/chip";
import { FactList } from "../../ui/fact-list";
import { Section } from "../../ui/section";
import { formatDate } from "../../../lib/format";
import type { FxRates } from "../../../lib/fx/rates";
import { useCurrencyChoice } from "./currency-choice";

// Choose Your Journey (design 1.1, 6.1). The three published prices are the owner's accepted text. Until a
// visitor picks a currency they print exactly as published; after that, and only that, the three prices
// move together through Amount with the build-time rates, and one line says which day's rates. Nothing
// else on the section changes. The rates travel as data attributes so a test can read the same numbers.

export type HomeTier = {
  slug: string;
  name: string;
  /** The published price text, never recomputed here. */
  price_label: string;
  tagline: string | null;
  duration_label: string | null;
  ideal_for_label: string | null;
  ideal_for: string | null;
  body: string | null;
  is_featured: boolean;
  image: { src: string; alt: string; width: number | null; height: number | null } | null;
};

function ratesLine(template: string, isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [before, after = ""] = template.split("{date}");
  return (
    <>
      {before}
      <bdi dir="ltr">{formatDate(day, month, year)}</bdi>
      {after}
    </>
  );
}

export function HomeJourneys({
  tiers,
  rates,
  copy,
  locale,
}: {
  tiers: HomeTier[];
  /** Read once when the site is built. Null when the feed was unreachable: prices print as published. */
  rates: FxRates | null;
  copy: { heading: string; intro: string; featured: string; ratesOf: string };
  locale: "en" | "ar" | "es";
}) {
  const { selected } = useCurrencyChoice();
  const fx = rates
    ? { "data-fx-date": rates.date, "data-fx-aed": String(rates.aed), "data-fx-eur": String(rates.eur) }
    : {};

  return (
    <div id="journeys" {...fx}>
      <Section heading={copy.heading} intro={copy.intro}>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {tiers.map((tier) => (
            <article key={tier.slug} className="grid min-w-0 content-start gap-4">
              {tier.image ? (
                <img
                  src={tier.image.src}
                  alt={tier.image.alt}
                  width={tier.image.width ?? undefined}
                  height={tier.image.height ?? undefined}
                  decoding="async"
                  className="block aspect-4/3 w-full object-cover outline outline-1 outline-line -outline-offset-1"
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="m-0 font-display text-title text-teal">{tier.name}</h3>
                {tier.is_featured ? (
                  <Chip interactive={false} size="dense">
                    {copy.featured}
                  </Chip>
                ) : null}
              </div>
              <p data-price={tier.slug} className="m-0 font-display text-title text-teal">
                <Amount text={tier.price_label} selected={selected} rates={rates} locale={locale} />
              </p>
              {tier.tagline ? <p className="m-0 text-body text-ink">{tier.tagline}</p> : null}
              {tier.duration_label ? <p className="m-0 text-label text-muted">{tier.duration_label}</p> : null}
              {tier.ideal_for_label && tier.ideal_for ? (
                <FactList items={[{ label: tier.ideal_for_label, value: tier.ideal_for }]} />
              ) : null}
              {tier.body ? <p className="m-0 text-label text-muted">{tier.body}</p> : null}
            </article>
          ))}
        </div>
        {selected && rates ? (
          <p data-testid="rates-line" aria-live="polite" className="m-0 text-label text-muted">
            {ratesLine(copy.ratesOf, rates.date)}
          </p>
        ) : null}
      </Section>
    </div>
  );
}
