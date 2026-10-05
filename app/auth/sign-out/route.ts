import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public Sign out: this browser only, no dialog (UI-SPEC). Logout-all is the ops host's. */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
