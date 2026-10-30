// Plan 06-07: the core of GET, POST and DELETE /api/saved-stays. No Next or Supabase import, so node tests load it directly;
// app/api/saved-stays/route.ts binds it to her session.
//
// Fixed order for a write: method -> Origin (the rule of /api/preferences) -> content type and size -> JSON -> slug -> session
// -> act. A refusal returns before the next step runs, so a cross-site request never has its body read and never reaches
// Supabase. A signed-out GET is a quiet 200, never a 401, so a stale sign-in hint makes no noise. Nothing from the request, no
// user id and no slug is ever logged.

import { checkPreferencesOrigin } from "../preferences-route";
import { errorBody, json, readJsonBody } from "../ops/route-core";
import { isStaySlug } from "./rules";

/** `{"stay":"<slug>"}` with a slug of at most 80 characters fits with room to spare. */
export const SAVED_STAYS_BODY_LIMIT = 256;

/** Her saved stays, through her own session (RLS own rows). Bound in lib/saved-stays/server.ts. */
export type SavedSession = {
  /** The slugs of her saved, published stays, newest first. */
  list(): Promise<string[]>;
  save(slug: string): Promise<"saved" | "not_found">;
  remove(slug: string): Promise<void>;
};

export type SavedStaysDeps = {
  nodeEnv: string | undefined;
  /** True when the request carries a Supabase auth cookie. False: no call to Supabase. */
  hasSessionCookie: boolean;
  /** Her session, or null when Supabase is not configured or the cookie names no user. */
  session: () => Promise<SavedSession | null>;
};

function answer(status: number, body: unknown): Response {
  const response = json(status, body);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

const refuse = (status: number, code: string) => answer(status, errorBody(code));

function sameSite(request: Request, nodeEnv: string | undefined): boolean {
  return checkPreferencesOrigin({
    origin: request.headers.get("origin"),
    fetchSite: request.headers.get("sec-fetch-site"),
    host: request.headers.get("host"),
    nodeEnv,
  });
}

/** The slug of a POST body: a plain object with `stay` as its only key. Null for anything else. */
function slugOfBody(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "stay") return null;
  const { stay } = value as { stay: unknown };
  return isStaySlug(stay) ? stay : null;
}

async function read(deps: SavedStaysDeps): Promise<Response> {
  if (!deps.hasSessionCookie) return answer(200, { ok: true, signedIn: false });
  try {
    const session = await deps.session();
    if (!session) return answer(200, { ok: true, signedIn: false });
    return answer(200, { ok: true, signedIn: true, stays: await session.list() });
  } catch {
    console.error("[saved-stays] list failed");
    return refuse(503, "unavailable");
  }
}

async function write(deps: SavedStaysDeps, act: (session: SavedSession) => Promise<Response>): Promise<Response> {
  if (!deps.hasSessionCookie) return refuse(401, "signed_out");
  try {
    const session = await deps.session();
    return session ? await act(session) : refuse(401, "signed_out");
  } catch {
    console.error("[saved-stays] write failed");
    return refuse(503, "unavailable");
  }
}

export async function handleSavedStays(request: Request, deps: SavedStaysDeps): Promise<Response> {
  const { method } = request;
  if (method === "GET" || method === "HEAD") return read(deps);
  if (method !== "POST" && method !== "DELETE") return refuse(405, "method_not_allowed");
  if (!sameSite(request, deps.nodeEnv)) return refuse(403, "wrong_origin");

  if (method === "POST") {
    // The contract answers every bad body the same way: wrong type, too large and bad JSON are all 400 invalid.
    const body = await readJsonBody(request, SAVED_STAYS_BODY_LIMIT);
    const slug = body.ok ? slugOfBody(body.value) : null;
    if (!slug) return refuse(400, "invalid");
    return write(deps, async (session) =>
      (await session.save(slug)) === "saved" ? answer(200, { ok: true, saved: true }) : refuse(404, "not_found"),
    );
  }

  const slug = new URL(request.url).searchParams.get("stay");
  if (!isStaySlug(slug)) return refuse(400, "invalid");
  return write(deps, async (session) => {
    await session.remove(slug);
    return answer(200, { ok: true, saved: false });
  });
}
