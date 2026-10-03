"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { JourneyBar } from "../../journey/journey-bar";
import { JourneyEntry, JourneySheet, type SheetStep } from "../../journey/journey-sheet";
import type { Destination, JourneyCopy, Locale } from "../../journey/types";
import { PageShell } from "../../ui/page-shell";
import { useJourneyChoice } from "./journey-choice";

// The home hero (design 1.1, 4.2): the poster picture, the h1, and the journey planner with NO submit.
// Where -> When -> Who all work; the choice has its result under the bar (the Private Stays section) and in
// View All Private Stays. At and above Tailwind `md` (48rem, the one breakpoint app/globals.css already uses;
// reconcile R-6) the full bar, below it the phone entry row and the three-step sheet. Both are rendered and
// the CSS shows one, so the served HTML is right at every width with no script. Neither the bar nor the sheet
// is given a search handler, so neither draws a Search control (design 4.3 row 1).

export type HeroPoster = { src: string; alt: string; width: number | null; height: number | null };

/** True once the element has left the viewport. False on the server and on the first client render. */
function useOutOfView(ref: RefObject<HTMLElement | null>): boolean {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setGone(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return gone;
}

export function HomeHero({
  headline,
  poster,
  destinations,
  journeyCopy,
  locale,
  barLabel,
}: {
  headline: string;
  poster: HeroPoster | null;
  destinations: Destination[];
  journeyCopy: JourneyCopy;
  locale: Locale;
  /** The accessible name of the region that holds the planner. */
  barLabel: string;
}) {
  const { value, setValue } = useJourneyChoice();
  const headingId = useId();
  // The planner's wrapper: the docked bar and the docked row appear once it has scrolled out of view.
  const planner = useRef<HTMLDivElement>(null);
  const plannerGone = useOutOfView(planner);
  const [sheet, setSheet] = useState<{ open: boolean; step: SheetStep }>({ open: false, step: 1 });

  const openSheet = (step: SheetStep) => setSheet({ open: true, step });

  return (
    <>
      <section aria-labelledby={headingId} className="relative isolate flex min-h-svh flex-col justify-end bg-teal text-ivory">
        {poster ? (
          <img
            src={poster.src}
            alt={poster.alt}
            width={poster.width ?? undefined}
            height={poster.height ?? undefined}
            decoding="async"
            className="absolute inset-0 -z-20 block size-full object-cover"
          />
        ) : null}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-b from-ink/55 via-ink/15 to-ink/60" />

        <PageShell className="grid gap-12 pb-12 md:pb-16">
          <h1 id={headingId} className="m-0 max-w-4xl font-display text-hero tracking-display text-ivory text-balance">
            {headline}
          </h1>
          <div ref={planner} role="region" aria-label={barLabel}>
            <div className="hidden md:block">
              <JourneyBar
                size="hero"
                destinations={destinations}
                value={value}
                onChange={setValue}
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
        </PageShell>
      </section>

      {/* Docked, once the planner has scrolled away: the slim bar from md up, the slim row below it. */}
      <div className="fixed inset-x-0 top-0 z-40 hidden md:block">
        <PageShell>
          <JourneyBar
            size="docked"
            destinations={destinations}
            value={value}
            onChange={setValue}
            copy={journeyCopy}
            locale={locale}
            sentinelRef={planner}
          />
        </PageShell>
      </div>
      {plannerGone ? (
        <div className="fixed inset-x-0 top-0 z-40 md:hidden">
          <JourneyEntry
            variant="docked"
            value={value}
            destinations={destinations}
            onOpen={openSheet}
            copy={journeyCopy}
            locale={locale}
          />
        </div>
      ) : null}

      <JourneySheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        initialStep={sheet.step}
        destinations={destinations}
        value={value}
        onChange={setValue}
        copy={journeyCopy}
        locale={locale}
      />
    </>
  );
}
