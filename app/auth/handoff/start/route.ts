import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdmin, readSessionProfile } from "../../../../lib/supabase/clients";
import { isOwnerProfile } from "../../../../lib/auth/rules";
import { handoffExpiry, hashHandoffToken, newHandoffToken } from "../../../../lib/auth/handoff";
import { opsOrigin, SHELL_HEADER } from "../../../../lib/host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_TRACE = { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" };

/**
 * TOUCHWORD (plan 02-04): on the public host, for the owner session only, issue a fresh one-time
 * handoff and send her to the ops host to redeem it. Anyone else goes home with nothing issued.
 */
export async function GET(request: NextRequest) {
  const home = NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303, headers: NO_TRACE });
  if (request.headers.get(SHELL_HEADER) === "ops") return home;

  const profile = await readSessionProfile();
  const admin = createSupabaseAdmin();
  if (!profile || !isOwnerProfile(profile) || !admin) return home;

  const token = newHandoffToken();
  const { error } = await admin.from("host_handoff").insert({
    token_hash: hashHandoffToken(token),
    user_id: profile.id,
    expires_at: handoffExpiry(new Date()),
  });
  if (error) return home;

  const target = new URL("/auth/handoff", opsOrigin(request.headers.get("host"), process.env.NODE_ENV));
  target.searchParams.set("token", token);
  return NextResponse.redirect(target, { status: 303, headers: NO_TRACE });
}
