// Plan 02-06: what the public site takes from Settings (owner, 2026-10-13: at the next publish rebuild). Maintenance,
// the five brand colours, the two Latin faces and the logo's media key, read with the anon key from api_site_settings
// (migration 20261013120000). Never VAT, deposit or anything of the owner.
//
// A leaf module (no imports): scripts/assemble-cloudflare.mjs, middleware.ts and the node tests load it directly.

export type BrandKey = "teal" | "charcoal" | "gold" | "ivory" | "white";
export const BRAND_KEYS: readonly BrandKey[] = ["teal", "charcoal", "gold", "ivory", "white"];

/** The design system's values (tokens.json); a null column means "keep the token". */
export const BRAND_DEFAULTS: Readonly<Record<BrandKey, string>> = {
  teal: "#1f3b40",
  charcoal: "#262626",
  gold: "#d4ba8a",
  ivory: "#fffaf0",
  white: "#ffffff",
};

export const TITLE_FACES = ["Questa"] as const;
export const BODY_FACES = ["Lato"] as const;

export type PublicSiteSettings = {
  maintenance: boolean;
  colors: Record<BrandKey, string | null>;
  titleFace: string;
  bodyFace: string;
  /** Media key of the saved logo (an R2 object), or null for the design system's wordmark. */
  logoKey: string | null;
};

export const DEFAULT_SITE_SETTINGS: PublicSiteSettings = {
  maintenance: false,
  colors: { teal: null, charcoal: null, gold: null, ivory: null, white: null },
  titleFace: "Questa",
  bodyFace: "Lato",
  logoKey: null,
};

const HEX = /^#[0-9a-f]{6}$/;
/** A media key the logo column may hold (lib/site-settings-read.ts logoMediaUrl checks it too). */
export const LOGO_KEY = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.(webp|jpg|png)$/;

/**
 * One row of api_site_settings -> PublicSiteSettings. A field that is not exactly what the database's checks allow is
 * a broken read and throws (a build never guesses a colour); null colours, null faces and a null logo are defaults.
 */
export function parseSiteSettingsRow(row: unknown): PublicSiteSettings {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("api_site_settings: no row");
  const r = row as Record<string, unknown>;
  if (typeof r.maintenance !== "boolean") throw new Error("api_site_settings: maintenance is not a boolean");
  const colors = { ...DEFAULT_SITE_SETTINGS.colors };
  for (const key of BRAND_KEYS) {
    const value = r[key];
    if (value === null || value === undefined) continue;
    if (typeof value !== "string" || !HEX.test(value)) throw new Error(`api_site_settings: ${key} is not #rrggbb`);
    colors[key] = value;
  }
  const face = (value: unknown, allowed: readonly string[], fallback: string, name: string): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`api_site_settings: ${name} is not allowed`);
    return value;
  };
  const logo = r.logo_key;
  if (logo !== null && logo !== undefined && (typeof logo !== "string" || !LOGO_KEY.test(logo))) {
    throw new Error("api_site_settings: logo_key is not a media key");
  }
  return {
    maintenance: r.maintenance,
    colors,
    titleFace: face(r.title_face, TITLE_FACES, "Questa", "title_face"),
    bodyFace: face(r.body_face, BODY_FACES, "Lato", "body_face"),
    logoKey: typeof logo === "string" ? logo : null,
  };
}

/** The colour each brand key sets in app/globals.css (the @theme variables tokens.json generates). */
const CSS_VARIABLE: Record<BrandKey, string> = {
  teal: "--color-teal",
  charcoal: "--color-ink",
  gold: "--color-gold",
  ivory: "--color-ivory",
  white: "--color-surface",
};

/**
 * The `:root{…}` rule that overrides the design system's colours with the saved ones, or "" when nothing differs. Teal's
 * hover and press follow a changed Teal (the design system's mixes are 8% and 16% charcoal). Only #rrggbb values from
 * parseSiteSettingsRow reach here, so nothing can break out of a style element. The ops shell renders it at request time
 * (app/dashboard/(ops)/layout.tsx); the public build wraps it with brandStyle().
 *
 * Faces: the two selects offer only the design system's faces (D-115, D-121: Questa, Lato), which the CSS already uses,
 * so a saved face never needs a rule here; Arabic keeps its own faces (D-123).
 */
export function brandCss(settings: PublicSiteSettings): string {
  const lines: string[] = [];
  for (const key of BRAND_KEYS) {
    const value = settings.colors[key];
    if (value === null || value === BRAND_DEFAULTS[key]) continue;
    if (!HEX.test(value)) throw new Error(`brandCss: ${key} is not #rrggbb`);
    lines.push(`${CSS_VARIABLE[key]}:${value}`);
    if (key === "teal") {
      lines.push(`--color-teal-hover:color-mix(in srgb,${value} 92%,#262626)`);
      lines.push(`--color-teal-press:color-mix(in srgb,${value} 84%,#262626)`);
    }
  }
  return lines.length === 0 ? "" : `:root{${lines.join(";")}}`;
}

/** brandCss() as one `<style id="almar-brand">` element for static HTML, or "". */
export function brandStyle(settings: PublicSiteSettings): string {
  const css = brandCss(settings);
  return css === "" ? "" : `<style id="almar-brand">${css}</style>`;
}

/** A saved colour, or the design system's value when the column is null. */
export function brandColor(settings: PublicSiteSettings, key: BrandKey): string {
  return settings.colors[key] ?? BRAND_DEFAULTS[key];
}

/** Repo files the public build always copies into out/brand/ (the wordmark and the maintenance page's two faces). */
export const BRAND_FILES: readonly { from: string; to: string }[] = [
  { from: "brand/Logo Typography/Stacked_Charcoal.svg", to: "brand/wordmark.svg" },
  { from: "brand/Font/questa-webfont/2-Questa_Regular.woff", to: "brand/questa.woff" },
  { from: "brand/Font/lato/Lato-Regular.ttf", to: "brand/lato.ttf" },
];

/** The same-origin file the build copies the saved logo to, or the design system's wordmark (also copied by the build). */
export const WORDMARK_PATH = "/brand/wordmark.svg";

export function logoPath(logoKey: string | null): string {
  if (logoKey === null) return WORDMARK_PATH;
  const ext = logoKey.slice(logoKey.lastIndexOf(".") + 1);
  return `/brand/logo.${ext}`;
}

type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Reads api_site_settings through PostgREST with the anon key (the public build and the public Worker). Exactly one row
 * or it throws: the build must not ship a site it could not read the settings for.
 */
export async function fetchSiteSettings(url: string, anonKey: string, fetcher: FetchLike = fetch as unknown as FetchLike): Promise<PublicSiteSettings> {
  const response = await fetcher(`${url.replace(/\/$/, "")}/rest/v1/api_site_settings?select=*`, {
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`api_site_settings: read failed (${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("api_site_settings: expected exactly one row");
  return parseSiteSettingsRow(rows[0]);
}

