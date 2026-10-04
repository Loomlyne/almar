"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "../../../lib/supabase/clients";
import { RETURN_COOKIE, safeReturnPath } from "../../../lib/auth/rules";
import { isConfirmType } from "../../../lib/auth/continue";
import { SHELL_HEADER } from "../../../lib/host";

/** The Continue button: the only place the link's token is spent. No redirect target comes from the form. */
export async function confirmSignIn(form: FormData): Promise<void> {
  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  const store = await cookies();
  const back = safeReturnPath(store.get(RETURN_COOKIE)?.value);

  const supabase = await createSupabaseServer();
  if (supabase && typeof tokenHash === "string" && tokenHash && isConfirmType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      store.delete(RETURN_COOKIE);
      redirect(back);
    }
  }
  redirect((await headers()).get(SHELL_HEADER) === "ops" ? "/sign-in?expired=1" : "/login?expired=1");
}
