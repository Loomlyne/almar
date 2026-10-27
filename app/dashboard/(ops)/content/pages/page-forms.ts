// The pure side of Content -> Pages (plan 06-02, CMS-07, F-09): a page section and an About card as form state, the
// save bodies of /api/ops/pages and /api/ops/page-items, the hero video rule and the live Arabic and Spanish fields for
// the kit editor. No React, no fetch, no directive.
//
// A section and a card are always on the site (no publish step): every language with text goes out published, and a
// sent Arabic or Spanish record carries its lock list as `locked_fields` (I18N-04: the server sets the list, it never
// merges).

import type { Locale3, MediaRef, PageItemDetail, PageSectionDetail } from "../../../../../components/ops/api-types";
import type { Fields, LiveFields, Target } from "../../../../../components/ops/auto-translate";
import { PAGE_SECTIONS, sectionSpec, type PageKey, type SectionSpec, type SectionTextColumn } from "../../../../../lib/data/page-sections";
import { locksOf, noLocks, type Locks } from "../../catalog/catalog-forms";

const TARGETS: readonly Target[] = ["ar", "es"];

/** One language of a section: its own text columns only; `paragraphs` is a list, every other column one string. */
export type SectionText = Partial<Record<SectionTextColumn, string | string[]>>;

export type SectionForm = {
  id: string;
  page: PageKey;
  section: string;
  shown: boolean;
  /** As typed; "" = none (sent as null). Hero sections only. */
  video: string;
  /** Slot -> photos in order (one at most on a single slot). */
  media: Record<string, MediaRef[]>;
  text: Record<Locale3, SectionText>;
  locked: Locks;
};

/** The section's spec (its columns, slots, video). A section the code does not know has none: the screen shows nothing. */
export function specOf(form: Pick<SectionForm, "page" | "section">): SectionSpec | undefined {
  return sectionSpec(form.page, form.section);
}

/** The page's main heading (its first section): always shown, by the owner's answer A (2026-10-27). */
export function isHero(page: PageKey, section: string): boolean {
  return PAGE_SECTIONS[page][0]?.section === section;
}

const isList = (column: SectionTextColumn) => column === "paragraphs";

function textOf(spec: SectionSpec, record: Partial<Record<string, unknown>> | null | undefined): SectionText {
  const out: SectionText = {};
  for (const column of spec.text) {
    const value = record?.[column];
    if (isList(column)) out[column] = Array.isArray(value) ? value.map(String) : [];
    else out[column] = typeof value === "string" ? value : "";
  }
  return out;
}

/** The form for a section as ops_get('page_section') answers it. */
export function sectionForm(detail: PageSectionDetail): SectionForm {
  const spec = sectionSpec(detail.page, detail.section);
  const text = (locale: Locale3) => (spec ? textOf(spec, detail.translations[locale]) : {});
  const media: Record<string, MediaRef[]> = {};
  for (const slot of spec?.media ?? []) media[slot.slot] = [...(detail.media[slot.slot] ?? [])];
  return {
    id: detail.id,
    page: detail.page,
    section: detail.section,
    shown: detail.is_shown,
    video: detail.video_url ?? "",
    media,
    text: { en: text("en"), ar: text("ar"), es: text("es") },
    locked: locksOf(detail.translations),
  };
}

/** The English as the kit reads it: a paragraph list keeps only its typed lines' order, empty lines included. */
export const englishFields = (text: SectionText): Fields => ({ ...text }) as Fields;

/** An https address the URL parser takes, with a host (the server's rule, CMS-06). "" is no video. */
export function videoOk(video: string): boolean {
  const value = video.trim();
  if (value === "") return true;
  if (!/^https:\/\/[^\s]+$/i.test(value) || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

const trimmed = (value: string | string[] | undefined, list: boolean): string | string[] | null => {
  if (list) {
    const items = (Array.isArray(value) ? value : []).map((item) => item.trim()).filter((item) => item !== "");
    return items.length > 0 ? items : null;
  }
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
};

type SentRecord = Record<string, string | string[] | null>;

/** One language's record of the section's columns; null when every column is empty (no record in that language). */
function sectionRecord(spec: SectionSpec, text: SectionText, english: boolean): SentRecord | null {
  const out: SentRecord = {};
  let any = false;
  for (const column of spec.text) {
    const value = trimmed(text[column], isList(column));
    out[column] = value;
    if (value !== null) any = true;
  }
  if (!english && !any) return null;
  out.status = "published";
  return out;
}

/** The locks of a target that name one of `columns` (the server refuses any other name). */
const locksFor = (locked: Locks, target: Target, columns: readonly string[]) => locked[target].filter((field) => columns.includes(field));

export type SectionRefusal = "video_url";

/**
 * The body of POST /api/ops/pages, or the field the screen refuses before any request. Every slot of the section is
 * sent (each replaced whole), the video only on a section that takes one, Show on site only where the owner may hide the
 * section (never on the page's main heading, answer A).
 */
export function sectionPayload(form: SectionForm): { ok: true; body: Record<string, unknown> } | { ok: false; field: SectionRefusal } {
  const spec = specOf(form);
  if (!spec) return { ok: true, body: { id: form.id } };
  if (spec.video && !videoOk(form.video)) return { ok: false, field: "video_url" };
  const body: Record<string, unknown> = { id: form.id };
  if (!isHero(form.page, form.section)) body.is_shown = form.shown;
  if (spec.video) body.video_url = form.video.trim() === "" ? null : form.video.trim();
  if (spec.media.length > 0) {
    body.media = Object.fromEntries(spec.media.map((slot) => [slot.slot, (form.media[slot.slot] ?? []).slice(0, slot.many ? undefined : 1).map((m) => m.id)]));
  }
  const translations: Record<string, SentRecord | null> = { en: sectionRecord(spec, form.text.en, true) };
  for (const target of TARGETS) {
    const record = sectionRecord(spec, form.text[target], false);
    if (record) record.locked_fields = locksFor(form.locked, target, spec.text);
    translations[target] = record;
  }
  body.translations = translations;
  return { ok: true, body };
}

/**
 * The Arabic and Spanish handed back by the kit's Save, put into the form, with the kit's lock lists. A paragraph list
 * comes back as a list; a single column as one string.
 */
export function sectionWithTranslations(form: SectionForm, translations: Record<Target, Fields>, locked: Locks): SectionForm {
  const spec = specOf(form);
  if (!spec) return form;
  const pick = (target: Target): SectionText => {
    const out: SectionText = { ...form.text[target] };
    for (const column of spec.text) {
      const value = translations[target][column];
      if (value === undefined) continue;
      if (isList(column)) out[column] = Array.isArray(value) ? value : value === null ? [] : value.split("\n");
      else out[column] = Array.isArray(value) ? value.join(" ") : (value ?? "");
    }
    return out;
  };
  return { ...form, text: { ...form.text, ar: pick("ar"), es: pick("es") }, locked: { ar: [...locked.ar], es: [...locked.es] } };
}

const hasText = (value: string | string[] | undefined) => (Array.isArray(value) ? value.some((item) => item.trim() !== "") : (value ?? "").trim() !== "");

/** The Arabic and Spanish columns on the site now (a section is always live): every saved column with text. */
export function liveSectionFields(saved: Pick<SectionForm, "page" | "section" | "text">): LiveFields {
  const spec = specOf(saved);
  const live: LiveFields = {};
  for (const target of TARGETS) live[target] = (spec?.text ?? []).filter((column) => hasText(saved.text[target][column]));
  return live;
}

// ---- About cards ------------------------------------------------------------------------------------------------------

export type CardText = { title: string; body: string };
export const CARD_TEXT_FIELDS = ["title", "body"] as const;

export type CardForm = {
  id: string | null;
  sectionId: string;
  /** Kept as stored; a new card gets one from its English title on its first Save (never shown, never public). */
  slug: string;
  shown: boolean;
  image: MediaRef | null;
  text: Record<Locale3, CardText>;
  locked: Locks;
};

const blankCard = (): CardText => ({ title: "", body: "" });

export function emptyCardForm(sectionId: string): CardForm {
  return { id: null, sectionId, slug: "", shown: true, image: null, text: { en: blankCard(), ar: blankCard(), es: blankCard() }, locked: noLocks() };
}

export function cardForm(detail: PageItemDetail): CardForm {
  const text = (locale: Locale3): CardText => ({ title: detail.translations[locale]?.title ?? "", body: detail.translations[locale]?.body ?? "" });
  return {
    id: detail.id,
    sectionId: detail.section_id,
    slug: detail.slug,
    shown: detail.is_shown,
    image: detail.image,
    text: { en: text("en"), ar: text("ar"), es: text("es") },
    locked: locksOf(detail.translations),
  };
}

/**
 * A card's slug for the server (lowercase letters, numbers and dashes, at most 80): the English title folded to ASCII,
 * plus a short tail so two cards with one title never clash. It is a row key, never a public address.
 */
export function cardSlug(title: string, tail: string = Math.random().toString(36).slice(2, 6)): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  const safeTail = tail.toLowerCase().replace(/[^a-z0-9]/g, "") || "card";
  return `${base || "card"}-${safeTail}`;
}

function cardRecord(text: CardText, english: boolean): SentRecord | null | undefined {
  const title = text.title.trim();
  const body = text.body.trim();
  if (!english && title === "" && body === "") return null;
  // The server needs a title in a record: a language with text but no title stays as it is.
  if (!english && title === "") return undefined;
  return { title, body: body === "" ? null : body, status: "published" };
}

/** The `save` body of /api/ops/page-items. A new card sends its section and a slug; an English title is needed. */
export function cardPayload(form: CardForm): { ok: true; body: Record<string, unknown> } | { ok: false; field: "title" } {
  if (form.text.en.title.trim() === "") return { ok: false, field: "title" };
  const body: Record<string, unknown> = { action: "save" };
  if (form.id !== null) body.id = form.id;
  else {
    body.section_id = form.sectionId;
    body.slug = form.slug || cardSlug(form.text.en.title);
  }
  body.media_id = form.image?.id ?? null;
  body.is_shown = form.shown;
  const translations: Record<string, SentRecord | null> = { en: cardRecord(form.text.en, true) as SentRecord };
  for (const target of TARGETS) {
    const record = cardRecord(form.text[target], false);
    if (record) record.locked_fields = locksFor(form.locked, target, CARD_TEXT_FIELDS);
    if (record !== undefined) translations[target] = record;
  }
  body.translations = translations;
  return { ok: true, body };
}

export function cardWithTranslations(form: CardForm, translations: Record<Target, Fields>, locked: Locks): CardForm {
  const pick = (target: Target): CardText => {
    const out = { ...form.text[target] };
    for (const field of CARD_TEXT_FIELDS) {
      const value = translations[target][field];
      if (value === undefined) continue;
      out[field] = Array.isArray(value) ? value.join(" ") : (value ?? "");
    }
    return out;
  };
  return { ...form, text: { ...form.text, ar: pick("ar"), es: pick("es") }, locked: { ar: [...locked.ar], es: [...locked.es] } };
}

/** A shown card's saved Arabic and Spanish fields with text are on the site; a hidden card has none live. */
export function liveCardFields(shown: boolean, saved: Record<Locale3, CardText>): LiveFields {
  if (!shown) return {};
  const live: LiveFields = {};
  for (const target of TARGETS) live[target] = CARD_TEXT_FIELDS.filter((field) => saved[target][field].trim() !== "");
  return live;
}
