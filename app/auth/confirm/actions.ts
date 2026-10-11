"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authSigningKey, createSupabaseAdmin, createSupabaseServer } from "../../../lib/supabase/clients";
import { LOCALE_COOKIE, returnCookieName, returnCookieOptions, safeReturnPath } from "../../../lib/auth/rules";
import {
  PREFS_SYNC_COOKIE,
  PREFS_SYNC_MAX_AGE,
  isNewAccount,
  localizedReturnPath,
  parseAccountCurrency,
  parseAccountLocale,
} from "../../../lib/account-preferences";
import { saveOwnPreferences } from "../../../lib/preferences-route";
import type { Locale } from "../../../lib/locale-path";
import { checkContinue, isConfirmType, linkNonceCookieName } from "../../../lib/auth/continue";
import { isTokenHashShape, limiterHash, visitorIpKey } from "../../../lib/auth/limit";
import { SHELL_HEADER } from "../../../lib/host";

export type ConfirmState = { status: "idle" } | { status: "wrong-email"; email: string };

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : null);

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type SessionClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServer>>>;

/**
 * Plan 02-05 (addendum): her account's language and currency follow her into this browser. Reads her own row with
 * the session verifyOtp just set (RLS). A returning account: almar-locale := her saved language, and her saved
 * currency goes to the browser in the one-shot almar-prefs-sync cookie (public pages only). A new account (row made
 * by this confirmation) keeps what she was already using: the browser's language is saved to her row, and
 * almar-prefs-sync = "push" asks the browser to send its currency. Returns the language to send her back in, or null.
 * Never throws: a failure here must not cost her the sign-in.
 */
async function followAccount(supabase: SessionClient, userId: string | undefined, store: CookieStore, ops: boolean): Promise<Locale | null> {
  if (!userId) return null;
  try {
    const { data: row } = await supabase.from("profiles").select("locale, currency, created_at").eq("id", userId).maybeSingle();
    if (!row) return null;
    const sync = { path: "/", maxAge: PREFS_SYNC_MAX_AGE, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
    if (isNewAccount(row.created_at, Date.now())) {
      const browser = parseAccountLocale(store.get(LOCALE_COOKIE)?.value);
      if (browser && browser !== row.locale) await saveOwnPreferences(supabase, userId, { locale: browser });
      if (!ops) store.set(PREFS_SYNC_COOKIE, "push", sync);
      return browser ?? parseAccountLocale(row.locale);
    }
    const locale = parseAccountLocale(row.locale);
    const currency = parseAccountCurrency(row.currency);
    if (locale) store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
    if (currency && !ops) store.set(PREFS_SYNC_COOKIE, currency, sync);
    return locale;
  } catch {
    return null;
  }
}

/**
 * The Continue button: the only place the link's token is spent. No redirect target comes from the form.
 * Order: the token's shape, then this IP's slot (30 an hour; a failed limiter closes the door), then the
 * browser/email check (plan 02-26: cookie nonce vs `b`, else the typed email vs `e`; a wrong email returns
 * a state, the token is not spent and the attempt already counted), then verifyOtp.
 */
export async function confirmSignIn(_previous: ConfirmState, form: FormData): Promise<ConfirmState> {
  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  const list = await headers();
  const expired = list.get(SHELL_HEADER) === "ops" ? "/sign-in?expired=1" : "/login?expired=1";
  if (!isTokenHashShape(tokenHash) || !isConfirmType(type)) redirect(expired);

  const store = await cookies();
  const back = safeReturnPath(store.get(returnCookieName())?.value);

  const limitKey = authSigningKey("limit");
  const admin = createSupabaseAdmin();
  const supabase = await createSupabaseServer();
  if (!limitKey || !admin || !supabase) redirect(expired);

  let allowed = false;
  try {
    const { data, error } = await admin.rpc("claim_confirm_slot", {
      p_ip_key: limiterHash(limitKey, "confirm", visitorIpKey(list.get("x-forwarded-for"))),
    });
    allowed = !error && data === true;
  } catch {
    allowed = false;
  }
  if (!allowed) redirect(expired);

  const email = text(form.get("email")) ?? "";
  const verdict = checkContinue({
    key: authSigningKey("continue"),
    nonce: store.get(linkNonceCookieName())?.value,
    tokenHash,
    b: text(form.get("b")),
    e: text(form.get("e")),
    email,
  });
  if (verdict === "closed") redirect(expired);
  if (verdict === "wrong-email") return { status: "wrong-email", email: email.slice(0, 254) };

  const { data: verified, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (!error) {
    // Not delete(): its Set-Cookie has no Secure, and a __Host- cookie is only cleared by one that has it.
    store.set(returnCookieName(), "", returnCookieOptions(0));
    const ops = list.get(SHELL_HEADER) === "ops";
    const locale = await followAccount(supabase, verified.user?.id, store, ops);
    // The ops host has no /ar or /es pages: its return path is never localised.
    redirect(locale && !ops ? localizedReturnPath(back, locale) : back);
  }
  redirect(expired);
}
