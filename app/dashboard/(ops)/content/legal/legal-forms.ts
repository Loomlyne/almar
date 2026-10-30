// The pure side of Content -> Legal (plan 06-04, F-07): a legal page and its text blocks as form state, the body of POST
// /api/ops/legal, the kit's translation fields (block texts named by each block's key), the Publish gaps and the list
// status. No React, no fetch, no directive. Nothing is pre-filled: every field starts empty (F-07).
//
// Translation is automatic (owner, 2026-10-14): the owner writes English; the kit fills Arabic and Spanish on Save. A text
// fixed by hand is locked (I18N-04): the kit's lock on a block's field is saved as that block's `locked_fields: ["text"]`,
// and it stays on its block when blocks move; legalForm(detail, keys) keeps the keys across a read-back.

import type { LegalDetail, LegalKind, Locale3, TextStatus } from "../../../../../components/ops/api-types";
import type { Fields, LiveFields, Target } from "../../../../../components/ops/auto-translate";
import type { TranslatableField } from "../../../../../components/ops/edit-page";
import type { MissingItem } from "../../../../../components/ops/publish-check";
import { textBlockKey, textBlockName, type TextBlock, type TextBlockKind } from "../../../../../components/ops/text-blocks";
import type { OpsLegalCopy, OpsLegalStatus } from "../../../../../lib/copy/ops-legal";
import { LEGAL_CAPS } from "../../../../../lib/ops/validate-legal";
import { locksOf, noLocks, type Locks } from "../../catalog/catalog-forms";

const TARGETS: readonly Target[] = ["ar", "es"];
const LOCALES: readonly Locale3[] = ["en", "ar", "es"];

export const LEGAL_KIND_ORDER: readonly LegalKind[] = ["privacy", "terms", "booking_terms", "waiver", "disclaimer", "cookie_banner"];

/**
 * Whether the cookie banner keeps text blocks. The signed picture (legal-edit-banner) draws one paragraph block, but
 * ops_save_legal_page refuses `blocks` on cookie_banner (migration 20261025120000, pgTAP "the cookie banner takes no blocks"),
 * so a Save with them could never succeed: a control that cannot work is not shown. Flip this once that refusal is gone:
 * the card, the save body and the Publish check follow, and the public banner already draws them.
 */
export const BANNER_TAKES_BLOCKS: boolean = false;

const PAGE_FIELDS = ["title", "seo_title", "seo_description"] as const;
const BANNER_FIELDS = ["title", "necessary_label", "necessary_body", "analytics_label", "analytics_body"] as const;
export type LegalTextField = (typeof PAGE_FIELDS)[number] | (typeof BANNER_FIELDS)[number];
export type LegalFormText = Record<LegalTextField, string>;

/** The text fields a kind has. */
export const legalTextFields = (kind: LegalKind): readonly LegalTextField[] => (kind === "cookie_banner" ? BANNER_FIELDS : PAGE_FIELDS);

/** The block kinds a kind offers; none: no blocks card. */
export function legalBlockKinds(kind: LegalKind): readonly TextBlockKind[] {
  if (kind !== "cookie_banner") return ["heading", "paragraph", "quote"];
  return BANNER_TAKES_BLOCKS ? ["paragraph"] : [];
}

const takesBlocks = (kind: LegalKind) => legalBlockKinds(kind).length > 0;

export type LegalForm = {
  id: string;
  kind: LegalKind;
  published: boolean;
  text: Record<Locale3, LegalFormText>;
  status: Record<Locale3, TextStatus>;
  /** A stored Arabic or Spanish record: a required field left empty is then sent without its key (never the whole record). */
  stored: Record<Target, boolean>;
  blocks: TextBlock[];
  /** The page's own Arabic and Spanish fields fixed by hand (block locks live on each block). */
  locked: Locks;
};

const blankText = (): LegalFormText => ({ title: "", seo_title: "", seo_description: "", necessary_label: "", necessary_body: "", analytics_label: "", analytics_body: "" });

/**
 * The form for a page as ops_get('legal_page') answers it. `keys`: the block keys to reuse, in order (the blocks just
 * saved, empty rows left out): a read-back after Save keeps each block's field name, so the kit's locks stay on their blocks.
 */
export function legalForm(detail: LegalDetail, keys: readonly string[] = []): LegalForm {
  const text = (locale: Locale3): LegalFormText => {
    const record = detail.translations[locale];
    const out = blankText();
    for (const field of legalTextFields(detail.kind)) out[field] = record?.[field] ?? "";
    return out;
  };
  const status = (locale: Target): TextStatus => detail.translations[locale]?.status ?? "draft";
  return {
    id: detail.id,
    kind: detail.kind,
    published: detail.is_published,
    text: { en: text("en"), ar: text("ar"), es: text("es") },
    status: { en: "published", ar: status("ar"), es: status("es") },
    stored: { ar: detail.translations.ar !== null, es: detail.translations.es !== null },
    blocks: detail.blocks
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((block, i) => ({
        key: keys[i] ?? textBlockKey(),
        kind: block.kind,
        text: { en: block.translations.en?.text ?? "", ar: block.translations.ar?.text ?? "", es: block.translations.es?.text ?? "" },
        locked: {
          ar: (block.translations.ar?.locked_fields ?? []).includes("text"),
          es: (block.translations.es?.locked_fields ?? []).includes("text"),
        },
      })),
    locked: locksOf(detail.translations),
  };
}

/**
 * After a read-back: a language the save held back (a new record with no title yet) keeps what the owner typed in it, so a
 * failed translation never drops her text (memory: omit the key, not the record).
 */
export function keepHeldText(next: LegalForm, sent: LegalForm): LegalForm {
  const text = { ...next.text };
  for (const target of TARGETS) {
    if (!sent.stored[target] && sent.text[target].title.trim() === "" && legalTextFields(sent.kind).some((field) => sent.text[target][field].trim() !== "")) {
      text[target] = sent.text[target];
    }
  }
  return { ...next, text };
}

/** The kit's translated fields: the kind's own, then one per block. */
export function legalTranslationFields(form: Pick<LegalForm, "kind" | "blocks">, copy: OpsLegalCopy): TranslatableField[] {
  const own: Record<LegalTextField, TranslatableField> = {
    title: { name: "title", label: copy.f.title, maxLength: LEGAL_CAPS.title },
    seo_title: { name: "seo_title", label: copy.f.seoTitle, maxLength: LEGAL_CAPS.seo_title },
    seo_description: { name: "seo_description", label: copy.f.seoDescription, multiline: true, maxLength: LEGAL_CAPS.seo_description },
    necessary_label: { name: "necessary_label", label: copy.f.necLabel, maxLength: LEGAL_CAPS.label },
    necessary_body: { name: "necessary_body", label: copy.f.necText, multiline: true, maxLength: LEGAL_CAPS.body },
    analytics_label: { name: "analytics_label", label: copy.f.anLabel, maxLength: LEGAL_CAPS.label },
    analytics_body: { name: "analytics_body", label: copy.f.anText, multiline: true, maxLength: LEGAL_CAPS.body },
  };
  const blocks = form.blocks.map((block, i) => ({ name: block.key, label: textBlockName(copy.bk, block, i), multiline: block.kind !== "heading", maxLength: LEGAL_CAPS.block }));
  return [...legalTextFields(form.kind).map((field) => own[field]), ...blocks];
}

/** One language's values for the kit: the kind's fields plus `block_<k>` for each block. */
export function legalFields(form: LegalForm, locale: Locale3): Fields {
  const out: Fields = {};
  for (const field of legalTextFields(form.kind)) out[field] = form.text[locale][field];
  for (const block of form.blocks) out[block.key] = block.text[locale];
  return out;
}

/** The kit's lock lists: the page's own, plus `block_<k>` for each locked block text. */
export function legalLocks(form: LegalForm): Record<Target, string[]> {
  const out: Record<Target, string[]> = { ar: [...form.locked.ar], es: [...form.locked.es] };
  for (const block of form.blocks) {
    for (const target of TARGETS) if (block.locked[target]) out[target].push(block.key);
  }
  out.ar.sort();
  out.es.sort();
  return out;
}

const asText = (value: Fields[string] | undefined, fallback: string) => (value === undefined ? fallback : Array.isArray(value) ? value.join(" ") : (value ?? ""));

/** The Arabic and Spanish the kit handed back, and its lock lists, split back into the page and its blocks. */
export function legalWithTranslations(form: LegalForm, translations: Record<Target, Fields>, locked: Record<Target, string[]>): LegalForm {
  const fields = legalTextFields(form.kind);
  const text = { ...form.text };
  for (const target of TARGETS) {
    const next = { ...form.text[target] };
    for (const field of fields) next[field] = asText(translations[target][field], next[field]);
    text[target] = next;
  }
  const blocks = form.blocks.map((block) => ({
    ...block,
    text: { en: block.text.en, ar: asText(translations.ar[block.key], block.text.ar), es: asText(translations.es[block.key], block.text.es) },
    locked: { ar: locked.ar.includes(block.key), es: locked.es.includes(block.key) },
  }));
  const own = (target: Target) => locked[target].filter((field) => (fields as readonly string[]).includes(field)).sort();
  return { ...form, text, blocks, locked: { ar: own("ar"), es: own("es") } };
}

const statusFor = (form: LegalForm, target: Target, publish: boolean): TextStatus => (publish || form.status[target] === "published" ? "published" : "draft");

type SentRecord = Record<string, unknown>;

function sentFields(form: LegalForm, locale: Locale3): SentRecord {
  const out: SentRecord = {};
  for (const field of legalTextFields(form.kind)) {
    const value = form.text[locale][field].trim();
    out[field] = value === "" ? null : value;
  }
  return out;
}

/**
 * One Arabic or Spanish record: null when nothing is written; with an empty title, a stored record goes without the key
 * (the database keeps its title) and a new one is held back (undefined: the database would refuse it; Publish says what is
 * missing and keepHeldText keeps her text).
 */
function targetRecord(form: LegalForm, target: Target, publish: boolean): SentRecord | null | undefined {
  const fields = sentFields(form, target);
  if (Object.values(fields).every((value) => value === null)) return null;
  const out: SentRecord = { ...fields, status: statusFor(form, target, publish), locked_fields: form.locked[target].filter((field) => (legalTextFields(form.kind) as readonly string[]).includes(field)) };
  if (fields.title === null) {
    if (!form.stored[target]) return undefined;
    delete out.title;
  }
  return out;
}

export type LegalRefusal = "translations.en.title";

/** The body of POST /api/ops/legal, or the field the screen refuses before any request. Blocks are replaced whole, in order. */
export function legalPayload(form: LegalForm, { publish }: { publish: boolean }): { ok: true; body: Record<string, unknown> } | { ok: false; field: LegalRefusal } {
  if (form.text.en.title.trim() === "") return { ok: false, field: "translations.en.title" };
  const translations: Record<string, SentRecord | null> = { en: { ...sentFields(form, "en"), status: "published" } };
  for (const target of TARGETS) {
    const record = targetRecord(form, target, publish);
    if (record !== undefined) translations[target] = record;
  }
  const body: Record<string, unknown> = { kind: form.kind, translations };
  if (takesBlocks(form.kind)) {
    body.blocks = form.blocks
      .filter((block) => block.text.en.trim() !== "") // an empty row is not a block yet
      .map((block) => {
        const text: Record<string, SentRecord | null> = { en: { text: block.text.en.trim(), status: "published" } };
        for (const target of TARGETS) {
          const value = block.text[target].trim();
          text[target] = value === "" ? null : { text: value, status: statusFor(form, target, publish), locked_fields: block.locked[target] ? ["text"] : [] };
        }
        return { kind: block.kind, translations: text };
      });
  }
  return { ok: true, body };
}

/**
 * What Publish waits for (mirrors ops_publish): the title in all three languages; a page has at least one block, each with
 * its text in all three; the banner has both labels in all three; a field written in English is written in the other two.
 */
export function missingForLegal(form: LegalForm): MissingItem[] {
  const out: MissingItem[] = [];
  const required: readonly LegalTextField[] = form.kind === "cookie_banner" ? ["title", "necessary_label", "analytics_label"] : ["title"];
  for (const locale of LOCALES) {
    for (const field of required) if (form.text[locale][field].trim() === "") out.push({ locale, field });
  }
  for (const target of TARGETS) {
    for (const field of legalTextFields(form.kind)) {
      if (!required.includes(field) && form.text.en[field].trim() !== "" && form.text[target][field].trim() === "") out.push({ locale: target, field });
    }
  }
  if (takesBlocks(form.kind)) {
    if (form.kind !== "cookie_banner" && form.blocks.length === 0) out.push({ locale: null, field: "blocks" });
    for (const block of form.blocks) {
      if (block.text.en.trim() === "") out.push({ locale: "en", field: block.key });
      for (const target of TARGETS) if (block.text[target].trim() === "") out.push({ locale: target, field: block.key });
    }
  }
  return out;
}

/** The Arabic and Spanish fields on the site now: a published page's published languages, as last saved. */
export function liveLegalFields(saved: LegalForm): LiveFields {
  if (!saved.published) return {};
  const live: LiveFields = {};
  for (const target of TARGETS) {
    if (saved.status[target] !== "published") continue;
    const fields: string[] = legalTextFields(saved.kind).filter((field) => saved.text[target][field].trim() !== "");
    for (const block of saved.blocks) if (block.text[target].trim() !== "") fields.push(block.key);
    live[target] = fields;
  }
  return live;
}

/** The keys of the blocks a save sends, in order (empty rows are not sent): for legalForm's read-back. */
export const sentBlockKeys = (form: Pick<LegalForm, "blocks">): string[] => form.blocks.filter((block) => block.text.en.trim() !== "").map((block) => block.key);

/** The list's chip: Not written with no English title yet, otherwise Published or Draft. */
export function legalStatus(row: { title_en: string | null | undefined; is_published: boolean }): OpsLegalStatus {
  if (row.is_published) return "published";
  return (row.title_en ?? "").trim() === "" ? "none" : "draft";
}
