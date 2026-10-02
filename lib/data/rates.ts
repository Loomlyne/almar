// lib/data/rates.ts
//
// The single read path for money. Read at build time by each page's server component and passed down as a
// prop. Wraps loadRates() in lib/fx/rates.ts (public currency feed, cached 12 hours). Returns null when the
// feed is unreachable; the page then prints the published strings unchanged.

import { loadRates, type FxRates, type SelectedCurrency } from "../fx/rates";

export async function getRates(): Promise<FxRates | null> {
  try {
    return await loadRates();
  } catch {
    return null;
  }
}

export type { SelectedCurrency };
