"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authSigningKey, createSupabaseAdmin, createSupabaseServer } from "../../../lib/supabase/clients";
import { returnCookieName, returnCookieOptions, safeReturnPath } from "../../../lib/auth/rules";
import { checkContinue, isConfirmType, linkNonceCookieName } from "../../../lib/auth/continue";
import { isTokenHashShape, limiterHash, visitorIpKey } from "../../../lib/auth/limit";
import { SHELL_HEADER } from "../../../lib/host";

export type ConfirmState = { status: "idle" } | { status: "wrong-email"; email: string };

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : null);

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

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (!error) {
    // Not delete(): its Set-Cookie has no Secure, and a __Host- cookie is only cleared by one that has it.
    store.set(returnCookieName(), "", returnCookieOptions(0));
    redirect(back);
  }
  redirect(expired);
}
