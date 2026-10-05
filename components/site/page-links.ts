import { siteHref, type Locale } from "../../lib/locale-path";

/** The four pages the header and footer link to. Today they are English-only Framer pages (siteHref keeps them so). */
export const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: "/about" },
  { key: "contact", path: "/contact" },
] as const;

type NavLabelSet = Record<(typeof PAGE_LINKS)[number]["key"], string>;

/** The four header links, labelled from the nav copy and addressed in this language. */
export function pageLinks(locale: Locale, nav: NavLabelSet): { label: string; href: string }[] {
  return PAGE_LINKS.map(({ key, path }) => ({ label: nav[key], href: siteHref(locale, path) }));
}
