"use server";

import { cookies } from "next/headers";
import { sendLinkFromRequest } from "../../../lib/auth/magic-link-server";
import { LOCALE_COOKIE, normalizeEmail, readLocale, returnCookieName, returnCookieOptions, safeReturnPath } from "../../../lib/auth/rules";

export type SignInState =
  | { status: "idle" }
  | { status: "invalid"; email: string }
  | { status: "sent"; email: string }
  | { status: "wait"; email: string; seconds: number }
  | { status: "unavailable"; email: string }
  /** Ops host only (plan 02-04): not the owner email. */
  | { status: "refused"; email: string };

/** Public sign-in and sign-up in one: an unknown email gets a link that creates the account. */
export async function requestSignIn(_previous: SignInState, form: FormData): Promise<SignInState> {
  const email = normalizeEmail(form.get("email"));
  const locale = readLocale(form.get("locale"));
  const store = await cookies();
  store.set(returnCookieName(), safeReturnPath(form.get("returnTo")), returnCookieOptions());

  const result = await sendLinkFromRequest({ email, locale });
  // Job 21 (PR #33 review): once the email has passed the check, the sign-in page's language becomes the remembered
  // one, so the link's Continue page, an expired link and "/" all answer in it, even for a reader who never touched
  // the language select. An invalid email remembers nothing.
  if (result.status !== "invalid") store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  switch (result.status) {
    case "sent":
      return { status: "sent", email };
    case "wait":
      return { status: "wait", email, seconds: result.seconds };
    case "invalid":
      return { status: "invalid", email };
    case "refused":
      // Posted on the ops host: the same field line as the ops form.
      return { status: "refused", email };
    default:
      return { status: "unavailable", email };
  }
}
