import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdmin, createSupabaseServer } from "../../../lib/supabase/clients";
import { isOwnerEmail } from "../../../lib/auth/rules";
import { hashHandoffToken, isHandoffToken } from "../../../lib/auth/handoff";
import { opsOrigin, SHELL_HEADER } from "../../../lib/host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_TRACE = { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" };

/**
 * Redeems a TOUCHWORD handoff on the ops host (host_handoff): single use, unexpired, owner only.
 * It then signs her in on this host and lands on `/`. No redirect target is read from the query.
 * A missing, used or expired token, or a request on the marketing host, creates no session.
 */
export async function GET(request: NextRequest) {
  const onOps = request.headers.get(SHELL_HEADER) === "ops";
  const signIn = onOps
    ? new URL("/sign-in", request.nextUrl.origin)
    : new URL("/sign-in", opsOrigin(request.headers.get("host"), process.env.NODE_ENV));
  const refuse = () => NextResponse.redirect(signIn, { status: 303, headers: NO_TRACE });

  const token = request.nextUrl.searchParams.get("token");
  const admin = createSupabaseAdmin();
  const supabase = await createSupabaseServer();
  if (!onOps || !isHandoffToken(token) || !admin || !supabase) return refuse();

  // One statement marks it used, so two tabs racing on the same token cannot both pass.
  const { data: row } = await admin
    .from("host_handoff")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashHandoffToken(token))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("user_id")
    .maybeSingle();
  if (!row?.user_id) return refuse();

  const { data: found } = await admin.auth.admin.getUserById(row.user_id);
  const email = found.user?.email;
  if (!email || !isOwnerEmail(email)) return refuse();

  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (!tokenHash) return refuse();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) return refuse();

  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303, headers: NO_TRACE });
}
