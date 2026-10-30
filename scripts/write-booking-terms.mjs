// Writes lib/booking/baked-terms.snapshot.json, the booking terms version this build saw (plan 06-04, review 2026-10-30).
//
// The request gate reads the terms live, but the legal page and the checkout's link are baked. So the gate also needs
// the version it reads to equal the one baked here: requests open only once a build holding that text is deployed, and
// any later edit that changes the version closes them again until the next deploy (lib/booking/terms.ts).
//
//   node scripts/write-booking-terms.mjs       scripts/assemble-cloudflare.mjs runs it with the build's env
//
// It reads public.booking_terms_current() with the anon key only. Fixtures mode, unpublished terms, a failed or unreadable
// read: no version, so requests stay closed, and one plain line says so. Only a file that cannot be written stops the build.

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BAKED_TERMS_FILE = join(ROOT, "lib/booking/baked-terms.snapshot.json");
const CMS_VERSION = /^cms-[0-9a-f]{16}$/;

/** The version to bake and why not when there is none. Never throws. */
export async function readBakedTermsVersion(env, doFetch = fetch) {
  if (env.ALMAR_DATA_SOURCE !== "supabase") return { version: null, why: "fixtures build" };
  const url = String(env.ALMAR_BUILD_SUPABASE_URL ?? "").trim();
  const key = String(env.ALMAR_BUILD_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !key) return { version: null, why: "no anon settings" };
  try {
    const response = await doFetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/booking_terms_current`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { version: null, why: `the read answered ${response.status}` };
    const data = await response.json();
    if (data?.published !== true) return { version: null, why: "the terms are not published" };
    if (typeof data.version !== "string" || !CMS_VERSION.test(data.version)) return { version: null, why: "an unreadable version" };
    return { version: data.version, why: null };
  } catch (error) {
    return { version: null, why: `the read failed (${error?.name ?? "error"})` };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { version, why } = await readBakedTermsVersion(process.env);
  writeFileSync(BAKED_TERMS_FILE, `${JSON.stringify({ version })}\n`);
  console.log(version ? `booking terms: baked version ${version}` : `booking terms: no version baked (${why}); real requests stay closed`);
}
