// Pure auth rules shared by server actions and node tests. No imports: tests load this file
// directly with node's type stripping.

export const OWNER_EMAIL = "maria@almarprivatejourney.com";

/** One hour: long enough to read the email and click the link. */
export const RETURN_COOKIE_MAX_AGE = 60 * 60;

/**
 * The cookie that remembers where to go after sign-in. In production the name carries the `__Host-` prefix
 * (browsers then require Secure, path "/" and no Domain attribute), like the link nonce cookie; plain http dev
 * cannot set a Secure cookie, so it gets the plain name. Every reader and writer uses this name.
 */
export function returnCookieName(env: string | undefined = process.env.NODE_ENV): string {
  return env === "production" ? "__Host-almar-return" : "almar-return";
}

/**
 * Flags for writing the return cookie, and (maxAge 0) for clearing it: a __Host- cookie is only accepted, and
 * only cleared, by a Set-Cookie that carries Secure and Path=/, which a bare cookies().delete() does not.
 */
export function returnCookieOptions(maxAge: number = RETURN_COOKIE_MAX_AGE, env: string | undefined = process.env.NODE_ENV) {
  return { httpOnly: true, sameSite: "lax" as const, secure: env === "production", path: "/", maxAge };
}
export const LOCALE_COOKIE = "almar-locale";

export type AuthLocale = "en" | "ar" | "es";
export type AuthCurrency = "AED" | "USD" | "EUR";

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** A plain shape check. The provider is the real judge. */
export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isOwnerEmail(value: string): boolean {
  return normalizeEmail(value) === OWNER_EMAIL;
}

/** A same-site path only: starts with one slash, no protocol-relative or backslash tricks. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f]/.test(path)) return "/";
  // Back to the sign-in or an auth route after signing in would loop.
  if (/^\/(login|auth)(\/|\?|#|$)/i.test(path)) return "/";
  return path;
}

export function readLocale(value: unknown): AuthLocale {
  return value === "ar" || value === "es" ? value : "en";
}

export function readCurrency(value: unknown): AuthCurrency {
  return value === "USD" || value === "EUR" ? value : "AED";
}

// Names: letters in any script (including Arabic and accents), spaces, hyphens, apostrophes.
const NAME = /^[\p{L}\p{M}](?:[\p{L}\p{M}' -]*[\p{L}\p{M}])?$/u;
// Phone: digits and one leading plus; spaces are dropped before the check.
const PHONE = /^\+?[0-9]{6,15}$/;

// Same mapping as westernDigits in lib/format.ts, kept here so this file has no imports.
function toWesternDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export type ProfileInput = {
  firstName: string;
  lastName: string;
  phone: string;
  locale: AuthLocale;
  currency: AuthCurrency;
};

export type ProfileErrorKey =
  | "addFirstName"
  | "addLastName"
  | "nameCharacters"
  | "phoneCharacters";

export type ProfileErrors = Partial<Record<"firstName" | "lastName" | "phone", ProfileErrorKey>>;

export function readProfileInput(form: {
  get(name: string): unknown;
}): ProfileInput {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  };
  return {
    firstName: text("firstName"),
    lastName: text("lastName"),
    phone: toWesternDigits(text("phone")).replace(/[\s-]/g, ""),
    locale: readLocale(form.get("locale")),
    currency: readCurrency(form.get("currency")),
  };
}

export function validateProfile(input: ProfileInput): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!input.firstName) errors.firstName = "addFirstName";
  else if (input.firstName.length > 80 || !NAME.test(input.firstName)) errors.firstName = "nameCharacters";
  if (!input.lastName) errors.lastName = "addLastName";
  else if (input.lastName.length > 80 || !NAME.test(input.lastName)) errors.lastName = "nameCharacters";
  if (input.phone && !PHONE.test(input.phone)) errors.phone = "phoneCharacters";
  return errors;
}

/** The ops host and TOUCHWORD need both: the owner role in profiles and the owner email. */
export function isOwnerProfile(profile: { role: string; email: string } | null | undefined): boolean {
  return Boolean(profile && profile.role === "owner" && isOwnerEmail(profile.email));
}
