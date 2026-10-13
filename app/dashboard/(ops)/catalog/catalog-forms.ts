// The pure side of Catalog -> Destinations and Experiences and services (plan 03.2-06): form state, small view
// helpers and the client filters. No React, no fetch, no directive. The save payload builders (destinationPayload,
// catalogItemPayload) join this file in Task 2, after the owner signs the pictures.

import type {
  CatalogKind,
  CatalogUnit,
  Locale3,
  MediaRef,
  TextStatus,
  TranslationState,
} from "../../../../components/ops/api-types";
import { foldText } from "../../../../lib/data/stay-filter";

export const FORM_LOCALES: readonly Locale3[] = ["en", "ar", "es"];

/** The text fields of a destination, one set per language. Empty string = not set. */
export type DestinationText = { name: string; short_line: string; region: string; summary: string; nights_label: string };
export const DESTINATION_TEXT_FIELDS = ["name", "short_line", "region", "summary", "nights_label"] as const;

/** The text fields of an experience or service, one set per language. */
export type CatalogItemText = { name: string; summary: string; duration_label: string };
export const CATALOG_TEXT_FIELDS = ["name", "summary", "duration_label"] as const;

export type DestinationForm = {
  id: string | null;
  slug: string;
  published: boolean;
  hero: MediaRef | null;
  inset: MediaRef | null;
  text: Record<Locale3, DestinationText>;
  /** Draft until the owner ticks "I checked this translation" (C-08). English is always published text. */
  status: Record<Locale3, TextStatus>;
};

export type CatalogItemForm = {
  id: string | null;
  slug: string;
  published: boolean;
  kind: CatalogKind;
  unit: CatalogUnit;
  /** What the owner typed: "" = not set, otherwise a decimal. Normalised to a two-decimal string when saved. */
  price: string;
  is_uae: boolean;
  is_home_pickup: boolean;
  media: MediaRef | null;
  destination_ids: string[];
  stay_ids: string[];
  text: Record<Locale3, CatalogItemText>;
  status: Record<Locale3, TextStatus>;
};

const emptyStatus = (): Record<Locale3, TextStatus> => ({ en: "published", ar: "draft", es: "draft" });

export function emptyDestinationForm(): DestinationForm {
  const blank = (): DestinationText => ({ name: "", short_line: "", region: "", summary: "", nights_label: "" });
  return { id: null, slug: "", published: false, hero: null, inset: null, text: { en: blank(), ar: blank(), es: blank() }, status: emptyStatus() };
}

export function emptyCatalogItemForm(): CatalogItemForm {
  const blank = (): CatalogItemText => ({ name: "", summary: "", duration_label: "" });
  return {
    id: null,
    slug: "",
    published: false,
    kind: "experience",
    unit: "person",
    price: "",
    is_uae: false,
    is_home_pickup: false,
    media: null,
    destination_ids: [],
    stay_ids: [],
    text: { en: blank(), ar: blank(), es: blank() },
    status: emptyStatus(),
  };
}

/** The chip a language tab wears: no text = missing; text = draft until checked, then published. */
export function localeState(text: Record<string, string>, status: TextStatus): TranslationState {
  const any = Object.values(text).some((value) => value.trim() !== "");
  if (!any) return "missing";
  return status === "published" ? "published" : "draft";
}

export function translationStates(form: { text: Record<Locale3, Record<string, string>>; status: Record<Locale3, TextStatus> }): Record<Locale3, TranslationState> {
  return {
    en: localeState(form.text.en, "published"),
    ar: localeState(form.text.ar, form.status.ar),
    es: localeState(form.text.es, form.status.es),
  };
}

/** Translate's answer for one target lands in that language's form as unchecked drafts. */
export function applyDrafts<T extends Record<string, string>>(
  form: { text: Record<Locale3, T>; status: Record<Locale3, TextStatus> },
  target: "ar" | "es",
  fields: Record<string, string | string[]>,
): { text: Record<Locale3, T>; status: Record<Locale3, TextStatus> } {
  const next: Record<string, string> = { ...form.text[target] };
  for (const [key, value] of Object.entries(fields)) {
    if (key in next && typeof value === "string") next[key] = value;
  }
  return { text: { ...form.text, [target]: next as T }, status: { ...form.status, [target]: "draft" } };
}

/**
 * "1250.00" -> "1,250.00" for the list. Strings only, no float: grouping is done on the digits. Anything that is not a
 * decimal string is returned as it came (the scenes pass a bracket placeholder).
 */
export function groupAmount(price: string): string {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
  if (!m) return price;
  const whole = m[1].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return m[2] === undefined ? whole : `${whole}.${m[2].padEnd(2, "0")}`;
}

export type CatalogFilter = { kind: "" | CatalogKind; destinationId: string; stayId: string; query: string };
export const NO_CATALOG_FILTER: CatalogFilter = { kind: "", destinationId: "", stayId: "", query: "" };

export type CatalogFilterable = {
  position: number;
  kind: CatalogKind;
  name: string;
  destinationIds: string[];
  stayIds: string[];
};

/** Type, destination, stay and search together; accents folded; position order. */
export function filterCatalogRows<T extends CatalogFilterable>(rows: readonly T[], filter: CatalogFilter): T[] {
  const needle = foldText(filter.query.trim());
  return rows
    .filter((row) => (filter.kind === "" || row.kind === filter.kind))
    .filter((row) => filter.destinationId === "" || row.destinationIds.includes(filter.destinationId))
    .filter((row) => filter.stayId === "" || row.stayIds.includes(filter.stayId))
    .filter((row) => needle === "" || foldText(row.name).includes(needle))
    .slice()
    .sort((a, b) => a.position - b.position);
}
