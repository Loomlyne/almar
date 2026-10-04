"use server";

import { cookies } from "next/headers";
import { createSupabaseServer } from "../../lib/supabase/clients";
import {
  LOCALE_COOKIE,
  readCurrency,
  readLocale,
  readProfileInput,
  validateProfile,
  type ProfileErrors,
} from "../../lib/auth/rules";

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

/** Language and currency follow her account (D-21, D-22). */
export async function savePreferences(form: FormData): Promise<SaveState> {
  const locale = readLocale(form.get("locale"));
  const currency = readCurrency(form.get("currency"));
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });

  const supabase = await createSupabaseServer();
  if (!supabase) return { status: "failed" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "failed" };

  const { error } = await supabase.from("profiles").update({ locale, currency }).eq("id", data.user.id);
  return error ? { status: "failed" } : { status: "saved" };
}
