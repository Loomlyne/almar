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

type StoredChoice = NonNullable<ReturnType<typeof parseJourneyChoice>>;

/**
 * The initial destination as the bar can show it: kept only when it is a known id (one the bar lists). A post tagged
 * with a destination that has no published stay would otherwise make Where look set while Search matches nothing.
 */
function knownInitial(initialDestinationId: string | null | undefined, known: (id: string) => boolean): string | null {
  return initialDestinationId != null && known(initialDestinationId) ? initialDestinationId : null;
}

/** The state of the first render, on the server and in the browser: the empty default, Where pre-filled when known. */
export function initialState(
  initialDestinationId: string | null | undefined,
  known: (id: string) => boolean,
): JourneyChoiceState {
  return { value: { ...EMPTY_JOURNEY, destinationId: knownInitial(initialDestinationId, known) }, guestsSet: false };
}

/**
 * The state after restoring a stored choice. With a known initial destination it stays (When and Who come from storage);
 * without one, the stored destination is kept only when it is a known id. Exported for tests/journey-choice-initial.test.mjs.
 */
export function restoreState(
  stored: StoredChoice | null,
  initialDestinationId: string | null | undefined,
  known: (id: string) => boolean,
): JourneyChoiceState {
  const initial = knownInitial(initialDestinationId, known);
  if (!stored) return initialState(initial, known);
  const storedDestination = stored.destination_id != null && known(stored.destination_id) ? stored.destination_id : null;
  return {
    value: {
      destinationId: initial ?? storedDestination,
      start: stored.from ? parseDate(stored.from) : null,
      end: stored.to ? parseDate(stored.to) : null,
      adults: stored.adults,
      children: stored.children,
      infants: stored.infants,
    },
    guestsSet: stored.guests_set,
  };
}

const Context = createContext<JourneyChoiceContext | null>(null);

export function JourneyChoiceProvider({
  destinationSlugById,
  initialDestinationId,
  children,
}: {
  /** The bar's destination id mapped to the slug the list page filters on. */
  destinationSlugById: Record<string, string>;
  /** Pre-fills Where on the server and on the first client render when the bar lists it (an unlisted id is ignored); the visitor can change it. Nothing is stored until they do. */
  initialDestinationId?: string | null;
  children: ReactNode;
}) {
  const slugs = useRef(destinationSlugById);
  const known = useCallback((id: string) => Object.hasOwn(slugs.current, id), []);
  const [state, setState] = useState<JourneyChoiceState>(() => initialState(initialDestinationId, known));
  const latest = useRef(state);

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
    if (!choice) {
      try {
        window.sessionStorage.removeItem(JOURNEY_CHOICE_KEY);
      } catch {
        // Nothing to do.
      }
      return;
    }
    try {
      const restored = restoreState(choice, initialDestinationId, known);
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
