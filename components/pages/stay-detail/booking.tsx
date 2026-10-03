"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getLocalTimeZone, today as todayFn } from "@internationalized/date";
import { JourneyBar } from "../../journey/journey-bar";
import { JourneyEntry, JourneySheet, type SheetStep } from "../../journey/journey-sheet";
import type { Destination, JourneyCopy, JourneyValue, Locale } from "../../journey/types";
import { StickyDock } from "../../ui/sticky-dock";
import type { IsoDate } from "../../../lib/data/types";
import {
  JOURNEY_CHOICE_KEY,
  choiceFromValue,
  parseJourneyChoice,
  serializeJourneyChoice,
} from "../../../lib/journey-choice";
import { dockLines, initialStayValue, toCalendarDates } from "./booking-value";

// The stay page's one client island (plan 03.3-06). It holds the bar's value for three views of it: the
// four-segment bar (from the md breakpoint), the phone entry row with its sheet, and the sticky dock. The
// final submit is held until Phase 4 (design 4.3 row 1): no onSearch is passed anywhere, so there is no
// Search button, no form, and the sheet ends in Done. Props are plain strings, numbers and ISO dates: no Stay
// object is ever handed to the client, so no price field can reach the page payload.

type StayBookingState = {
  locale: Locale;
  title: string;
  destinationName: string;
  copy: JourneyCopy;
  destinations: Destination[];
  blocked: ReturnType<typeof toCalendarDates>;
  value: JourneyValue;
  change: (next: JourneyValue) => void;
  sampleNote: string | null;
};

const Context = createContext<StayBookingState | null>(null);

function useStay(): StayBookingState {
  const state = useContext(Context);
  if (!state) throw new Error("the stay booking parts must sit inside <StayBooking>");
  return state;
}

function readStored(): ReturnType<typeof parseJourneyChoice> {
  try {
    return parseJourneyChoice(window.sessionStorage.getItem(JOURNEY_CHOICE_KEY));
  } catch {
    // Storage can be off (private mode, blocked cookies). The page works without it.
    return null;
  }
}

function writeStored(value: JourneyValue, guestsSet: boolean) {
  try {
    window.sessionStorage.setItem(JOURNEY_CHOICE_KEY, serializeJourneyChoice(choiceFromValue(value, guestsSet)));
  } catch {
    // Same as above: nothing to do.
  }
}

export function StayBooking({
  locale,
  destinationSlug,
  destinationName,
  title,
  blockedDates,
  copy,
  sampleNote,
  children,
}: {
  locale: Locale;
  destinationSlug: string;
  destinationName: string;
  title: string;
  blockedDates: IsoDate[];
  copy: JourneyCopy;
  /** The footnote line under the bar while the blocked dates are examples; null when they are real. */
  sampleNote: string | null;
  children: ReactNode;
}) {
  const blocked = useMemo(() => toCalendarDates(blockedDates), [blockedDates]);
  const destinations = useMemo<Destination[]>(
    () => [{ id: destinationSlug, name: destinationName, shortLine: "" }],
    [destinationSlug, destinationName],
  );
  // The first render is the default value, so the server HTML and the first client render match; the stored
  // choice from another page is applied right after mount.
  const [value, setValue] = useState<JourneyValue>(() =>
    initialStayValue(null, { destinationSlug, blocked }, todayFn(getLocalTimeZone())),
  );
  const guestsSet = useRef(false);

  useEffect(() => {
    const stored = readStored();
    if (!stored) return;
    guestsSet.current = stored.guests_set;
    setValue(initialStayValue(stored, { destinationSlug, blocked }, todayFn(getLocalTimeZone())));
  }, [destinationSlug, blocked]);

  const change = useCallback(
    (next: JourneyValue) => {
      if (
        next.adults !== value.adults ||
        next.children !== value.children ||
        next.infants !== value.infants
      ) {
        guestsSet.current = true;
      }
      setValue(next);
      writeStored(next, guestsSet.current);
    },
    [value],
  );

  const state = useMemo<StayBookingState>(
    () => ({ locale, title, destinationName, copy, destinations, blocked, value, change, sampleNote }),
    [locale, title, destinationName, copy, destinations, blocked, value, change, sampleNote],
  );
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

/**
 * The bar. From the md breakpoint it is the four-segment bar (Destination and Stay locked, Dates and Guests
 * open); below it, the one-row entry that opens the three-step sheet. The CSS hides the one that is not in use.
 */
export function StayBookingBar() {
  const s = useStay();
  const [sheet, setSheet] = useState<{ open: boolean; step: SheetStep }>({ open: false, step: 2 });
  const lines = dockLines(s.value, { destinationName: s.destinationName, title: s.title }, s.copy, s.locale);

  return (
    <div>
      <div className="hidden md:block">
        <JourneyBar
          size="hero"
          destinations={s.destinations}
          value={s.value}
          onChange={s.change}
          copy={s.copy}
          locale={s.locale}
          lockDestination
          lockStay={{ label: s.copy.steps.stay, value: s.title }}
          blockedDates={s.blocked}
        />
      </div>
      <div className="md:hidden">
        <JourneyEntry
          variant="stay"
          value={s.value}
          destinations={s.destinations}
          onOpen={(step) => setSheet({ open: true, step })}
          copy={s.copy}
          locale={s.locale}
          stayLine={lines.line1}
        />
      </div>
      <JourneySheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        initialStep={sheet.step}
        destinations={s.destinations}
        value={s.value}
        onChange={s.change}
        copy={s.copy}
        locale={s.locale}
        lockDestination
        blockedDates={s.blocked}
      />
      {s.sampleNote ? <p className="m-0 pt-3 text-label text-ivory">{s.sampleNote}</p> : null}
    </div>
  );
}

/** The pinned summary: the stay, then the dates and guests, live from the bar and the sheet. No button, no link. */
export function StayBookingDock() {
  const s = useStay();
  const lines = dockLines(s.value, { destinationName: s.destinationName, title: s.title }, s.copy, s.locale);
  return (
    <StickyDock
      summary={
        <>
          <span className="truncate text-body text-ink">{lines.line1}</span>
          <span className="truncate text-label text-muted">{lines.line2}</span>
        </>
      }
    />
  );
}
