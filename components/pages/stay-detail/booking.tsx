"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getLocalTimeZone, today as todayFn } from "@internationalized/date";
import { JourneyBar } from "../../journey/journey-bar";
import { JourneyEntry, JourneySheet, type SheetStep } from "../../journey/journey-sheet";
import type { Destination, JourneyCopy, JourneyValue, Locale } from "../../journey/types";
import { AlertCircleIcon, WhatsAppIcon } from "../../icons/icons";
import { LinkButton } from "../../ui/button";
import { StickyDock } from "../../ui/sticky-dock";
import type { IsoDate } from "../../../lib/data/types";
import { stayRequestHref, buildStayRequestMessage, type StayRequestCopy } from "../../../lib/whatsapp-request";
import {
  JOURNEY_CHOICE_KEY,
  choiceFromValue,
  parseJourneyChoice,
  serializeJourneyChoice,
} from "../../../lib/journey-choice";
import { tripHref } from "../../../lib/booking/trip-link";
import { isoOf } from "../../../lib/journey-choice";
import { BookLink } from "./book-link";
import { dockLines, initialStayValue, toCalendarDates } from "./booking-value";

// The stay page's one client island (plan 03.3-06). It holds the bar's value for three views of it: the
// four-segment bar (from the md breakpoint), the phone entry row with its sheet, and the sticky dock. The
// final submit is held (design 4.3 row 1): no onSearch is passed anywhere, so there is no Search button and no form.
// The one action is now the pair Book + Request on WhatsApp (plan 04-03, B-01, Q-02 signed 2026-10-25): StayActions at
// the end of the bar, of the sheet's last step and in the dock. Book links to /<locale>/booking/trip with the bar's
// dates and guests (a button that asks for the dates while one is missing); Request on WhatsApp is the outline button
// beside it, built from the bar's value. Props are plain strings, numbers and ISO dates: no Stay
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
  /** The wa.me link for the current dates and guests, and the words around it. */
  requestHref: string;
  requestLabel: string;
  requestNewTab: string;
  /** The trip page for the bar's dates and guests, or null while a date is missing. */
  bookHref: string | null;
  /** Book without dates: opens the dates (the sheet below md, the Dates panel from md) and shows the line. */
  askDates: () => void;
  /** Book was pressed without dates (the needDates line shows until both dates exist). */
  askedDates: boolean;
  sheet: { open: boolean; step: SheetStep };
  setSheet: (next: { open: boolean; step: SheetStep } | ((current: { open: boolean; step: SheetStep }) => { open: boolean; step: SheetStep })) => void;
};

/** What the island needs to build the request: plain strings only, never a Stay. */
export type StayRequestProps = {
  /** The page's own absolute address in its language. */
  pageUrl: string;
  copy: StayRequestCopy;
  /** The button's label. */
  label: string;
  /** The screen-reader suffix of a link that opens a new tab. */
  opensNote: string;
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
  staySlug,
  destinationSlug,
  destinationName,
  title,
  blockedDates,
  copy,
  sampleNote,
  request,
  initialSheet,
  children,
}: {
  locale: Locale;
  /** The stay's slug, for the Book link (a string: still no Stay object and no price on the client). */
  staySlug: string;
  destinationSlug: string;
  destinationName: string;
  title: string;
  blockedDates: IsoDate[];
  copy: JourneyCopy;
  /** The footnote line under the bar while the blocked dates are examples; null when they are real. */
  sampleNote: string | null;
  request: StayRequestProps;
  /** Harness only: start with the phone sheet open on a step. */
  initialSheet?: { open: boolean; step: SheetStep };
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

  const { pageUrl, copy: requestCopy, label: requestLabel, opensNote: requestNewTab } = request;
  // The link follows the bar's value: dates and guests change the message, never the page.
  const requestHref = useMemo(
    () =>
      stayRequestHref(
        buildStayRequestMessage(
          {
            locale,
            title,
            destinationName,
            start: value.start ? { year: value.start.year, month: value.start.month, day: value.start.day } : null,
            end: value.end ? { year: value.end.year, month: value.end.month, day: value.end.day } : null,
            adults: value.adults,
            children: value.children,
            infants: value.infants,
            pageUrl,
          },
          requestCopy,
          { nights: copy.dates.nights, guests: copy.guests.summary },
        ),
      ),
    [locale, title, destinationName, value, pageUrl, requestCopy, copy],
  );

  // The sheet's state lives here so the dock's Book can open it (it used to be the bar's own).
  const [sheet, setSheet] = useState<{ open: boolean; step: SheetStep }>(initialSheet ?? { open: false, step: 2 });
  const [askedDates, setAskedDates] = useState(false);

  const bookHref = useMemo(
    () =>
      value.start && value.end
        ? tripHref(locale, {
            stay: staySlug,
            from: isoOf(value.start),
            to: isoOf(value.end),
            adults: value.adults,
            children: value.children,
            infants: value.infants,
          })
        : null,
    [locale, staySlug, value],
  );

  const askDates = useCallback(() => {
    setAskedDates(true);
    // The breakpoint where this file swaps `hidden md:block` and `md:hidden`.
    if (!window.matchMedia("(min-width: 768px)").matches) {
      setSheet({ open: true, step: 2 });
      return;
    }
    document.querySelector<HTMLButtonElement>('[data-bar-segment="when"] button')?.click();
  }, []);

  const state = useMemo<StayBookingState>(
    () => ({
      locale,
      title,
      destinationName,
      copy,
      destinations,
      blocked,
      value,
      change,
      sampleNote,
      requestHref,
      requestLabel,
      requestNewTab,
      bookHref,
      askDates,
      askedDates,
      sheet,
      setSheet,
    }),
    [
      locale,
      title,
      destinationName,
      copy,
      destinations,
      blocked,
      value,
      change,
      sampleNote,
      requestHref,
      requestLabel,
      requestNewTab,
      bookHref,
      askDates,
      askedDates,
      sheet,
    ],
  );
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

/**
 * Request on WhatsApp: always live, opens wa.me in a new tab with the message for the bar's current dates and guests.
 * "bar" sits at the end of the four-segment bar, "sheet" at the end of the phone sheet's last step, "dock" in the
 * pinned dock (the icon alone below md; the accessible name is the same).
 */
export function StayRequestLink({
  size,
  variant = "primary",
}: {
  size: "bar" | "sheet" | "dock";
  variant?: "primary" | "secondary";
}) {
  const s = useStay();
  return (
    <LinkButton
      href={s.requestHref}
      variant={variant}
      target="_blank"
      rel="noopener noreferrer"
      size={size === "bar" ? "bar-auto" : size === "sheet" ? "lg" : "md"}
      className={size === "sheet" ? "w-full whitespace-normal px-3 text-center tracking-normal" : undefined}
    >
      <WhatsAppIcon size={20} aria-hidden="true" />
      <span className={size === "dock" ? "sr-only md:not-sr-only" : undefined}>{s.requestLabel}</span>
      <span className="sr-only"> {s.requestNewTab}</span>
    </LinkButton>
  );
}

/**
 * Book, then Request on WhatsApp (outline). "bar": side by side at the end of the bar; "sheet": stacked full width on
 * the sheet's last step, Book first, so each label fits the phone width; "dock": Book and the WhatsApp icon.
 */
export function StayActions({ size }: { size: "bar" | "sheet" | "dock" }) {
  const s = useStay();
  return (
    <div className={size === "sheet" ? "flex w-full flex-col gap-3" : "flex shrink-0 items-center gap-2"}>
      <BookLink href={s.bookHref} size={size} label={s.copy.book.label} onAskDates={s.askDates} />
      <StayRequestLink size={size} variant="secondary" />
    </div>
  );
}

/**
 * The bar. From the md breakpoint it is the four-segment bar (Destination and Stay locked, Dates and Guests
 * open); below it, the one-row entry that opens the three-step sheet. The CSS hides the one that is not in use.
 */
export function StayBookingBar() {
  const s = useStay();
  const { sheet, setSheet } = s;
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
          action={<StayActions size="bar" />}
        />
        {s.askedDates && !s.bookHref ? (
          <p role="alert" className="m-0 mt-3 inline-flex items-center gap-3 bg-surface px-4 py-3 text-label text-error shadow-lg">
            <AlertCircleIcon size={20} className="shrink-0" />
            <span>{s.copy.book.needDates}</span>
          </p>
        ) : null}
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
        finalAction={<StayActions size="sheet" />}
        finalActionStacked
      />
      {s.sampleNote ? <p className="m-0 pt-3 text-label text-ivory">{s.sampleNote}</p> : null}
    </div>
  );
}

/** The pinned summary: the stay, then the dates and guests, live from the bar and the sheet; its controls are Book and the request link. */
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
      action={<StayActions size="dock" />}
    />
  );
}
