// Plan 02-05 (addendum 2026-10-11): the core of POST /api/preferences. No Next import, so node tests load it directly;
// app/api/preferences/route.ts binds it to her session.
//
// Fixed order: same-origin -> content type and size -> JSON -> allow-list -> session. A refusal returns before the next
// step runs, so a cross-origin request never has its body read and never reaches Supabase. No session is a quiet 204:
// a signed-out visitor's pick stays in her browser. The write goes through her own session client under RLS
// (`profiles: update own row`), never the service role. No reply ever carries anything from the request.

import { errorBody, json, readJsonBody } from "./ops/route-core";
import { parsePreferenceBody, type PreferenceFields } from "./account-preferences";

/** The body is two short fields; anything bigger is not a preference. */
export const PREFERENCES_BODY_LIMIT = 1024;

/** The public hosts this endpoint answers for in production. The ops Worker never serves it (lib/ops-routes.ts). */
const PRODUCTION_HOSTS = ["almarprivatejourney.com", "www.almarprivatejourney.com", "preview.almarprivatejourney.com"];

/** The request's own origin when its host may use this endpoint, else null. */
export function ownOrigin(host: string | null | undefined, nodeEnv: string | undefined): string | null {
  const name = (host ?? "").trim().toLowerCase();
  if (PRODUCTION_HOSTS.includes(name)) return `https://${name}`;
  if (nodeEnv !== "production" && /^(127\.0\.0\.1|localhost)(:\d{2,5})?$/.test(name)) return `http://${name}`;
  return null;
}

/**
 * Whether a POST may act. `Sec-Fetch-Site` (a header no page script can set), when present, must be `same-origin`.
 * An Origin, when present and not the literal `null`, must equal the request's own origin on an allowed host.
 * `Origin: null` is what a browser sends for a same-origin fetch from a page with `Referrer-Policy: no-referrer`
 * (and also from a sandboxed frame or a file): it is accepted only together with `Sec-Fetch-Site: same-origin`.
 * No Origin and no `Sec-Fetch-Site` is a refusal.
 */
export function checkPreferencesOrigin({
  origin,
  fetchSite,
  host,
  nodeEnv,
}: {
  origin: string | null | undefined;
  fetchSite: string | null | undefined;
  host: string | null | undefined;
  nodeEnv: string | undefined;
}): boolean {
  const own = ownOrigin(host, nodeEnv);
  if (!own) return false;
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (origin && origin !== "null") return origin === own;
  return fetchSite === "same-origin";
}

/** Her session, bound by the route file: `save` writes her own row and says whether exactly her row changed. */
export type PreferencesSession = { save: (fields: PreferenceFields) => Promise<boolean> };

const NO_CONTENT_HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" } as const;

function noContent(): Response {
  return new Response(null, { status: 204, headers: NO_CONTENT_HEADERS });
}

export async function handlePreferences(
  request: Request,
  deps: {
    nodeEnv: string | undefined;
    /** True when the request carries a Supabase auth cookie. False: 204 without asking Supabase. */
    hasSessionCookie: boolean;
    /** Her session, or null when Supabase is not configured or the cookie names no user. */
    session: () => Promise<PreferencesSession | null>;
  },
): Promise<Response> {
  const allowed = checkPreferencesOrigin({
    origin: request.headers.get("origin"),
    fetchSite: request.headers.get("sec-fetch-site"),
    host: request.headers.get("host"),
    nodeEnv: deps.nodeEnv,
  });
  if (!allowed) return json(403, errorBody("wrong_origin"));

  const read = await readJsonBody(request, PREFERENCES_BODY_LIMIT);
  if (!read.ok) return read.response;
  const fields = parsePreferenceBody(read.value);
  if (!fields) return json(400, errorBody("invalid"));

  if (!deps.hasSessionCookie) return noContent();
  try {
    const session = await deps.session();
    if (!session) return noContent();
    return (await session.save(fields)) ? noContent() : json(503, errorBody("unavailable"));
  } catch {
    console.error("[preferences] save failed");
    return json(503, errorBody("unavailable"));
  }
}

/** The Supabase surface saveOwnPreferences uses (her session client in the route, a test client in the stack test). */
export type ProfilesUpdate = {
  update: (values: PreferenceFields) => {
    eq: (column: "id", value: string) => { select: (columns: "id") => PromiseLike<{ data: unknown[] | null; error: unknown }> };
  };
};
type ProfilesClient = { from: (table: "profiles") => ProfilesUpdate };

/** Writes `fields` to her own row only. True when exactly one row (hers) changed. */
export async function saveOwnPreferences(client: ProfilesClient, userId: string, fields: PreferenceFields): Promise<boolean> {
  const values: PreferenceFields = {};
  if (fields.locale) values.locale = fields.locale;
  if (fields.currency) values.currency = fields.currency;
  const { data, error } = await client.from("profiles").update(values).eq("id", userId).select("id");
  return !error && Array.isArray(data) && data.length === 1;
}
