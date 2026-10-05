// Contract 1.1 error codes and missing-field items, said in words. Pure: no React.
// T-3.2-11-03: messages are fixed copy per code. `detail` is never printed raw; the only thing read from it is the
// `missing` list, and each of its field names goes through the labels below.

import { KIT_ERROR_CODES, KIT_FIELD_KEYS, fillCopy, type KitErrorCode, type KitFieldKey, type OpsKitCopy } from "../../lib/copy/ops-kit";
import type { Locale3, OpsError } from "./api-types";
import type { MissingItem } from "./publish-check";

/** Columns that all mean "a photo", by the contract's name. */
const PHOTO_COLUMNS = new Set(["hero_media_id", "media_id", "photo_media_id", "image_media_id"]);

function upperFirst(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function isFieldKey(field: string): field is KitFieldKey {
  return (KIT_FIELD_KEYS as readonly string[]).includes(field);
}

/** The last segment of a dotted field path, with underscores as spaces: the fallback for a field the copy does not name. */
function humanise(field: string): string {
  return (field.split(".").pop() ?? field).replace(/_/g, " ");
}

/** A field name in words. `translations.ar.title` and `title` both say "title". */
export function fieldWords(copy: OpsKitCopy, field: string, fieldLabel?: (field: string) => string | undefined): string {
  const last = field.split(".").pop() ?? field;
  const custom = fieldLabel?.(last);
  if (custom) return custom;
  if (PHOTO_COLUMNS.has(last)) return copy.fields.photo;
  if (last === "inset_media_id") return copy.fields.inset_photo;
  return isFieldKey(last) ? copy.fields[last] : humanise(last);
}

/** One line of the "Publish needs:" list: "Arabic title", "A photo", "One destination". */
export function missingLine(copy: OpsKitCopy, item: MissingItem, fieldLabel?: (field: string) => string | undefined): string {
  const field = fieldWords(copy, item.field, fieldLabel);
  if (!item.locale) return upperFirst(field);
  return upperFirst(fillCopy(copy.missingLine, { language: copy.languages[item.locale], field }));
}

function isCode(code: string): code is KitErrorCode {
  return (KIT_ERROR_CODES as readonly string[]).includes(code);
}

/** The sentence for an error reply. An unknown code says the `unavailable` sentence. */
export function errorText(copy: OpsKitCopy, error: OpsError, fieldLabel?: (field: string) => string | undefined): string {
  if (error.code === "invalid" && error.field) {
    return fillCopy(copy.invalidField, { field: fieldWords(copy, error.field, fieldLabel) });
  }
  return isCode(error.code) ? copy.errors[error.code] : copy.errors.unavailable;
}

function isLocale(value: unknown): value is Locale3 {
  return value === "en" || value === "ar" || value === "es";
}

/**
 * The server's list of gaps from a 409 publish_incomplete (`detail.missing`), or null for any other error. Reading it
 * back into MissingItem means one kind of message for the client check and the server check.
 */
export function missingFromError(error: OpsError | null): MissingItem[] | null {
  if (!error || error.code !== "publish_incomplete") return null;
  const detail = error.detail;
  const list =
    detail && typeof detail === "object" && "missing" in detail ? (detail as { missing: unknown }).missing : null;
  if (!Array.isArray(list)) return [];
  const items: MissingItem[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const { locale, field } = entry as { locale?: unknown; field?: unknown };
    if (typeof field !== "string" || field.length === 0) continue;
    items.push({ locale: isLocale(locale) ? locale : null, field });
  }
  return items;
}
