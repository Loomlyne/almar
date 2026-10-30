// GET, POST and DELETE /api/saved-stays (plan 06-07, BOOK-07): a signed-in guest's saved stays. The rules are in
// lib/saved-stays/route.ts; this file only binds her session.
import { cookies } from "next/headers";
import { createSupabaseServer } from "../../../lib/supabase/clients";
import { handleSavedStays, type SavedSession } from "../../../lib/saved-stays/route";
import { createSupabaseAnon, savedSession } from "../../../lib/saved-stays/server";

export const dynamic = "force-dynamic";

// The same test as app/api/preferences/route.ts, which keeps its own private copy.
function isAuthCookie(name: string): boolean {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

async function ownSession(): Promise<SavedSession | null> {
  const supabase = await createSupabaseServer();
  const anon = createSupabaseAnon();
  if (!supabase || !anon) return null;
  // getUser, not getSession: it asks Supabase, so a revoked session acts on nothing.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return savedSession(supabase, data.user.id, anon);
}

async function handle(request: Request): Promise<Response> {
  const store = await cookies();
  return handleSavedStays(request, {
    nodeEnv: process.env.NODE_ENV,
    hasSessionCookie: store.getAll().some(({ name }) => isAuthCookie(name)),
    session: ownSession,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function DELETE(request: Request) {
  return handle(request);
}
