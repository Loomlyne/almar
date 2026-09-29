import { DASHBOARD_COPY } from "./dashboard";
import { FRAMER_SOURCE_COPY } from "./framer-source";
import { GUEST_COPY } from "./guest";
import { HOME_COPY } from "./home";

export type Locale = "en" | "ar" | "es";

/**
 * One catalog, one object per locale: copy[locale].home / .guest / .dashboard / .framerSource.
 * Plan 10 adds `.journey` (lib/copy/journey.ts) here and to the parity test in tests/copy.test.mjs.
 */
export const copy = {
  en: {
    home: HOME_COPY.en,
    guest: GUEST_COPY.en,
    dashboard: DASHBOARD_COPY.en,
    framerSource: FRAMER_SOURCE_COPY.en,
  },
  ar: {
    home: HOME_COPY.ar,
    guest: GUEST_COPY.ar,
    dashboard: DASHBOARD_COPY.ar,
    framerSource: FRAMER_SOURCE_COPY.ar,
  },
  es: {
    home: HOME_COPY.es,
    guest: GUEST_COPY.es,
    dashboard: DASHBOARD_COPY.es,
    framerSource: FRAMER_SOURCE_COPY.es,
  },
} as const satisfies Record<Locale, unknown>;
