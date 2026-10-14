// Plan 02-06: the Settings form's rules, pure (no React), so node tests check them: what Save may send and when.
import { failingColors, type BrandColors, type BrandKey } from "./contrast";

export type FormLogo = { id: string; url: string; bytes: number | null; contentType: string | null };

export type SettingsForm = {
  colors: BrandColors;
  titleFace: "Questa";
  bodyFace: "Lato";
  vat: string;
  deposit: string;
  maintenance: boolean;
  logo: FormLogo | null;
  locale: "en" | "ar" | "es";
  currency: "AED" | "USD" | "EUR";
};

export const LOGO_MAX_BYTES = 1024 * 1024;
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** A percent field's error: null when empty or fine; else which line to show. */
export function percentError(text: string): "twoDecimals" | "percentRange" | null {
  const value = text.trim();
  if (value === "") return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return "twoDecimals";
  return Number(value) > 100 ? "percentRange" : null;
}

/** "5" -> "5.00" for display after a save; "" stays "". */
export function percentText(value: string | null): string {
  return value === null ? "" : Number(value).toFixed(2);
}

export function logoAccepted(logo: FormLogo | null): boolean {
  if (logo === null) return true;
  // The library list carries no size: an unknown size is left to the server, which refuses over 1 MB (logo_media_id).
  return (logo.bytes === null || logo.bytes <= LOGO_MAX_BYTES) && logo.contentType !== null && LOGO_TYPES.has(logo.contentType);
}

function same(a: SettingsForm, b: SettingsForm): boolean {
  return (
    (Object.keys(a.colors) as BrandKey[]).every((key) => a.colors[key] === b.colors[key]) &&
    a.titleFace === b.titleFace &&
    a.bodyFace === b.bodyFace &&
    a.vat.trim() === b.vat.trim() &&
    a.deposit.trim() === b.deposit.trim() &&
    a.maintenance === b.maintenance &&
    (a.logo?.id ?? null) === (b.logo?.id ?? null) &&
    a.locale === b.locale &&
    a.currency === b.currency
  );
}

export function isDirty(form: SettingsForm, saved: SettingsForm): boolean {
  return !same(form, saved);
}

/** The colours whose row shows the contrast line: a failing pair charged to what she changed since the last save. */
export function contrastErrors(form: SettingsForm, saved: SettingsForm): BrandKey[] {
  const changed = new Set((Object.keys(form.colors) as BrandKey[]).filter((key) => form.colors[key] !== saved.colors[key]));
  return failingColors(form.colors, changed);
}

/**
 * Save is enabled only when something changed, contrast passes, both percents are valid, the chosen logo is accepted,
 * and a saved logo that was cleared has a replacement (D-131, D-128, D-166).
 */
export function canSave(form: SettingsForm, saved: SettingsForm): boolean {
  if (!isDirty(form, saved)) return false;
  if (contrastErrors(form, saved).length > 0) return false;
  if (percentError(form.vat) || percentError(form.deposit)) return false;
  if (!logoAccepted(form.logo)) return false;
  if (saved.logo !== null && form.logo === null) return false;
  return true;
}

/** The POST /api/ops/settings body (lib/settings/validate.ts). */
export function saveBody(form: SettingsForm) {
  return {
    colors: form.colors,
    title_face: form.titleFace,
    body_face: form.bodyFace,
    vat_percent: form.vat.trim() === "" ? null : form.vat.trim(),
    deposit_percent: form.deposit.trim() === "" ? null : form.deposit.trim(),
    maintenance: form.maintenance,
    logo_media_id: form.logo?.id ?? null,
    locale: form.locale,
    currency: form.currency,
  };
}
