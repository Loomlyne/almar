import { HOME_COPY } from "../../../lib/copy/home";
import { siteHref, type Locale } from "../../../lib/locale-path";
import type { PublicFrameLink } from "../../site/public-frame";

/** The four pages the header and footer link to, localised (the Framer ones stay English-only through siteHref). */
const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: "/about" },
  { key: "contact", path: "/contact" },
] as const;

export function blogFrameLinks(locale: Locale): { nav: typeof HOME_COPY.en.nav; links: PublicFrameLink[] } {
  const nav = HOME_COPY[locale].nav;
  return { nav, links: PAGE_LINKS.map(({ key, path }) => ({ label: nav[key], href: siteHref(locale, path) })) };
}
