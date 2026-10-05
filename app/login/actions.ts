"use server";

import { cookies } from "next/headers";
import { sendLinkFromRequest } from "../../lib/auth/magic-link-server";
import { normalizeEmail, readLocale, returnCookieName, returnCookieOptions, safeReturnPath } from "../../lib/auth/rules";

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
