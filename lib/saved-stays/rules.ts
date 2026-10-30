// Plan 06-07: the pure rules of saved stays and Share. The slug rule stands between an untrusted query and a post-sign-in
// redirect (T-06-74), so a path is only ever built from a slug that passed it. Paths come from lib/locale-path.ts, itself a leaf.
import { localePath, type Locale } from "../locale-path";

export const STAY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STAY_SLUG_MAX = 80;

export function isStaySlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= STAY_SLUG_MAX && STAY_SLUG_RE.test(value);
}

export const SAVED_STAY_LOCALES = ["en", "ar", "es"] as const;

/** Where a signed-out heart goes. `?return=` stays a key, never a URL. Null for a bad slug. */
export function loginHrefForSave(locale: Locale, slug: unknown): string | null {
  return isStaySlug(slug) ? `${localePath(locale, "/login")}?return=stay&stay=${slug}` : null;
}

/** Where the sign-in link lands: the stay's own page in the language of the login page. Null for a bad slug. */
export function stayReturnPath(locale: Locale, slug: unknown): string | null {
  return isStaySlug(slug) ? localePath(locale, `/private-stays/${slug}`) : null;
}

export const SAVE_INTENT_KEY = "almar-save-intent";

/** One hour: equals RETURN_COOKIE_MAX_AGE (lib/auth/rules.ts) x 1000, the return cookie's own life; a test asserts both. */
export const SAVE_INTENT_TTL_MS = 3_600_000;

/** The slug of a stored save intent still in force, or null: older than an hour, from the future, malformed, a bad slug. */
export function readIntent(raw: string | null, nowMs: number): string | null {
  if (typeof raw !== "string") return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { stay, at } = value as { stay?: unknown; at?: unknown };
  if (!isStaySlug(stay) || typeof at !== "number" || !Number.isFinite(at)) return null;
  const age = nowMs - at;
  return age >= 0 && age <= SAVE_INTENT_TTL_MS ? stay : null;
}

/** A chat with no number in it: she picks who gets the stay's name and address. */
export function whatsappShareHref(title: string, url: string, template: string): string {
  const text = template.replace(/\{stay\}/g, () => title).replace(/\{url\}/g, () => url);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
