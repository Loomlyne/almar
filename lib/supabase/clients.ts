// Supabase clients for server code only (plan 02-02). The service-role key is read here and
// nowhere else (tests/secrets.test.mjs). Missing settings return null instead of throwing, so a
// page never prints a stack that names a key. Storage is never used: media lives on Cloudflare.
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";

function publicSettings(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

/** Her session, from the request cookies. Server components, actions and route handlers. */
export async function createSupabaseServer(): Promise<SupabaseClient | null> {
  const settings = publicSettings();
  if (!settings) return null;
  const store = await cookies();
  return createServerClient(settings.url, settings.anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // A server component cannot set cookies; middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Service role. Server actions only; never passed to a client component. */
export function createSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Keys for our own signatures, derived from the service-role key so the key itself is never used as an HMAC
 * key and each use has its own label. Null when the key is not set (the callers fail closed or sign nothing).
 * This is the only place the service-role key is read for signing.
 */
export function authSigningKey(label: "continue" | "limit"): Buffer | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) return null;
  return createHmac("sha256", serviceKey).update(`almar-${label}-v1`).digest();
}

export type SessionProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  locale: "en" | "ar" | "es";
  currency: "AED" | "USD" | "EUR";
  role: "guest" | "owner";
};

/** The signed-in user and her profile row, or null. Uses getUser, never getSession. */
export async function readSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: row } = await supabase
    .from("profiles")
    .select("email, first_name, last_name, phone, locale, currency, role")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    id: data.user.id,
    email: (row?.email ?? data.user.email ?? "").toLowerCase(),
    firstName: row?.first_name ?? "",
    lastName: row?.last_name ?? "",
    phone: row?.phone ?? "",
    locale: row?.locale === "ar" || row?.locale === "es" ? row.locale : "en",
    currency: row?.currency === "USD" || row?.currency === "EUR" ? row.currency : "AED",
    role: row?.role === "owner" ? "owner" : "guest",
  };
}
