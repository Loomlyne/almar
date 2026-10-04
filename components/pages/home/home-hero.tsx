"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { JourneyBar } from "../../journey/journey-bar";
import { JourneyEntry, JourneySheet, type SheetStep } from "../../journey/journey-sheet";
import type { Destination, JourneyCopy, JourneyValue, Locale } from "../../journey/types";
import { BackgroundMedia } from "../../ui/background-media";
import { PageShell } from "../../ui/page-shell";
import { Reveal } from "../../ui/reveal";
import { searchHref } from "../../../lib/journey-choice";
import { useJourneyChoice } from "./journey-choice";

// The home hero (11-DESIGN section 1, owner answer 1): the photo full-bleed (the poster, or the muted looping video once
// the owner has put one on the media host), the h1 centred, and under it the journey planner with Search.
// Where -> When -> Who -> Search. Search needs a destination and both dates: the bar and the sheet draw their own
// missing-step states and call `onSearch` only when everything is there, which sends the visitor to the stays list
// with the same query the list reads (lib/journey-choice.ts searchHref). At and above Tailwind `md` the full bar,
// below it the phone entry row and the three-step sheet; both are rendered and the CSS shows one. With JavaScript off
// the hero is slice 1's: the bar is shown as served and everything is visible (no separate form, lead's call).

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
  videoUrl,
  destinations,
  destinationSlugById,
  listHref,
  journeyCopy,
  locale,
  barLabel,
}: {
  headline: string;
  poster: HeroPoster | null;
  /** The media-host URL of the hero video, or null until the owner uploads it. */
  videoUrl: string | null;
  destinations: Destination[];
  /** The bar's destination id mapped to the slug the list page filters on. */
  destinationSlugById: Record<string, string>;
  /** This locale's list page, without a query. Search lands here. */
  listHref: string;
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
  // The bar and the sheet call this only when a destination and both dates are set; the address is built here, once.
  const search = (next: JourneyValue) => {
    const href = searchHref(listHref, next, destinationSlugById);
    if (href) window.location.assign(href);
  };

  return (
    <>
      <section
        aria-labelledby={headingId}
        className="relative isolate flex min-h-svh flex-col justify-center overflow-hidden bg-teal py-16 text-ivory"
      >
        <div data-scroll="fade" className="absolute inset-0 -z-20">
          <Reveal kind="photo" className="absolute inset-0">
            <BackgroundMedia poster={poster ? { src: poster.src, alt: poster.alt } : null} videoUrl={videoUrl} />
          </Reveal>
        </div>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-b from-ink/55 via-ink/15 to-ink/60" />

        <PageShell className="grid justify-items-center gap-8 text-center">
          <Reveal kind="headline">
            <h1 id={headingId} className="m-0 max-w-4xl font-display text-hero tracking-display text-ivory text-balance">
              {headline}
            </h1>
          </Reveal>
          <Reveal kind="bar" className="w-full">
            <div ref={planner} role="region" aria-label={barLabel}>
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
          </Reveal>
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
            onSearch={search}
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
        onSearch={search}
        copy={journeyCopy}
        locale={locale}
      />
    </>
  );
}
