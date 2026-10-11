// lib/data/anon-key.ts (plan 03.2-02 review, threat T-3.2-10)
//
// The build reads the public views with the anon key and nothing else. A variable NAMED like the anon key could still hold
// a secret key, so its VALUE is checked too: a Supabase secret key (`sb_secret_…`, any case, quoted or not) is refused, and
// so is every value of three dot-separated parts (the shape of a JWT) unless its payload decodes and its `role` is "anon"
// (the legacy service_role key is a JWT with role "service_role"). An opaque value that is neither (`sb_publishable_…`, a
// test value) passes. Pure, no imports: used by scripts/assemble-cloudflare.mjs, scripts/parity-build.mjs and
// lib/data/source.ts (it sits in lib/data because the data tests build scratch copies of that folder). Every message names
// the variable, never prints any part of the value.

/** The `role` of a three-part value's payload; null when the payload is not a JSON object with a string role. */
function jwtRole(parts: string[]): string | null {
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload && typeof payload === "object" && typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/** Throws when `value` (the content of variable `name`) is not a public anon key. Returns the value unchanged. */
export function assertAnonKey(name: string, value: string): string {
  const bare = value.trim().replace(/^["'`]+|["'`]+$/g, "");
  if (bare.toLowerCase().startsWith("sb_secret_")) {
    throw new Error(`${name} holds a Supabase secret key (sb_secret_…): the build reads with the public anon key only`);
  }
  const parts = bare.split(".");
  if (parts.length === 3 && jwtRole(parts) !== "anon") {
    throw new Error(`${name} holds a JWT whose role is not "anon" (or that cannot be read): the build reads with the public anon key only`);
  }
  return value;
}
