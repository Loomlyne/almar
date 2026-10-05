import { cookies } from "next/headers";
import { LOCALE_COOKIE, readLocale, type AuthLocale } from "./auth/rules";

/**
 * The language for a server-rendered page: the almar-locale cookie when it holds en, ar or es,
 * else the fallback (her saved profile language), else en. Any other cookie value is ignored.
 */
export async function requestLocale(fallback?: AuthLocale): Promise<AuthLocale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (value === "en" || value === "ar" || value === "es") return value;
  return fallback ?? readLocale(undefined);
}
