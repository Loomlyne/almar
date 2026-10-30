// lib/data/legal.ts (plan 06-04, Task 3)
//
// Server only. The owner's published legal pages and cookie banner words, read at build through the anon views (F-07).
// No legal or cookie text is written anywhere in the code: fixtures mode gives no rows, so a fixtures build has no legal
// page, no footer link and no banner. A kind counts only when its page is published and its English, Arabic and Spanish
// records are all published; a half-translated page has no address in any language (it never falls back to English,
// legal text is not shown in a language it was not published in).

import { LEGAL_PAGE_KINDS, LEGAL_SLUGS, legalPath, type LegalPageKind } from "../legal/kinds";
import type { StoredStatus } from "./resolve";
import { loadSource, readSource } from "./source";
import type { CookieBannerText, LegalKind, LegalPage, Locale, SiteLegalChrome, Timestamp, Uuid } from "./types";

export type { SiteLegalChrome };

type PageRow = { id: Uuid; kind: LegalKind; updated_at: Timestamp };
type TextBlock = { type: "heading" | "paragraph" | "quote"; text: string };
type TranslationRow = {
  page_id: Uuid;
  locale: Locale;
  status: StoredStatus;
  title: string | null;
  seo_title: string | null;
  seo_description: string | null;
  necessary_label: string | null;
  necessary_body: string | null;
  analytics_label: string | null;
  analytics_body: string | null;
  body: TextBlock[] | null;
};

const LOCALES: readonly Locale[] = ["en", "ar", "es"];

/** The page's three records when all are published, by locale; otherwise null. */
function publishedRecords(page: PageRow): Record<Locale, TranslationRow> | null {
  const rows = readSource<TranslationRow[]>("legal-page-translations").filter((t) => t.page_id === page.id && t.status === "published");
  const out = {} as Record<Locale, TranslationRow>;
  for (const locale of LOCALES) {
    const row = rows.find((t) => t.locale === locale);
    if (!row) return null;
    out[locale] = row;
  }
  return out;
}

/** The record's blocks in order; a block with no text in this language is not drawn. */
const blocksOf = (record: TranslationRow) => (record.body ?? []).filter((block): block is TextBlock => typeof block.text === "string" && block.text.trim() !== "");

const pageOf = (kind: LegalKind) => readSource<PageRow[]>("legal-pages").find((p) => p.kind === kind) ?? null;

/** The page kinds with an address, in footer order. */
export async function getPublishedLegalKinds(): Promise<LegalPageKind[]> {
  await loadSource();
  return LEGAL_PAGE_KINDS.filter((kind) => {
    const page = pageOf(kind);
    return page !== null && publishedRecords(page) !== null;
  });
}

export async function getLegalPage(locale: Locale, kind: LegalPageKind): Promise<LegalPage | null> {
  await loadSource();
  const page = pageOf(kind);
  const record = page ? publishedRecords(page)?.[locale] : null;
  if (!page || !record || !record.title) return null;
  return {
    id: page.id,
    kind,
    title: record.title,
    seo_title: record.seo_title,
    seo_description: record.seo_description,
    body: blocksOf(record),
    updated_at: page.updated_at,
    locale,
    translation_status: "published",
  };
}

/** The static params of /<locale>/legal/[legal]. */
export async function generateLegalParams(): Promise<{ legal: string }[]> {
  return (await getPublishedLegalKinds()).map((kind) => ({ legal: LEGAL_SLUGS[kind] }));
}

async function bannerText(locale: Locale): Promise<CookieBannerText | null> {
  const page = pageOf("cookie_banner");
  const record = page ? publishedRecords(page)?.[locale] : null;
  if (!record || !record.title || !record.necessary_label || !record.analytics_label) return null;
  return {
    title: record.title,
    body: blocksOf(record),
    necessary_label: record.necessary_label,
    necessary_body: record.necessary_body,
    analytics_label: record.analytics_label,
    analytics_body: record.analytics_body,
    locale,
    translation_status: "published",
  };
}

/** What every public page's frame needs: the footer's legal links, the banner's words, and where the banner links. */
export async function getSiteLegalChrome(locale: Locale): Promise<SiteLegalChrome> {
  await loadSource();
  const kinds = await getPublishedLegalKinds();
  const links: SiteLegalChrome["links"] = [];
  for (const kind of kinds) {
    const page = await getLegalPage(locale, kind);
    if (page) links.push({ label: page.title, href: legalPath(locale, kind) });
  }
  return { links, banner: await bannerText(locale), privacyHref: kinds.includes("privacy") ? legalPath(locale, "privacy") : null };
}
