// The legal page kinds and their addresses (plan 06-04, F-07). A leaf: only lib/locale-path.ts, so the assembler, the data
// readers, the footer and Phase 4's checkout can all import it. `cookie_banner` is a legal kind in the database but never
// a page: it has no slug and no address. The URL word `legal` is the owner's to sign with the pictures; if he signs
// another, this file and the five legal paths in lib/site-nav.ts NAV_TARGETS change, nothing else.

import { localePath, type Locale } from "../locale-path";

/** Footer and route order. */
export const LEGAL_PAGE_KINDS = ["privacy", "terms", "booking_terms", "waiver", "disclaimer"] as const;
export type LegalPageKind = (typeof LEGAL_PAGE_KINDS)[number];

export const LEGAL_SLUGS: Record<LegalPageKind, string> = {
  privacy: "privacy",
  terms: "terms",
  booking_terms: "booking-terms",
  waiver: "waiver",
  disclaimer: "disclaimer",
};

export function legalPath(locale: Locale, kind: LegalPageKind): string {
  return localePath(locale, `/legal/${LEGAL_SLUGS[kind]}`);
}

/** The kind a slug names; null for anything else, `cookie-banner` included. */
export function legalKindFromSlug(slug: string): LegalPageKind | null {
  return LEGAL_PAGE_KINDS.find((kind) => LEGAL_SLUGS[kind] === slug) ?? null;
}
