// Plan 04-05, Task 6 (R2): the booking page's one call to 04-08's POST /api/booking/withdraw.
//
// withdrawAnswer is pure and reads every answer: 200 `{ ok: true, status: "cancelled" }` is done (a retry after a lost
// answer is done too: the route answers an already withdrawn request with 200), 409 a refusal with its reason, 404
// gone (wrong link, signed out, unknown ref), anything else failed. postWithdraw posts `{ ref, t }` (or `{ ref }`)
// same-origin, never throws, never logs and stores nothing: the token lives in the page's memory and the POST body only.
import type { WithdrawReason, WithdrawRequest } from "../../../lib/booking/types";

export const WITHDRAW_PATH = "/api/booking/withdraw";

export type WithdrawAnswer =
  | { kind: "done" }
  | { kind: "refused"; reason: WithdrawReason }
  | { kind: "gone" }
  | { kind: "failed" };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** The page's reading of one withdraw answer (status and parsed JSON body, null when unreadable). */
export function withdrawAnswer(status: number, body: unknown): WithdrawAnswer {
  const answer = typeof body === "object" && body !== null ? (body as { ok?: unknown; status?: unknown; reason?: unknown }) : null;
  if (status === 200) {
    return answer?.ok === true && answer.status === "cancelled" ? { kind: "done" } : { kind: "failed" };
  }
  if (status === 409) {
    return { kind: "refused", reason: answer?.reason === "part_paid" ? "part_paid" : "not_withdrawable" };
  }
  if (status === 404) return { kind: "gone" };
  return { kind: "failed" };
}

/** One POST of the withdraw; `t` goes in the body only when the page has one. Resolves on every path. */
export async function postWithdraw(
  request: WithdrawRequest,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Promise<WithdrawAnswer> {
  const body: WithdrawRequest =
    typeof request.t === "string" && request.t !== "" ? { ref: request.ref, t: request.t } : { ref: request.ref };
  let res: Response;
  try {
    res = await fetchImpl(WITHDRAW_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    return { kind: "failed" };
  }
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  try {
    return withdrawAnswer(res.status, parsed);
  } catch {
    return { kind: "failed" };
  }
}
