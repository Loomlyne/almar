// POST /api/preferences (plan 02-05 addendum): a language or currency pick on a public page, saved to her own profile
// when she is signed in. The rules are in lib/preferences-route.ts; this file only binds her session.
import { cookies } from "next/headers";
import { createSupabaseServer } from "../../../lib/supabase/clients";
import { handlePreferences, saveOwnPreferences } from "../../../lib/preferences-route";

export const dynamic = "force-dynamic";

function isAuthCookie(name: string): boolean {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

export async function POST(request: Request) {
  const store = await cookies();
  return handlePreferences(request, {
    nodeEnv: process.env.NODE_ENV,
    hasSessionCookie: store.getAll().some(({ name }) => isAuthCookie(name)),
    session: async () => {
      const supabase = await createSupabaseServer();
      if (!supabase) return null;
      // getUser, not getSession: it asks Supabase, so a revoked session writes nothing.
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      const userId = data.user.id;
      return { save: (fields) => saveOwnPreferences(supabase, userId, fields) };
    },
  });
}
