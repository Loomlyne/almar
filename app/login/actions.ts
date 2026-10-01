"use server";

import { cookies } from "next/headers";
import { sendLinkFromRequest } from "../../lib/auth/magic-link-server";
import { normalizeEmail, readLocale, RETURN_COOKIE, safeReturnPath } from "../../lib/auth/rules";

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
  store.set(RETURN_COOKIE, safeReturnPath(form.get("returnTo")), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });

  const result = await sendLinkFromRequest({ email, host: "public", locale });
  switch (result.status) {
    case "sent":
      return { status: "sent", email };
    case "wait":
      return { status: "wait", email, seconds: result.seconds };
    case "invalid":
      return { status: "invalid", email };
    default:
      // "refused" never happens on the public host; treat it like an outage, not a leak.
      return { status: "unavailable", email };
  }
}
