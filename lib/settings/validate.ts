// Plan 02-06: the body of POST /api/ops/settings. Pure (route-core's OpsInvalid only), so node tests load it.
// Every key is required: the screen always sends the whole form, so a missing key is a broken client, not "unchanged".
import { OpsInvalid } from "../ops/route-core";
import { parseHex } from "./contrast";

export type SettingsSave = {
  colors: { teal: string; charcoal: string; gold: string; ivory: string; white: string };
  title_face: "Questa";
  body_face: "Lato";
  /** "5.00" style text, or null for empty (D-107: empty stays empty). */
  vat_percent: string | null;
  deposit_percent: string | null;
  maintenance: boolean;
  logo_media_id: string | null;
  locale: "en" | "ar" | "es";
  currency: "AED" | "USD" | "EUR";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Western digits, at most three before the point, one or two after (or none): "0", "5", "5.0", "30.00", "100". */
export const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

/** A percent as the screen sends it -> "x.xx", or null for empty. More than two places or over 100 is invalid. */
export function parsePercent(value: unknown, field: string): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !PERCENT.test(value) || Number(value) > 100) throw new OpsInvalid(field);
  return Number(value).toFixed(2);
}

export function parseSettingsSave(body: unknown): SettingsSave {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new OpsInvalid("body");
  const b = body as Record<string, unknown>;
  const known = new Set(["colors", "title_face", "body_face", "vat_percent", "deposit_percent", "maintenance", "logo_media_id", "locale", "currency"]);
  for (const key of Object.keys(b)) if (!known.has(key)) throw new OpsInvalid(key);

  const c = b.colors;
  if (!c || typeof c !== "object" || Array.isArray(c)) throw new OpsInvalid("colors");
  const colors = {} as SettingsSave["colors"];
  for (const key of ["teal", "charcoal", "gold", "ivory", "white"] as const) {
    const hex = parseHex((c as Record<string, unknown>)[key]);
    if (!hex) throw new OpsInvalid(`colors.${key}`);
    colors[key] = hex;
  }
  if (Object.keys(c).length !== 5) throw new OpsInvalid("colors");
  if (b.title_face !== "Questa") throw new OpsInvalid("title_face");
  if (b.body_face !== "Lato") throw new OpsInvalid("body_face");
  if (typeof b.maintenance !== "boolean") throw new OpsInvalid("maintenance");
  if (b.logo_media_id !== null && (typeof b.logo_media_id !== "string" || !UUID.test(b.logo_media_id))) throw new OpsInvalid("logo_media_id");
  if (b.locale !== "en" && b.locale !== "ar" && b.locale !== "es") throw new OpsInvalid("locale");
  if (b.currency !== "AED" && b.currency !== "USD" && b.currency !== "EUR") throw new OpsInvalid("currency");
  return {
    colors,
    title_face: "Questa",
    body_face: "Lato",
    vat_percent: parsePercent(b.vat_percent, "vat_percent"),
    deposit_percent: parsePercent(b.deposit_percent, "deposit_percent"),
    maintenance: b.maintenance,
    logo_media_id: b.logo_media_id === null ? null : (b.logo_media_id as string).toLowerCase(),
    locale: b.locale,
    currency: b.currency,
  };
}
