"use client";

import { Amount } from "../../ui/amount";
import { CalendarIcon } from "../../icons/icons";
import { Divider } from "../../ui/divider";
import { Reveal } from "../../ui/reveal";
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
      <Divider />
      <Section variant="page" heading={copy.heading} intro={copy.intro}>
        <Reveal kind="row">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {tiers.map((tier, index) => (
              <article key={tier.slug} className="grid min-w-0 content-start border border-line bg-surface">
                <div className="relative">
                  {tier.image ? (
                    <img
                      src={tier.image.src}
                      alt={tier.image.alt}
                      width={tier.image.width ?? undefined}
                      height={tier.image.height ?? undefined}
                      decoding="async"
                      className="block aspect-48/35 w-full object-cover"
                    />
                  ) : null}
                  {tier.is_featured ? (
                    <span className="absolute end-4 top-4 bg-teal px-3 py-1 text-caption uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal">
                      {copy.featured}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-4 p-6">
                  <p className="m-0 text-caption text-teal">{String(index + 1).padStart(2, "0")}</p>
                  <h3 className="m-0 font-display text-heading text-teal">{tier.name}</h3>
                  <p data-price={tier.slug} className="m-0 text-label text-teal md:text-body">
                    <Amount text={tier.price_label} selected={selected} rates={rates} locale={locale} />
                  </p>
                  {tier.tagline ? <p className="m-0 text-body text-ink">{tier.tagline}</p> : null}
                  {tier.duration_label ? (
                    <p className="m-0 flex items-center gap-2 text-caption text-ink">
                      <CalendarIcon size={16} />
                      {tier.duration_label}
                    </p>
                  ) : null}
                  <div className="border-t border-line" />
                  {tier.ideal_for_label && tier.ideal_for ? (
                    <>
                      <p className="m-0 text-caption uppercase tracking-kicker text-teal ar:normal-case ar:tracking-normal">
                        {tier.ideal_for_label}
                      </p>
                      <p className="m-0 text-label text-ink">{tier.ideal_for}</p>
                    </>
                  ) : null}
                  {tier.body ? <p className="m-0 text-label text-muted">{tier.body}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </Reveal>
        {selected && rates ? (
          <p data-testid="rates-line" aria-live="polite" className="m-0 text-label text-muted">
            {ratesLine(copy.ratesOf, rates.date)}
          </p>
        ) : null}
      </Section>
      <Divider />
    </div>
  );
}
