// Plan 04-06, Task 3 (P6-12): the trip page's calls to POST /api/booking/request and POST /api/booking/view, over
// 04-03's postJson (client.ts is not edited). Same-origin JSON only: the browser sets the Origin itself and the server
// checks it (F-02), so nothing here writes one. Both resolve `{ status, json }` and never throw: a network error or the
// timeout is status 0 (postJson's contract). after-request.ts reads the answers.
import { postJson, type BookingApiPath, type PostResult } from "./client";
import type { RequestRequest, ViewRequest } from "./types";

export const REQUEST_PATH: BookingApiPath = "/api/booking/request";
export const VIEW_PATH: BookingApiPath = "/api/booking/view";

/** The request writes and may send an email: it gets longer than postJson's default before it counts as lost. */
export const REQUEST_TIMEOUT_MS = 20000;

/** POST /api/booking/request `{ ref, t }`, exactly the two keys. */
export function postRequest(input: RequestRequest, signal?: AbortSignal): Promise<PostResult> {
  return postJson(REQUEST_PATH, { ref: input.ref, t: input.t }, { signal, timeoutMs: REQUEST_TIMEOUT_MS });
}

/** POST /api/booking/view `{ ref, t?, locale? }`: a key the caller left out is not sent. */
export function postView(input: ViewRequest, signal?: AbortSignal): Promise<PostResult> {
  const body: ViewRequest = { ref: input.ref };
  if (input.t !== undefined) body.t = input.t;
  if (input.locale !== undefined) body.locale = input.locale;
  return postJson(VIEW_PATH, body, { signal, timeoutMs: REQUEST_TIMEOUT_MS });
}
