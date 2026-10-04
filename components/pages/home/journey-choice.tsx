"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import type { JourneyValue } from "../../journey/types";
import {
  JOURNEY_CHOICE_KEY,
  choiceFromValue,
  isoOf,
  parseJourneyChoice,
  serializeJourneyChoice,
} from "../../../lib/journey-choice";

// The hero bar's Where / When / Who, held once for the whole home page and kept in sessionStorage so it
// survives a reload and the trip to the list page (design 4.2). The bar's Search reads this value and goes to the
// stays list with it as a query (lib/journey-choice.ts searchHref); nothing on the home filters by it any more.
//
// First render, on the server and in the browser, is the bar's empty default, so the two agree; the saved
// value is read in an effect. A stored value that is malformed, impossible or already in the past is dropped,
// never an error. ISO strings become CalendarDate values here and nowhere else.

export const EMPTY_JOURNEY: JourneyValue = {
  destinationId: null,
  start: null,
  end: null,
  adults: 1,
  children: 0,
  infants: 0,
};

type JourneyChoiceState = { value: JourneyValue; guestsSet: boolean };

type JourneyChoiceContext = {
  value: JourneyValue;
  /** True once the Who step was changed: only then do guests become a filter. */
  guestsSet: boolean;
  setValue: (next: JourneyValue) => void;
};

const Context = createContext<JourneyChoiceContext | null>(null);

export function JourneyChoiceProvider({
  destinationSlugById,
  children,
}: {
  /** The bar's destination id mapped to the slug the list page filters on. */
  destinationSlugById: Record<string, string>;
  children: ReactNode;
}) {
  const [state, setState] = useState<JourneyChoiceState>({ value: EMPTY_JOURNEY, guestsSet: false });
  const latest = useRef(state);
  const slugs = useRef(destinationSlugById);

  // Once, on mount: restore what this tab saved.
  useEffect(() => {
    let text: string | null = null;
    try {
      text = window.sessionStorage.getItem(JOURNEY_CHOICE_KEY);
    } catch {
      // Storage blocked: nothing to restore.
    }
    if (text === null) return;
    const choice = parseJourneyChoice(text, isoOf(today(getLocalTimeZone())));
    const known = choice?.destination_id != null && Object.hasOwn(slugs.current, choice.destination_id);
    if (!choice) {
      try {
        window.sessionStorage.removeItem(JOURNEY_CHOICE_KEY);
      } catch {
        // Nothing to do.
      }
      return;
    }
    try {
      const restored: JourneyChoiceState = {
        value: {
          destinationId: known ? choice.destination_id : null,
          start: choice.from ? parseDate(choice.from) : null,
          end: choice.to ? parseDate(choice.to) : null,
          adults: choice.adults,
          children: choice.children,
          infants: choice.infants,
        },
        guestsSet: choice.guests_set,
      };
      latest.current = restored;
      setState(restored);
    } catch {
      // An ISO string that parseDate refuses is dropped with the rest.
    }
  }, []);

  const setValue = useCallback((next: JourneyValue) => {
    const prev = latest.current;
    const touched =
      next.adults !== prev.value.adults || next.children !== prev.value.children || next.infants !== prev.value.infants;
    const nextState: JourneyChoiceState = { value: next, guestsSet: prev.guestsSet || touched };
    latest.current = nextState;
    setState(nextState);
    try {
      window.sessionStorage.setItem(
        JOURNEY_CHOICE_KEY,
        serializeJourneyChoice(choiceFromValue(nextState.value, nextState.guestsSet)),
      );
    } catch {
      // Storage blocked: the choice still applies on this page.
    }
  }, []);

  const context = useMemo(
    () => ({ value: state.value, guestsSet: state.guestsSet, setValue }),
    [state, setValue],
  );
  return <Context.Provider value={context}>{children}</Context.Provider>;
}

export function useJourneyChoice(): JourneyChoiceContext {
  const value = useContext(Context);
  if (!value) throw new Error("useJourneyChoice needs a JourneyChoiceProvider above it");
  return value;
}
