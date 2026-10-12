import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/clients";
import { SIGNED_IN_HINT_COOKIE, signedInHintOptions } from "../../../lib/account-preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public Sign out: this browser only, no dialog (UI-SPEC). Logout-all is the ops host's. */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
  // Plan 02-05: signed out, a public pick sends nothing again. Same flags as the set, Max-Age 0.
  response.cookies.set(SIGNED_IN_HINT_COOKIE, "", signedInHintOptions(process.env.NODE_ENV === "production", 0));
  return response;
}
