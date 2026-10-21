import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/clients";
import { SIGNED_IN_HINT_COOKIE, signedInHintOptions } from "../../../lib/account-preferences";
import { LOCALE_COOKIE } from "../../../lib/auth/rules";
import { SHELL_HEADER } from "../../../lib/host";
import { isLocale, localePath, type Locale } from "../../../lib/locale-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public Sign out: this browser only, no dialog (UI-SPEC). Logout-all is the ops host's. */
export async function POST(request: NextRequest) {
  // Job 21 (PR #33 review): back to the home in the reader's language: the page's own (the account menu's hidden
  // `locale` field), else the remembered one (almar-locale), else English. Only en, ar, es are accepted.
  const form = await request.formData().catch(() => null);
  const field = form?.get("locale");
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(field) ? field : isLocale(cookie) ? cookie : "en";
  const supabase = await createSupabaseServer();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  // The ops host has no prefixes: its "/" is the dashboard sign-in, as before.
  const home = request.headers.get(SHELL_HEADER) === "ops" ? "/" : localePath(locale, "/");
  const response = NextResponse.redirect(new URL(home, request.nextUrl.origin), 303);
  // Plan 02-05: signed out, a public pick sends nothing again. Same flags as the set, Max-Age 0.
  response.cookies.set(SIGNED_IN_HINT_COOKIE, "", signedInHintOptions(process.env.NODE_ENV === "production", 0));
  return response;
}
