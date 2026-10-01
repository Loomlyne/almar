import { DASHBOARD_COPY } from "./dashboard";
import { FRAMER_SOURCE_COPY } from "./framer-source";
import { GUEST_COPY } from "./guest";
import { HOME_COPY } from "./home";
import { JOURNEY_COPY } from "./journey";

export type Locale = "en" | "ar" | "es";

/**
 * One catalog, one object per locale: copy[locale].home / .guest / .dashboard / .framerSource / .journey.
 * `.journey` is lib/copy/journey.ts (plan 03.1-10).
 */
export const copy = {
  en: {
    home: HOME_COPY.en,
    guest: GUEST_COPY.en,
    dashboard: DASHBOARD_COPY.en,
    framerSource: FRAMER_SOURCE_COPY.en,
    journey: JOURNEY_COPY.en,
  },
  ar: {
    home: HOME_COPY.ar,
    guest: GUEST_COPY.ar,
    dashboard: DASHBOARD_COPY.ar,
    framerSource: FRAMER_SOURCE_COPY.ar,
    journey: JOURNEY_COPY.ar,
  },
  es: {
    home: HOME_COPY.es,
    guest: GUEST_COPY.es,
    dashboard: DASHBOARD_COPY.es,
    framerSource: FRAMER_SOURCE_COPY.es,
    journey: JOURNEY_COPY.es,
  },
} as const satisfies Record<Locale, unknown>;
