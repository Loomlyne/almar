// Plan 05-04 (P5-08, P5-09, P5-10): the handlers of GET /api/ops/home, /api/ops/customers and /api/ops/profile on 05-01's
// SQL. Like requests-handlers.ts: a local minimal owner type and type-only imports, so node tests load this with a fake rpc.
// Reads only: no ops_lapse_holds here (ops_home_numbers already leaves out a lapsed unpaid booking). Nothing is logged and
// no database text is ever copied into an answer.
import { parseListQuery } from "./booking-rules";
import { mapBookingRefusal, type OpsDb } from "./bookings-api";
import { parseHomeQuery } from "./home-rules";
import { errorBody, type DbError, type OpsOutcome, type OpsResult } from "./route-core";

type HomeOwner = { profile: { id: string; email: string; firstName?: string | null; lastName?: string | null }; admin: OpsDb };
type GetCtx = { owner: HomeOwner; url: URL };
type Row = Record<string, unknown>;

const UNREADABLE: { dbError: DbError } = { dbError: { code: "unreadable" } };

function ok(body: Record<string, unknown>): OpsResult {
  return { body: { ok: true, ...body } };
}

function refused(status: number, code: string, field: string): OpsResult {
  return { status, body: errorBody(code, field, null, null) };
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const NUMBER_FIELDS = ["bookings", "received_fils", "refunded_fils", "recorded_fils", "outstanding_fils", "outstanding_count"] as const;

/** GET /api/ops/home?range=month|30d or ?from=&to=: one ops_home_numbers call, all eight fields checked. */
export async function getHome({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const parsed = parseHomeQuery(url.searchParams, new Date());
  if (!parsed.ok) return refused(400, "invalid", parsed.field);
  const { data, error } = await owner.admin.rpc("ops_home_numbers", { p_from: parsed.from, p_to: parsed.to });
  if (error) return mapBookingRefusal(error);
  if (!isRow(data) || typeof data.from !== "string" || typeof data.to !== "string") return UNREADABLE;
  const out: Record<string, unknown> = { from: data.from, to: data.to };
  for (const key of NUMBER_FIELDS) {
    const value = data[key];
    if (typeof value !== "number" || !Number.isSafeInteger(value)) return UNREADABLE;
    out[key] = value;
  }
  return ok(out);
}

/** GET /api/ops/customers?q=&after=&limit=: one page of ops_list_customers (TEST bookings left out in SQL). */
export async function getCustomers({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const parsed = parseListQuery(url.searchParams);
  if (!parsed.ok) return refused(400, "invalid", parsed.field);
  const { q, after, limit } = parsed.query;
  const { data, error } = await owner.admin.rpc("ops_list_customers", {
    p_q: q === "" ? null : q,
    p_after: after,
    p_limit: limit,
  });
  if (error) return mapBookingRefusal(error);
  if (!isRow(data) || !Array.isArray(data.items)) return UNREADABLE;
  return ok({ items: data.items, next: typeof data.next === "string" ? data.next : null });
}

/** GET /api/ops/profile: the session's name and email. No database read beyond what requireOwner already did. */
export async function getProfile({ owner }: { owner: HomeOwner }): Promise<OpsOutcome> {
  const name = `${owner.profile.firstName ?? ""} ${owner.profile.lastName ?? ""}`.trim();
  return ok({ name: name === "" ? null : name, email: owner.profile.email });
}
