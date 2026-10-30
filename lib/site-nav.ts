// The header and footer links (plan 06-02, CMS-09, F-15). Pure and client-safe: no Node import.
//
// The owner edits the links in Dashboard -> Content -> Navigation and footer (nav_links). At build,
// scripts/write-site-nav.mjs reads the published links and writes lib/data/site-nav.snapshot.json; the public header and
// footer read that file through navLinks(). Login, currency and language are never links here: SiteNav draws them in code,
// Login always last (SITE-01).
//
// NAV_TARGETS names EVERY internal page a link may point to, including pages later plans build (Plan with us and List
// with us 06-05, the five legal pages 06-04, each package 06-06), so no later plan edits this list. A link to a page that
// is not on the site yet is kept in the database and left out of the snapshot until targetAvailable() says it exists.

import { HOME_COPY } from "./copy/home";
import { LOCALES, localePath, type Locale } from "./locale-path";
import snapshot from "./data/site-nav.snapshot.json";

export type NavArea = "header" | "footer";
export type NavItem = { label: string; href: string; external?: true };
export type NavSnapshot = Record<NavArea, Record<Locale, NavItem[]>>;

type LegalPageKind = "privacy" | "terms" | "booking_terms" | "waiver" | "disclaimer";

type NavTarget =
  | { path: string; pattern: string }
  | { path: string; pattern: "/legal/[legal]"; legal: LegalPageKind };

/** Every internal key with its path and its PUBLIC_PAGES pattern (lib/locale-path.ts). `journey:<slug>` is a pattern. */
export const NAV_TARGETS = {
  home: { path: "/", pattern: "/" },
  "private-stays": { path: "/private-stays", pattern: "/private-stays" },
  destinations: { path: "/destinations", pattern: "/destinations" },
  experiences: { path: "/experiences", pattern: "/experiences" },
  about: { path: "/about", pattern: "/about" },
  contact: { path: "/contact", pattern: "/contact" },
  blog: { path: "/blog", pattern: "/blog" },
  "plan-with-us": { path: "/plan-with-us", pattern: "/plan-with-us" },
  "list-with-us": { path: "/list-with-us", pattern: "/list-with-us" },
  "legal-privacy": { path: "/legal/privacy", pattern: "/legal/[legal]", legal: "privacy" },
  "legal-terms": { path: "/legal/terms", pattern: "/legal/[legal]", legal: "terms" },
  "legal-booking-terms": { path: "/legal/booking-terms", pattern: "/legal/[legal]", legal: "booking_terms" },
  "legal-waiver": { path: "/legal/waiver", pattern: "/legal/[legal]", legal: "waiver" },
  "legal-disclaimer": { path: "/legal/disclaimer", pattern: "/legal/[legal]", legal: "disclaimer" },
} as const satisfies Record<string, NavTarget>;

export type NavTargetKey = keyof typeof NAV_TARGETS;
export const NAV_TARGET_KEYS = Object.keys(NAV_TARGETS) as NavTargetKey[];

/** A package link: `journey:<slug>` -> /journeys/<slug> (06-06). */
export const JOURNEY_PREFIX = "journey:";
const JOURNEY_PATTERN = "/journeys/[journey]";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isTargetKey(key: string): key is NavTargetKey {
  return Object.prototype.hasOwnProperty.call(NAV_TARGETS, key);
}

/** The journey slug of a `journey:<slug>` key, or null. */
export function journeySlug(key: string): string | null {
  if (!key.startsWith(JOURNEY_PREFIX)) return null;
  const slug = key.slice(JOURNEY_PREFIX.length);
  return SLUG.test(slug) ? slug : null;
}

/** True for a key the editor may save: a NAV_TARGETS key or `journey:<slug>`. */
export function isNavTarget(key: string): boolean {
  return isTargetKey(key) || journeySlug(key) !== null;
}

/** The English path of an internal key, or null for an unknown key. */
export function targetPath(key: string): string | null {
  if (isTargetKey(key)) return NAV_TARGETS[key].path;
  const slug = journeySlug(key);
  return slug === null ? null : `/journeys/${slug}`;
}

/** What the build has: its PUBLIC_PAGES, the legal kinds published in EN/AR/ES, the published package slugs. */
export type BuiltPages = { pages: readonly string[]; legal: readonly string[]; packages: readonly string[] };

/** Whether the page behind a key exists on the site. Only then is a link to it shown (and offered as live in the editor). */
export function targetAvailable(key: string, built: BuiltPages): boolean {
  if (isTargetKey(key)) {
    const target: NavTarget = NAV_TARGETS[key];
    if (!built.pages.includes(target.pattern)) return false;
    return "legal" in target ? built.legal.includes(target.legal) : true;
  }
  const slug = journeySlug(key);
  return slug !== null && built.pages.includes(JOURNEY_PATTERN) && built.packages.includes(slug);
}

/**
 * One link of the snapshot: an internal key gets its locale address (every page a link may reach exists in all three
 * languages once it is on the site, so the prefix is always right); an external https URL is kept and marked.
 */
export function navItem(locale: Locale, link: { link_kind: "internal" | "external"; target: string; label: string }): NavItem {
  if (link.link_kind === "external") return { label: link.label, href: link.target, external: true };
  const path = targetPath(link.target);
  if (path === null) throw new Error(`site-nav: unknown target ${JSON.stringify(link.target.slice(0, 80))}`);
  return { label: link.label, href: localePath(locale, path) };
}

/** Today's header (job 21's order) and footer (the same four, as before this plan), labelled from HOME_COPY. */
export const DEFAULT_LINKS: readonly NavTargetKey[] = ["destinations", "experiences", "about", "contact"];

export function defaultNavSnapshot(): NavSnapshot {
  const area = (): Record<Locale, NavItem[]> => {
    const out = {} as Record<Locale, NavItem[]>;
    for (const locale of LOCALES) {
      const labels = HOME_COPY[locale].nav;
      out[locale] = DEFAULT_LINKS.map((key) => navItem(locale, { link_kind: "internal", target: key, label: labels[key as keyof typeof labels] }));
    }
    return out;
  };
  return { header: area(), footer: area() };
}

/** The links of one area in one language, as baked at build. Never a Login item. */
export function navLinks(area: NavArea, locale: Locale): NavItem[] {
  return ((snapshot as NavSnapshot)[area]?.[locale] ?? []).map((item) => ({ ...item }));
}
