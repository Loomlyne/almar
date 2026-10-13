// Plan 02-06: GET and POST /api/ops/settings (owner only, through lib/ops/route.ts). Dependencies are injected so node
// tests run the handlers without Supabase. Nothing here imports the service-role helper: the admin client arrives in
// the owner context, built by requireOwner().
import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaUrl } from "../data/media";
import type { FxRates } from "../fx/rates";
import type { OpsOutcome } from "../ops/route-core";
import { OpsInvalid } from "../ops/route-core";
import { failingColors, type BrandColors, type BrandKey } from "./contrast";
import { BRAND_DEFAULTS, BRAND_KEYS } from "../site-settings";
import type { SettingsSave } from "./validate";
import type { RequestRebuild } from "./site-rebuild";

export const LOGO_MAX_BYTES = 1024 * 1024;
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type Owner = { profile: { id: string; locale: "en" | "ar" | "es"; currency: "AED" | "USD" | "EUR" }; admin: SupabaseClient };

export type SettingsLogo = { id: string; key: string; url: string; width: number | null; height: number | null };

export type SettingsView = {
  colors: BrandColors;
  title_face: string;
  body_face: string;
  vat_percent: string | null;
  deposit_percent: string | null;
  maintenance: boolean;
  logo: SettingsLogo | null;
  locale: "en" | "ar" | "es";
  currency: "AED" | "USD" | "EUR";
  fx: { aed: number; eur: number; date: string } | null;
};

const SETTINGS_COLUMNS = "teal, charcoal, gold, ivory, white, title_face, body_face, vat_percent, deposit_percent, maintenance, logo_media_id";

type Row = Record<string, unknown>;

function percentText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function colorsOf(row: Row): BrandColors {
  const out = {} as BrandColors;
  for (const key of BRAND_KEYS) out[key] = typeof row[key] === "string" ? (row[key] as string) : BRAND_DEFAULTS[key];
  return out;
}

async function readRow(admin: SupabaseClient): Promise<{ row: Row } | { dbError: { code?: string; message?: string } }> {
  const { data, error } = await admin.from("site_settings").select(SETTINGS_COLUMNS).eq("id", 1).maybeSingle();
  if (error) return { dbError: error };
  return { row: (data ?? {}) as Row };
}

async function readLogo(admin: SupabaseClient, id: string): Promise<{ logo: (SettingsLogo & { bytes: number | null; content_type: string | null }) | null } | { dbError: { code?: string; message?: string } }> {
  const { data, error } = await admin.from("media").select("id, key, width, height, bytes, content_type").eq("id", id).maybeSingle();
  if (error) return { dbError: error };
  if (!data) return { logo: null };
  const r = data as Row;
  return {
    logo: {
      id: String(r.id),
      key: String(r.key),
      url: mediaUrl(String(r.key)),
      width: typeof r.width === "number" ? r.width : null,
      height: typeof r.height === "number" ? r.height : null,
      bytes: typeof r.bytes === "number" ? r.bytes : null,
      content_type: typeof r.content_type === "string" ? r.content_type : null,
    },
  };
}

export async function getSettings({ owner, loadRates }: { owner: Owner; loadRates: () => Promise<FxRates | null> }): Promise<OpsOutcome> {
  const read = await readRow(owner.admin);
  if ("dbError" in read) return read;
  const { row } = read;
  let logo: SettingsLogo | null = null;
  if (typeof row.logo_media_id === "string") {
    const found = await readLogo(owner.admin, row.logo_media_id);
    if ("dbError" in found) return found;
    if (found.logo) logo = { id: found.logo.id, key: found.logo.key, url: found.logo.url, width: found.logo.width, height: found.logo.height };
  }
  const rates = await loadRates().catch(() => null);
  const settings: SettingsView = {
    colors: colorsOf(row),
    title_face: typeof row.title_face === "string" ? row.title_face : "Questa",
    body_face: typeof row.body_face === "string" ? row.body_face : "Lato",
    vat_percent: percentText(row.vat_percent),
    deposit_percent: percentText(row.deposit_percent),
    maintenance: row.maintenance === true,
    logo,
    locale: owner.profile.locale,
    currency: owner.profile.currency,
    fx: rates ? { aed: rates.aed, eur: rates.eur, date: rates.date } : null,
  };
  return { body: { ok: true, settings } };
}

/** True when the save changes something the public site shows (it then needs a publish rebuild). */
export function affectsSite(before: Row, save: SettingsSave): boolean {
  const colors = colorsOf(before);
  if (BRAND_KEYS.some((key) => colors[key] !== save.colors[key])) return true;
  if ((before.maintenance === true) !== save.maintenance) return true;
  if ((typeof before.logo_media_id === "string" ? before.logo_media_id : null) !== save.logo_media_id) return true;
  if ((before.title_face ?? "Questa") !== save.title_face || (before.body_face ?? "Lato") !== save.body_face) return true;
  return false;
}

export async function postSettings({
  owner,
  body,
  requestRebuild,
}: {
  owner: Owner;
  body: SettingsSave;
  requestRebuild: RequestRebuild;
}): Promise<OpsOutcome> {
  const read = await readRow(owner.admin);
  if ("dbError" in read) return read;
  const before = read.row;

  // The contrast gate runs here too: a client that skipped it cannot save a failing pair (D-128). Charged to the
  // colours she changed, like the screen's lines.
  const was = colorsOf(before);
  const changed = new Set<BrandKey>(BRAND_KEYS.filter((key) => was[key] !== body.colors[key]));
  const failing = failingColors(body.colors, changed);
  if (failing.length > 0) throw new OpsInvalid(`colors.${failing[0]}`);

  if (body.logo_media_id !== null) {
    const found = await readLogo(owner.admin, body.logo_media_id);
    if ("dbError" in found) return found;
    const logo = found.logo;
    if (!logo || !logo.content_type || !LOGO_TYPES.has(logo.content_type) || logo.bytes === null || logo.bytes > LOGO_MAX_BYTES) {
      throw new OpsInvalid("logo_media_id");
    }
  }

  // A colour equal to the design system's token is stored as null ("keep the token"), so a later token change follows.
  const colorColumns: Record<string, string | null> = {};
  for (const key of BRAND_KEYS) colorColumns[key] = body.colors[key] === BRAND_DEFAULTS[key] ? null : body.colors[key];

  const { error: settingsError } = await owner.admin
    .from("site_settings")
    .update({
      ...colorColumns,
      title_face: body.title_face,
      body_face: body.body_face,
      vat_percent: body.vat_percent,
      deposit_percent: body.deposit_percent,
      maintenance: body.maintenance,
      logo_media_id: body.logo_media_id,
    })
    .eq("id", 1);
  if (settingsError) return { dbError: settingsError };

  const { error: profileError } = await owner.admin
    .from("profiles")
    .update({ locale: body.locale, currency: body.currency })
    .eq("id", owner.profile.id);
  if (profileError) return { dbError: profileError };

  const affects = affectsSite(before, body);
  if (affects) await requestRebuild(owner.admin);
  return { body: { ok: true, affects_site: affects } };
}
