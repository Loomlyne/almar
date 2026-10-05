// The flags on her Supabase session cookie (sb-<ref>-auth-token: access + refresh token). One place, imported by
// both createServerClient call sites (lib/supabase/clients.ts and middleware.ts), so they cannot drift.
// No imports: tests load this file directly with node's type stripping.
//
// @supabase/ssr defaults are httpOnly false and no Secure; this site never builds a browser client, so no script
// has any reason to read the cookie. The library merges these over its defaults for every cookie it writes or
// clears (set, refresh and sign-out), and passes the merged options to setAll, which both sites hand on as is.
// maxAge stays the library's own (400 days).

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
};

/** Secure in production only: plain http dev cannot store a Secure cookie. */
export function sessionCookieOptions(env: string | undefined = process.env.NODE_ENV): SessionCookieOptions {
  return { httpOnly: true, secure: env === "production", sameSite: "lax", path: "/" };
}
