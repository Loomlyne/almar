// Plan 06-05: the request validators of /api/ops/requests and /api/ops/consult, in the style of validate-posts.ts. The bodies are
// 06-01's types (lib/ops/site-cms-api.ts). The bounds mirror ops_save_consult in migration 20261025120000_site_cms.sql and are
// input sanity only: no default notice or horizon is written anywhere (F-04). Nothing here reads the actor: it comes from the session.

import type { ConsultBody, RequestsQuery, SetHandledBody } from "./site-cms-api";
import { OpsInvalid } from "./route-core";
import { SITE_REQUEST_KINDS, type SiteRequestKind } from "../site-requests/types";
import { bool, has, intOrNull, int, isRecord, isoDay, onlyKeys, record, uuid } from "./validate";

const STARTS = /^([01]\d|2[0-3]):(00|30)$/;
const ENDS = /^(([01]\d|2[0-3]):(00|30)|24:00)$/;
const MAX_RANGES = 70;
const MAX_DAYS_OFF = 366;

/** ?kind=all|plan|list|package|consultation & handled=all|yes|no. Absent means all. */
export function parseRequestsQuery(query: URLSearchParams): RequestsQuery {
  const kind = query.get("kind") ?? "all";
  if (kind !== "all" && !(SITE_REQUEST_KINDS as readonly string[]).includes(kind)) throw new OpsInvalid("kind");
  const handled = query.get("handled") ?? "all";
  if (handled !== "all" && handled !== "yes" && handled !== "no") throw new OpsInvalid("handled");
  return { kind: kind as SiteRequestKind | "all", handled };
}

export function parseRequestsAction(value: unknown): SetHandledBody {
  if (!isRecord(value)) throw new OpsInvalid("body");
  onlyKeys(value, ["id", "handled"]);
  return { id: uuid(value.id, "id"), handled: bool(value.handled, "handled") };
}

function hours(value: unknown): NonNullable<Extract<ConsultBody, { action: "save" }>["hours"]> {
  if (!Array.isArray(value) || value.length > MAX_RANGES) throw new OpsInvalid("hours");
  const seen: Array<{ weekday: number; starts: string; ends: string }> = [];
  value.forEach((item, at) => {
    const path = `hours.${at}`;
    const row = record(item, path);
    onlyKeys(row, ["weekday", "starts", "ends"], `${path}.`);
    const weekday = int(row.weekday, `${path}.weekday`, { min: 1, max: 7 });
    if (typeof row.starts !== "string" || !STARTS.test(row.starts)) throw new OpsInvalid(`${path}.starts`);
    if (typeof row.ends !== "string" || !ENDS.test(row.ends)) throw new OpsInvalid(`${path}.ends`);
    const { starts, ends } = row;
    if (starts >= ends) throw new OpsInvalid(`${path}.ends`);
    if (seen.some((other) => other.weekday === weekday && starts < other.ends && other.starts < ends)) throw new OpsInvalid(path);
    seen.push({ weekday, starts, ends });
  });
  return seen;
}

function daysOff(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_DAYS_OFF) throw new OpsInvalid("days_off");
  const days = value.map((day, at) => isoDay(day, `days_off.${at}`));
  if (new Set(days).size !== days.length) throw new OpsInvalid("days_off");
  return days;
}

export function parseConsultAction(value: unknown): ConsultBody {
  if (!isRecord(value)) throw new OpsInvalid("body");
  if (value.action === "cancel") {
    onlyKeys(value, ["action", "booking_id"]);
    return { action: "cancel", booking_id: uuid(value.booking_id, "booking_id") };
  }
  if (value.action !== "save") throw new OpsInvalid("action");
  onlyKeys(value, ["action", "hours", "days_off", "notice_hours", "horizon_days"]);
  const out: Extract<ConsultBody, { action: "save" }> = { action: "save" };
  if (has(value, "hours")) out.hours = hours(value.hours);
  if (has(value, "days_off")) out.days_off = daysOff(value.days_off);
  if (has(value, "notice_hours")) out.notice_hours = intOrNull(value.notice_hours, "notice_hours", { min: 0, max: 720 });
  if (has(value, "horizon_days")) out.horizon_days = intOrNull(value.horizon_days, "horizon_days", { min: 1, max: 365 });
  return out;
}
