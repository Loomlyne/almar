import { navLinks, type NavItem } from "../../lib/site-nav";
import type { Locale } from "../../lib/locale-path";

/**
 * The four pages the header and footer linked to before the Navigation editor (plan 06-02). Kept for callers that still
 * name them; the links themselves now come from the nav snapshot (lib/data/site-nav.snapshot.json, CMS-09).
 */
export const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: "/about" },
  { key: "contact", path: "/contact" },
] as const;

type NavLabelSet = Record<(typeof PAGE_LINKS)[number]["key"], string>;

/**
 * The header links the owner set in Content -> Navigation and footer, in this language, as baked at build (the snapshot
 * is bundled JSON, so a page the Worker draws shows the same links as the static build). The signature is unchanged;
 * the labels are the snapshot's (`nav` is no longer read). Login, currency and language are drawn by the header itself.
 */
export function pageLinks(locale: Locale, nav?: NavLabelSet): NavItem[] {
  void nav;
  return navLinks("header", locale);
}

/** The footer links the owner set, in this language. */
export function footerPageLinks(locale: Locale): NavItem[] {
  return navLinks("footer", locale);
}
