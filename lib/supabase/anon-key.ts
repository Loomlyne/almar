// lib/supabase/anon-key.ts (plan 03.2-02 review, threat T-3.2-10)
//
// The build reads the public views with the anon key and nothing else. A variable NAMED like the anon key could still hold
// a secret key, so its VALUE is checked too: a Supabase secret key (`sb_secret_…`) is refused, and so is a JWT whose
// payload `role` is not "anon" (the legacy service_role key is a JWT with role "service_role"). An opaque value that is
// neither (`sb_publishable_…`, a test value) passes. Pure, no imports: used by scripts/assemble-cloudflare.mjs,
// scripts/parity-build.mjs and lib/data/source.ts. Every message names the variable, never prints any part of the value.

function jwtRole(value: string): string | null | undefined {
  const parts = value.split(".");
  if (parts.length !== 3 || !value.startsWith("eyJ")) return undefined; // not a JWT
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload && typeof payload === "object" && typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/** Throws when `value` (the content of variable `name`) is not a public anon key. Returns the value unchanged. */
export function assertAnonKey(name: string, value: string): string {
  if (value.startsWith("sb_secret_")) {
    throw new Error(`${name} holds a Supabase secret key (sb_secret_…): the build reads with the public anon key only`);
  }
  const role = jwtRole(value);
  if (role !== undefined && role !== "anon") {
    throw new Error(`${name} holds a JWT whose role is not "anon": the build reads with the public anon key only`);
  }
  return value;
}
