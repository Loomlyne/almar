import { HOME_COPY } from "../../../lib/copy/home";
import type { Locale } from "../../../lib/locale-path";
import { pageLinks } from "../../site/page-links";
import type { PublicFrameLink } from "../../site/public-frame";

/** The header links the owner set in Content -> Navigation and footer (plan 06-02), with the nav labels. */
export function blogFrameLinks(locale: Locale): { nav: typeof HOME_COPY.en.nav; links: PublicFrameLink[] } {
  const nav = HOME_COPY[locale].nav;
  return { nav, links: pageLinks(locale, nav) };
}
