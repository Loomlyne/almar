// The alt text of one photo as the Media panel edits it, and the pure steps around it (03.2-09). No React, no request:
// node tests load this file directly, and media-library.tsx binds it to state.
import type { Locale3 } from "./api-types";
import type { MediaItem } from "./media-types";

/** What the open photo's panel is editing: one alt text per language and the two "I checked this translation" boxes. */
export type AltDraft = {
  alt: Record<Locale3, string>;
  checked: { ar: boolean; es: boolean };
};

type Other = Exclude<Locale3, "en">;

/** The panel's starting point for a photo: its saved alt text, and a box ticked only where that language is published. */
export function altDraftOf(item: MediaItem): AltDraft {
  return {
    alt: { en: item.alt.en ?? "", ar: item.alt.ar ?? "", es: item.alt.es ?? "" },
    checked: { ar: item.alt_status.ar === "published", es: item.alt_status.es === "published" },
  };
}

export function sameAltDraft(a: AltDraft, b: AltDraft): boolean {
  return (
    a.alt.en === b.alt.en &&
    a.alt.ar === b.alt.ar &&
    a.alt.es === b.alt.es &&
    a.checked.ar === b.checked.ar &&
    a.checked.es === b.checked.es
  );
}

/**
 * The panel's handler for the Translate button (03.2-10's `onDrafts(target, fields)`): the translated alt text fills
 * that language's box, the language becomes a Draft and "I checked this translation" is unticked, so the owner reads
 * it before it can be published. `fields.alt` is the one field the panel sends. Nothing is saved here.
 * A reply with no text for `alt` changes nothing.
 */
export function applyAltDrafts(
  draft: AltDraft,
  target: Other,
  fields: Record<string, string | string[]>,
): AltDraft {
  const raw = fields.alt;
  const text = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (text === "") return draft;
  return {
    alt: { ...draft.alt, [target]: text },
    checked: { ...draft.checked, [target]: false },
  };
}

/** The status a language is shown with: nothing typed is missing; English is published; AR and ES follow their box. */
export function altStateOf(draft: AltDraft, code: Locale3): "published" | "draft" | "missing" {
  if (draft.alt[code].trim() === "") return "missing";
  if (code === "en") return "published";
  return draft.checked[code] ? "published" : "draft";
}

export type SaveAltBody = {
  action: "save_alt";
  id: string;
  alt: { en: string; ar: string | null; es: string | null };
  status: Partial<Record<Other, "published" | "draft">>;
};

/**
 * The save_alt body (contract 5.10). A language with text is "published" only when its box is ticked, else "draft";
 * a language left empty is sent as null and carries no status.
 */
export function buildSaveAlt(id: string, draft: AltDraft): SaveAltBody {
  const ar = draft.alt.ar.trim();
  const es = draft.alt.es.trim();
  const status: SaveAltBody["status"] = {};
  if (ar !== "") status.ar = draft.checked.ar ? "published" : "draft";
  if (es !== "") status.es = draft.checked.es ? "published" : "draft";
  return { action: "save_alt", id, alt: { en: draft.alt.en.trim(), ar: ar === "" ? null : ar, es: es === "" ? null : es }, status };
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
