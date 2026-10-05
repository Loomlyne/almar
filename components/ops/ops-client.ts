// The browser's one way to the owner API (contract 1.1, 5 and 6). Every dashboard screen, the media picker, the
// Translate button and the site status line call /api/ops/* through these three functions: this is the only file under
// components/ops that calls fetch.
//
// The owner's session cookie travels on its own (same-origin). This file never adds an Authorization header, never
// reads a token and never touches storage: the server decides who the caller is (T-3.2-11-01). The server also checks
// the Origin header of every POST and PUT; the browser sets it.
//
// None of the three ever rejects. A refused call, a dropped connection and a reply that is not JSON all come back as
// `{ ok: false, status, error }`, so a screen handles one shape.

import type { Locale3, OpsError } from "./api-types";

export type { OpsError };

/** A success body is `{ ok: true }` plus the endpoint's own fields (contract 1.1); a failure carries its HTTP status. */
export type OpsResponse<T> = ({ ok: true } & T) | { ok: false; status: number; error: OpsError };

type OpsPath = `/api/ops/${string}`;

const SIGN_IN = "/sign-in";

function failure(status: number, code: string, field: string | null = null, locale: Locale3 | null = null, detail: unknown = null): OpsResponse<never> {
  return { ok: false, status, error: { code, field, locale, detail } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocale(value: unknown): value is Locale3 {
  return value === "en" || value === "ar" || value === "es";
}

/** The `error` of an envelope, with a missing part filled in. Anything that is not an object with a code is not an error envelope. */
function readError(value: unknown): OpsError | null {
  if (!isRecord(value) || typeof value.code !== "string" || value.code.length === 0) return null;
  return {
    code: value.code,
    field: typeof value.field === "string" ? value.field : null,
    locale: isLocale(value.locale) ? value.locale : null,
    detail: value.detail === undefined ? null : value.detail,
  };
}

/** Reads a reply into the envelope, and applies the two things every call shares: the sign-in redirect and the site event. */
async function read<T>(response: Response): Promise<OpsResponse<T>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return failure(response.status, "unavailable");
  }
  if (!isRecord(body)) return failure(response.status, "unavailable");

  if (body.ok === true && response.ok) {
    // A write that reaches the public site carries the rebuild status; the site status line listens for it.
    if (body.site && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("almar:site", { detail: body.site }));
    }
    return body as { ok: true } & T;
  }

  const error = body.ok === false ? readError(body.error) : null;
  if (!error) return failure(response.status, "unavailable");
  if (response.status === 403 && error.code === "not_owner" && typeof window !== "undefined") {
    window.location.assign(SIGN_IN);
  }
  return { ok: false, status: response.status, error };
}

const JSON_HEADERS = { "content-type": "application/json" } as const;

/** One round trip. A call that never gets a reply (offline, aborted, refused) is the `network` failure. */
async function send<T>(path: string, init: RequestInit): Promise<OpsResponse<T>> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  } catch {
    return failure(0, "network");
  }
  return read<T>(response);
}

/** GET `path`, with `query` as the query string. A key whose value is undefined is left out. */
export function opsFetch<T>(path: OpsPath, query?: Record<string, string | undefined>): Promise<OpsResponse<T>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, value);
  }
  const search = params.toString();
  return send<T>(search ? `${path}?${search}` : path, { method: "GET", headers: { ...JSON_HEADERS } });
}

/** POST `body` as JSON. */
export function opsSend<T>(path: OpsPath, body: unknown): Promise<OpsResponse<T>> {
  let json: string;
  try {
    json = JSON.stringify(body);
  } catch {
    // A body that cannot be turned into JSON is a bug in the caller; it is reported, nothing is sent.
    return Promise.resolve(failure(0, "invalid"));
  }
  return send<T>(path, { method: "POST", headers: { ...JSON_HEADERS }, body: json });
}

/**
 * PUT a raw body (the image upload, contract 5.10). The body goes out as given and the headers are exactly the
 * caller's: Content-Type and the x-almar-* headers. No JSON content type is added.
 */
export function opsPut<T>(path: OpsPath, body: Blob | ArrayBuffer, headers: Record<string, string>): Promise<OpsResponse<T>> {
  return send<T>(path, { method: "PUT", headers: { ...headers }, body });
}
