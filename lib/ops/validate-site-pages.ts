// Plan 06-02: the request validators of /api/ops/pages, /api/ops/page-items and /api/ops/nav. Same house style as
// validate-catalog.ts: each returns the clean body or throws OpsInvalid(field, locale) on the first bad value. Caps are
// the SQL checks of migration 20261025120000_site_cms.sql (page_section_translations, page_item_translations,
// nav_link_translations, ops_save_nav). What depends on the section itself (its text columns, its photo slots, whether
// it takes a video) is checked by the handler once it has read the section: see checkSectionSave.

import { PAGE_KEYS, PAGE_SECTIONS, type PageKey, type SectionSpec } from "../data/page-sections";
import { isNavTarget } from "../site-nav";
import type { NavLinkBody, PageItemsBody, SaveNavBody, SavePageSectionBody } from "./site-cms-api";
import { OpsInvalid } from "./route-core";
import {
  bool,
  has,
  onlyKeys,
  record,
  slug,
  translations,
  uuid,
  uuidList,
  uuidOrNull,
  type TextSpec,
  type TranslationsPayload,
} from "./validate";

const SHORT = { kind: "text", max: 300 } as const;
const LONG = { kind: "text", max: 5000 } as const;

/** page_section_translations: every column; no field is required (a section uses a subset). */
export const PAGE_SECTION_TEXT: TextSpec = {
  required: [],
  fields: {
    kicker: SHORT,
    heading: SHORT,
    headline: SHORT,
    intro: LONG,
    body: LONG,
    statement: LONG,
    salutation: SHORT,
    paragraphs: { kind: "list", max: 5000 },
    sign_off: SHORT,
    signer: SHORT,
    signer_role: SHORT,
    cta_label: SHORT,
  },
};

/** page_item_translations: the card's title (required) and text. */
export const PAGE_ITEM_TEXT: TextSpec = { required: ["title"], fields: { title: SHORT, body: LONG } };

/** nav_link_translations: the label, at most 80 characters. */
export const NAV_LINK_TEXT: TextSpec = { required: ["label"], fields: { label: { kind: "text", max: 80 } } };

/** paragraphs: text[] check (cardinality(paragraphs) <= 20). */
const MAX_PARAGRAPHS = 20;
const HTTPS = /^https:\/\/[^\s]+$/;
const SLOT = /^[a-z]+(_[a-z]+)*$/;
const MAX_LINKS = 20;

/** An https address of at most `max` characters, trimmed; anything else (http, mailto, javascript…) is refused. */
function httpsUrl(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new OpsInvalid(field);
  const out = value.trim();
  if ([...out].length > max || !HTTPS.test(out)) throw new OpsInvalid(field);
  return out;
}

function paragraphsCap(value: TranslationsPayload): void {
  for (const [locale, rec] of Object.entries(value)) {
    const list = rec?.paragraphs;
    if (Array.isArray(list) && list.length > MAX_PARAGRAPHS) throw new OpsInvalid(`translations.${locale}.paragraphs`, locale as "en");
  }
}

// ---- GET ?page= ----------------------------------------------------------------------------------------------------

/** `?page=` absent: the five pages; present: one of them; `?id=`: one section. */
export function parsePagesQuery(query: URLSearchParams): { page: PageKey | null; id: string | null } {
  const page = query.get("page");
  const id = query.get("id");
  if (page !== null && !(PAGE_KEYS as readonly string[]).includes(page)) throw new OpsInvalid("page");
  return { page: page as PageKey | null, id: id === null ? null : uuid(id, "id") };
}

// ---- POST /api/ops/pages -------------------------------------------------------------------------------------------

export function parsePageSave(value: unknown): SavePageSectionBody {
  const body = record(value, "body");
  onlyKeys(body, ["id", "is_shown", "video_url", "media", "translations"]);
  const out: SavePageSectionBody = { id: uuid(body.id, "id") };
  if (has(body, "is_shown")) out.is_shown = bool(body.is_shown, "is_shown");
  if (has(body, "video_url")) {
    const raw = body.video_url;
    out.video_url = raw === null || (typeof raw === "string" && raw.trim() === "") ? null : httpsUrl(raw, "video_url", 500);
  }
  if (has(body, "media")) {
    const media = record(body.media, "media");
    const slots: Record<string, string[]> = {};
    for (const [slot, ids] of Object.entries(media)) {
      if (!SLOT.test(slot) || slot.length > 40) throw new OpsInvalid("media");
      slots[slot] = uuidList(ids, `media.${slot}`, { max: 50 });
    }
    out.media = slots;
  }
  if (has(body, "translations")) {
    const text = translations(body.translations, PAGE_SECTION_TEXT, { create: false });
    paragraphsCap(text);
    out.translations = text as SavePageSectionBody["translations"];
  }
  return out;
}

/**
 * The checks that need the section (page, section) the id belongs to: only that section's text columns (and locks on
 * them), only its photo slots with one photo on a single slot, a video address only on a section that takes one, and
 * (when the owner keeps heroes fixed) a hero cannot be hidden. `hero`: the section is its page's main heading, the first
 * section of the page in PAGE_SECTIONS (Contact's is `title`, review of 57cb4cc0). Sending is_shown: true on a hero is
 * harmless and accepted; only false is refused.
 */
export function isPageHero(page: PageKey, section: string): boolean {
  return PAGE_SECTIONS[page][0]?.section === section;
}

export function checkSectionSave(body: SavePageSectionBody, spec: SectionSpec, { heroFixed, hero }: { heroFixed: boolean; hero: boolean }): void {
  const columns = new Set<string>(spec.text);
  for (const [locale, rec] of Object.entries(body.translations ?? {})) {
    if (!rec) continue;
    for (const [key, item] of Object.entries(rec)) {
      if (key === "status") continue;
      if (key === "locked_fields") {
        if (Array.isArray(item) && item.some((name) => !columns.has(String(name)))) throw new OpsInvalid(`translations.${locale}.locked_fields`, locale as "ar");
        continue;
      }
      if (!columns.has(key)) throw new OpsInvalid(`translations.${locale}.${key}`, locale as "en");
    }
  }
  for (const [slot, ids] of Object.entries(body.media ?? {})) {
    const rule = spec.media.find((m) => m.slot === slot);
    if (!rule || (!rule.many && ids.length > 1)) throw new OpsInvalid(`media.${slot}`);
  }
  if (has(body, "video_url") && !spec.video) throw new OpsInvalid("video_url");
  if (heroFixed && hero && body.is_shown === false) throw new OpsInvalid("is_shown");
}

// ---- POST /api/ops/page-items --------------------------------------------------------------------------------------

export function parsePageItemAction(value: unknown): PageItemsBody {
  const body = record(value, "body");
  const kind = body.action;
  if (kind === "delete") {
    onlyKeys(body, ["action", "id"]);
    return { action: "delete", id: uuid(body.id, "id") };
  }
  if (kind === "reorder") {
    onlyKeys(body, ["action", "section_id", "ids"]);
    return { action: "reorder", section_id: uuid(body.section_id, "section_id"), ids: uuidList(body.ids, "ids", { min: 1, max: 100 }) };
  }
  if (kind !== "save") throw new OpsInvalid("action");
  onlyKeys(body, ["action", "id", "section_id", "slug", "media_id", "is_shown", "translations"]);
  const create = body.id === undefined || body.id === null;
  const out: Extract<PageItemsBody, { action: "save" }> = { action: "save" };
  if (!create) out.id = uuid(body.id, "id");
  if (has(body, "section_id")) out.section_id = uuid(body.section_id, "section_id");
  else if (create) throw new OpsInvalid("section_id");
  if (has(body, "slug")) out.slug = slug(body.slug, "slug");
  else if (create) throw new OpsInvalid("slug");
  if (has(body, "media_id")) out.media_id = uuidOrNull(body.media_id, "media_id");
  if (has(body, "is_shown")) out.is_shown = bool(body.is_shown, "is_shown");
  if (has(body, "translations")) {
    out.translations = translations(body.translations, PAGE_ITEM_TEXT, { create }) as typeof out.translations;
  } else if (create) {
    throw new OpsInvalid("translations.en", "en");
  }
  return out;
}

// ---- POST /api/ops/nav ---------------------------------------------------------------------------------------------

/**
 * A link's labels, with error paths that name the link (links.3.translations.en.label, as post blocks do). A link has no
 * publish flag of its own, so English is always sent as published: the build leaves out a link with no published
 * English label, and a new row would otherwise default to draft (review of 57cb4cc0).
 */
function linkTranslations(value: unknown, path: string, create: boolean): NavLinkBody["translations"] {
  let out: NavLinkBody["translations"];
  try {
    out = translations(value, NAV_LINK_TEXT, { create }) as NavLinkBody["translations"];
  } catch (error) {
    if (error instanceof OpsInvalid) throw new OpsInvalid(`${path}.${error.field}`, error.locale);
    throw error;
  }
  const en = out.en as (Record<string, unknown> & { status?: string }) | null | undefined;
  if (en) en.status = "published";
  return out;
}

function navLink(value: unknown, path: string): NavLinkBody {
  const link = record(value, path);
  onlyKeys(link, ["id", "is_shown", "link_kind", "target", "translations"], `${path}.`);
  const kind = link.link_kind;
  if (kind !== "internal" && kind !== "external") throw new OpsInvalid(`${path}.link_kind`);
  let target: string;
  if (kind === "external") {
    target = httpsUrl(link.target, `${path}.target`, 500);
  } else {
    // A page key of lib/site-nav.ts or journey:<slug>. A page not on the site yet is accepted: it is saved and left out
    // of the public header and footer until it exists. Login is never a link (it is drawn in code, always last).
    if (typeof link.target !== "string" || link.target.length > 120 || !isNavTarget(link.target)) throw new OpsInvalid(`${path}.target`);
    target = link.target;
  }
  const create = link.id === undefined || link.id === null;
  const out: NavLinkBody = {
    is_shown: has(link, "is_shown") ? bool(link.is_shown, `${path}.is_shown`) : true,
    link_kind: kind,
    target,
    translations: linkTranslations(link.translations, path, create),
  };
  if (!create) out.id = uuid(link.id, `${path}.id`);
  return out;
}

export function parseNavSave(value: unknown): SaveNavBody {
  const body = record(value, "body");
  onlyKeys(body, ["area", "links"]);
  if (body.area !== "header" && body.area !== "footer") throw new OpsInvalid("area");
  if (!Array.isArray(body.links) || body.links.length > MAX_LINKS) throw new OpsInvalid("links");
  const links = body.links.map((link, i) => navLink(link, `links.${i}`));
  const ids = links.flatMap((l) => (l.id ? [l.id] : []));
  if (new Set(ids).size !== ids.length) throw new OpsInvalid("links");
  return { area: body.area, links };
}
