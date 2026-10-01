"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sendLinkFromRequest } from "../../lib/auth/magic-link-server";
import { normalizeEmail, readLocale, RETURN_COOKIE } from "../../lib/auth/rules";
import { createSupabaseServer } from "../../lib/supabase/clients";
import type { SignInState } from "../login/actions";

/**
 * Plan 02-04 ops sign-in. Only the owner email gets a link; any other email is refused before
 * Supabase is called, so a guest never gets an account or a session here.
 */
export async function opsSignIn(_previous: SignInState, form: FormData): Promise<SignInState> {
  const email = normalizeEmail(form.get("email"));
  const locale = readLocale(form.get("locale"));
  (await cookies()).set(RETURN_COOKIE, "/", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });

  const result = await sendLinkFromRequest({ email, host: "ops", locale });
  switch (result.status) {
    case "sent":
      return { status: "sent", email };
    case "wait":
      return { status: "wait", email, seconds: result.seconds };
    case "invalid":
      return { status: "invalid", email };
    case "refused":
      return { status: "refused", email };
    default:
      return { status: "unavailable", email };
  }
}

/** Logout-all: global scope revokes every session of hers, on both hosts. */
export async function signOutEverywhere(): Promise<void> {
  const supabase = await createSupabaseServer();
  if (supabase) await supabase.auth.signOut({ scope: "global" });
  redirect("/");
}
