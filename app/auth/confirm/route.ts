import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "../../../lib/supabase/clients";
import { RETURN_COOKIE, safeReturnPath } from "../../../lib/auth/rules";
import { SHELL_HEADER } from "../../../lib/host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Types generateLink({ type: "magiclink" }) hands back: magiclink for an existing account,
// signup for a new one. email is the current name for both.
const TYPES: EmailOtpType[] = ["magiclink", "signup", "email"];

/** The link in her email lands here. No redirect target is read from the query. */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const store = await cookies();
  const back = safeReturnPath(store.get(RETURN_COOKIE)?.value);

  const supabase = await createSupabaseServer();
  if (supabase && tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      store.delete(RETURN_COOKIE);
      return NextResponse.redirect(new URL(back, request.nextUrl.origin), 303);
    }
  }
  const signIn = request.headers.get(SHELL_HEADER) === "ops" ? "/sign-in?expired=1" : "/login?expired=1";
  return NextResponse.redirect(new URL(signIn, request.nextUrl.origin), 303);
}
