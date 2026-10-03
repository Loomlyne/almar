"use client";

import { MediaCard } from "../../ui/card";
import { Link } from "../../ui/link";
import { ResultCount } from "../../ui/result-count";
import { Section } from "../../ui/section";
import { formatPlural, type PluralForms } from "../../../lib/journey-format";
import { filterStays, toStayQuery } from "../../../lib/data/stay-filter";
import type { Stay } from "../../../lib/data/types";
import { useJourneyChoice } from "./journey-choice";

// The Private Stays section (design 1.1, 4.2). It is the visible result of the hero bar: pick a destination
// or a party size and the cards and the count change under the bar, on the same screen. The filter is the
// one implementation the server uses (lib/data/stay-filter.ts). View All Private Stays carries the same
// choice to the list page as a query string, recomputed on every change.

/** What a card needs. A full Stay satisfies the filter's half of this. */
export type HomeStayCard = Pick<
  Stay,
  "slug" | "title" | "destination_slug" | "destination_name" | "neighborhood" | "max_guests" | "bedrooms"
> & {
  href: string;
  /** The one muted line: neighbourhood and guests, as published. */
  detail: string;
  image: { src: string; alt: string };
};

/** The live home shows three cards. */
const SHOWN = 3;

export function HomeStays({
  stays,
  listHref,
  copy,
  locale,
}: {
  /** Every published stay, in the owner's order. The first three are the live home's three cards. */
  stays: HomeStayCard[];
  /** This locale's list page, without a query. */
  listHref: string;
  copy: { kicker: string; heading: string; intro: string; viewAll: string; count: PluralForms };
  locale: "en" | "ar" | "es";
}) {
  const { query } = useJourneyChoice();
  const matches = filterStays(stays, { destination: query.destination, guests: query.guests });
  const queryString = toStayQuery(query);
  const href = queryString ? `${listHref}?${queryString}` : listHref;

  return (
    <Section
      id="stays"
      kicker={copy.kicker}
      heading={copy.heading}
      intro={copy.intro}
      action={<Link href={href}>{copy.viewAll}</Link>}
    >
      <ResultCount text={formatPlural(copy.count, matches.length, locale)} />
      {matches.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-8 p-0 md:grid-cols-2 xl:grid-cols-3">
          {matches.slice(0, SHOWN).map((stay) => (
            <li key={stay.slug} className="min-w-0">
              <MediaCard href={stay.href} image={stay.image} title={stay.title} detail={stay.detail} />
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}
