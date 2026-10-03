"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CURRENCY_CHOICE_KEY, parseCurrencyChoice } from "../../../lib/currency-choice";
import type { SelectedCurrency } from "../../../lib/fx/rates";

// The visitor's saved currency (owner answer 1, design 6.1): a browser choice in localStorage. No cookie, no
// URL parameter. The first render, on the server and in the browser, is "no choice yet" so the two agree;
// the saved value is read in an effect. A stored value that is not exactly AED, USD or EUR is ignored.

type CurrencyChoice = { selected: SelectedCurrency | null; choose: (next: SelectedCurrency) => void };

const Context = createContext<CurrencyChoice | null>(null);

export function CurrencyChoiceProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<SelectedCurrency | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(CURRENCY_CHOICE_KEY);
    } catch {
      // Storage blocked: the choice simply does not persist.
    }
    setSelected(parseCurrencyChoice(saved));
  }, []);

  const choose = useCallback((next: SelectedCurrency) => {
    const checked = parseCurrencyChoice(next);
    if (!checked) return;
    setSelected(checked);
    try {
      window.localStorage.setItem(CURRENCY_CHOICE_KEY, checked);
    } catch {
      // Storage blocked: the choice still applies on this page.
    }
  }, []);

  const value = useMemo(() => ({ selected, choose }), [selected, choose]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCurrencyChoice(): CurrencyChoice {
  const value = useContext(Context);
  if (!value) throw new Error("useCurrencyChoice needs a CurrencyChoiceProvider above it");
  return value;
}
