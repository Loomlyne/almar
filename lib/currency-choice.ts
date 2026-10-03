// The visitor's saved currency (owner answer 1, design 6.1): a browser choice, never in the address.
//
// Pure: no imports but a type, no `window`/`localStorage` access, no React. Node tests load it directly.
// The client provider (components/pages/home/currency-choice.tsx) owns the actual storage read and write.
//
// A stored value is untrusted (a tab can edit it): anything that is not exactly one of the three codes is
// rejected as null, never repaired and never rendered.

import type { SelectedCurrency } from "./fx/rates";

/** The localStorage key. One value for the whole site, so it survives a language switch (I18N-02). */
export const CURRENCY_CHOICE_KEY = "almar-currency";

/** "AED" | "USD" | "EUR" -> itself. Anything else (null, "", "aed", "GBP", "AED ") -> null. */
export function parseCurrencyChoice(value: string | null | undefined): SelectedCurrency | null {
  return value === "AED" || value === "USD" || value === "EUR" ? value : null;
}
