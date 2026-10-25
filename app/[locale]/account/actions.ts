"use server";

import { cookies } from "next/headers";
import { createSupabaseServer } from "../../../lib/supabase/clients";
import { parseAccountCurrency, parseAccountLocale } from "../../../lib/account-preferences";
import {
  LOCALE_COOKIE,
  readProfileInput,
  validateProfile,
  type ProfileErrors,
} from "../../../lib/auth/rules";

export type SaveState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: ProfileErrors }
  | { status: "failed" };

/** Her own row only, under RLS with her session. Never role or email. */
export async function saveProfile(form: FormData): Promise<SaveState> {
  const input = readProfileInput(form);
  const errors = validateProfile(input);
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };

  const supabase = await createSupabaseServer();
  if (!supabase) return { status: "failed" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "failed" };

  // Zero rows updated (no profile row, or RLS hid it) is a failure, never a silent "saved".
  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ first_name: input.firstName, last_name: input.lastName, phone: input.phone || null })
    .eq("id", data.user.id)
    .select("id");
  return error || !updated || updated.length === 0 ? { status: "failed" } : { status: "saved" };
}

/**
 * Language and currency follow her account (D-21, D-22). Only the fields the form carries are written (PR #33 review:
 * a currency change on /ar/account must not also save locale=ar); a field that is present but not an allowed value,
 * or a form with neither, is a failure, never repaired.
 */
export async function savePreferences(form: FormData): Promise<SaveState> {
  const update: { locale?: "en" | "ar" | "es"; currency?: "AED" | "USD" | "EUR" } = {};
  if (form.has("locale")) {
    const locale = parseAccountLocale(form.get("locale"));
    if (!locale) return { status: "failed" };
    update.locale = locale;
  }
  if (form.has("currency")) {
    const currency = parseAccountCurrency(form.get("currency"));
    if (!currency) return { status: "failed" };
    update.currency = currency;
  }
  if (!update.locale && !update.currency) return { status: "failed" };

  const supabase = await createSupabaseServer();
  if (!supabase) return { status: "failed" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "failed" };

  const { error } = await supabase.from("profiles").update(update).eq("id", data.user.id);
  if (error) return { status: "failed" };
  // A language pick is also this browser's remembered language ("/" reads it), only once it is saved.
  if (update.locale) (await cookies()).set(LOCALE_COOKIE, update.locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return { status: "saved" };
}
