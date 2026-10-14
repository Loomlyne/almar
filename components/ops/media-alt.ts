// The alt text of one photo as the Media editor edits it, and the pure steps around it (03.2-09, kit panel B). No React,
// no request: node tests load this file directly, and media-library.tsx binds it to state.
//
// Translation is automatic (owner, 2026-10-14): Maria writes the English; the editor fills Arabic and Spanish on Save.
// A photo is published when its English, Arabic and Spanish alt texts are all published. Save keeps a published photo
// published (the site updates) and an unpublished one in draft; Publish makes Arabic and Spanish published. There is
// no "I checked this translation" box any more.
import type { Locale3 } from "./api-types";
import type { MediaItem } from "./media-types";
import type { MissingItem } from "./publish-check";

/** What the open photo's editor holds: one alt text per language. */
export type AltText = Record<Locale3, string>;

type Other = Exclude<Locale3, "en">;

/** The field name of the alt text: the translate route's field and the missing list's field. */
export const ALT_FIELD = "alt";

/** The editor's starting point for a photo: its saved alt text. */
export function altOf(item: MediaItem): AltText {
  return { en: item.alt.en ?? "", ar: item.alt.ar ?? "", es: item.alt.es ?? "" };
}

export function sameAlt(a: AltText, b: AltText): boolean {
  return a.en === b.en && a.ar === b.ar && a.es === b.es;
}

/** Published: English, Arabic and Spanish all published. A missing or draft Arabic or Spanish is a draft photo. */
export function isAltPublished(item: MediaItem): boolean {
  return item.alt_status.en === "published" && item.alt_status.ar === "published" && item.alt_status.es === "published";
}

/** What Publish waits for: an alt text in each language. */
export function altMissing(alt: AltText): MissingItem[] {
  const out: MissingItem[] = [];
  for (const code of ["en", "ar", "es"] as const) if (alt[code].trim() === "") out.push({ locale: code, field: ALT_FIELD });
  return out;
}

export type SaveAltBody = {
  action: "save_alt";
  id: string;
  alt: { en: string; ar: string | null; es: string | null };
  status: Partial<Record<Other, "published" | "draft">>;
};

/**
 * The save_alt body (contract 5.10). Arabic and Spanish with text are "published" when `publish` (Publish pressed, or a
 * save on a published photo), else "draft"; a language left empty is sent as null and carries no status.
 */
export function buildSaveAlt(id: string, alt: AltText, publish: boolean): SaveAltBody {
  const ar = alt.ar.trim();
  const es = alt.es.trim();
  const state = publish ? "published" : "draft";
  const status: SaveAltBody["status"] = {};
  if (ar !== "") status.ar = state;
  if (es !== "") status.es = state;
  return { action: "save_alt", id, alt: { en: alt.en.trim(), ar: ar === "" ? null : ar, es: es === "" ? null : es }, status };
}

/** The photo as the list shows it after a save: new alt text and the status the save sent. */
export function itemAfterSave(item: MediaItem, body: SaveAltBody): MediaItem {
  const statusOf = (code: Other, text: string | null): MediaItem["alt_status"][Other] =>
    text === null ? "missing" : (body.status[code] ?? "draft");
  return {
    ...item,
    alt_en: body.alt.en,
    alt: { en: body.alt.en, ar: body.alt.ar, es: body.alt.es },
    alt_status: { en: "published", ar: statusOf("ar", body.alt.ar), es: statusOf("es", body.alt.es) },
  };
}
