"use client";

import { useId, useState } from "react";
import { JourneyBar } from "../../journey/journey-bar";
import { JourneyEntry, JourneySheet, type SheetStep } from "../../journey/journey-sheet";
import type { Destination, JourneyCopy, JourneyValue, Locale } from "../../journey/types";
import { BackgroundMedia } from "../../ui/background-media";
import { Divider } from "../../ui/divider";
import { PageShell } from "../../ui/page-shell";
import { Reveal } from "../../ui/reveal";
import { searchHref } from "../../../lib/journey-choice";
import { useJourneyChoice } from "../home/journey-choice";

// The post hero (design 13, owner's v4): the cover photo full-bleed, everything centred on it: kicker, a gold rule, the
// h1, a gold rule, date, reading time and tag, then the journey planner with a working Search, then the published
// sentence. The wiring is the home hero's (components/pages/home/home-hero.tsx, job 11): Where -> When -> Who -> Search;
// the bar and the sheet draw their own missing-step states and call `onSearch` only when a destination and both dates
// are set, which sends the visitor to the stays list with the query the list reads (lib/journey-choice.ts searchHref).
// At and above `md` the full bar, below it the phone entry row and the three-step sheet. The docked planner is the
// home's alone and is not built here. Must sit inside a JourneyChoiceProvider.

export type PostHeroCover = { src: string; alt: string };

export function PostHero({
  kicker,
  title,
  date,
  readingTime,
  tag,
  cover,
  intro,
  destinations,
  destinationSlugById,
  listHref,
  journeyCopy,
  locale,
  barLabel,
}: {
  kicker: string;
  title: string;
  date: string;
  readingTime: string;
  /** The destination's name; none when the post has no destination. */
  tag: string | null;
  cover: PostHeroCover | null;
  /** The published sentence under the bar. */
  intro: string;
  destinations: Destination[];
  /** The bar's destination id mapped to the slug the list page filters on. */
  destinationSlugById: Record<string, string>;
  /** This locale's stays list, without a query. Search lands here. */
  listHref: string;
  journeyCopy: JourneyCopy;
  locale: Locale;
  /** The accessible name of the region that holds the planner. */
  barLabel: string;
}) {
  const { value, setValue } = useJourneyChoice();
  const headingId = useId();
  const [sheet, setSheet] = useState<{ open: boolean; step: SheetStep }>({ open: false, step: 1 });

  const openSheet = (step: SheetStep) => setSheet({ open: true, step });
  // The bar and the sheet call this only when a destination and both dates are set; the address is built here, once.
  const search = (next: JourneyValue) => {
    const href = searchHref(listHref, next, destinationSlugById);
    if (href) window.location.assign(href);
  };

  return (
    <>
      <section
        aria-labelledby={headingId}
        className="relative isolate flex min-h-180 flex-col justify-center overflow-hidden bg-teal py-16 text-ivory md:min-h-svh"
      >
        <div data-scroll="fade" className="absolute inset-0 -z-20">
          <Reveal kind="photo" className="absolute inset-0">
            <BackgroundMedia poster={cover} videoUrl={null} />
          </Reveal>
        </div>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-b from-ink/55 via-ink/30 to-ink/60" />

        <PageShell className="grid justify-items-center gap-8 pt-16 text-center">
          <Reveal kind="headline" className="grid w-full justify-items-center gap-6">
            <p className="m-0 text-caption uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal">{kicker}</p>
            <Divider className="w-36" />
            <h1 id={headingId} className="m-0 max-w-4xl font-display text-hero tracking-display text-ivory text-balance">
              {title}
            </h1>
            <Divider className="w-36" />
            <p className="m-0 flex flex-wrap items-center justify-center gap-3 text-label text-ivory">
              <span>{date}</span>
              <span aria-hidden="true">·</span>
              <span>{readingTime}</span>
              {tag ? <span className="inline-flex h-chip items-center border border-ivory px-4 text-label">{tag}</span> : null}
            </p>
          </Reveal>
          <Reveal kind="bar" className="grid w-full justify-items-center gap-6">
            <div role="region" aria-label={barLabel} className="w-full">
              <div className="hidden md:block">
                <JourneyBar
                  size="hero"
                  destinations={destinations}
                  value={value}
                  onChange={setValue}
                  onSearch={search}
                  copy={journeyCopy}
                  locale={locale}
                />
              </div>
              <div className="md:hidden">
                <JourneyEntry
                  variant="entry"
                  value={value}
                  destinations={destinations}
                  onOpen={openSheet}
                  copy={journeyCopy}
                  locale={locale}
                />
              </div>
            </div>
            <p className="m-0 max-w-prose text-body text-ivory">{intro}</p>
          </Reveal>
        </PageShell>
      </section>

      <JourneySheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        initialStep={sheet.step}
        destinations={destinations}
        value={value}
        onChange={setValue}
        onSearch={search}
        copy={journeyCopy}
        locale={locale}
      />
    </>
  );
}
