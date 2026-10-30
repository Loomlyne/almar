// Save, then email (plan 06-05, T-06-05-01, T-06-05-03..09): the three public endpoints on Worker `almar` and the helper 06-06
// reuses for the package request. Server only; every outside thing arrives in `deps` (lib/site-requests/real-deps.ts), so node
// tests drive this with a fake admin and a fake mailer. Only 06-01's functions are called, with the service role.
//
// Every POST runs the contact route's order: origin 403, urlencoded 415, body cap 413, rate limit 429, honeypots 400, fields
// 400 with error codes, admin missing 503, then the kind's prepare hook (package) and the save. The row is saved before any
// email, so a failed send (or a missing RESEND_API_KEY) never loses a request: the reply says `emailed: false`. Nothing
// submitted is logged; a failed send logs Resend's error name only (real-deps.ts). A missing service-role key is 503 on all
// three endpoints, before any read or write.

import type { SupabaseClient } from "@supabase/supabase-js";
import { INQUIRY_ADDRESS, honeypotTripped, type InquiryEmail } from "../contact-inquiry";
import { SITE_REQUESTS_COPY } from "../copy/site-requests";
import type { EmailBrand } from "../email/magic-link";
import { allowFormPost, type FormLimiter, type FormScope } from "../form-rate-limit";
import { isLocale, type Locale } from "../locale-path";
import type { ConsultSlotsReply } from "../ops/site-cms-api";
import { formReply, readFormBody, sameOrigin } from "../public-form-post";
import { ALMAR_WHATSAPP_NUMBER } from "../whatsapp-request";
import { composeConsultationOwnerEmail, composeRequestEmail, printedWhatsapp, renderConsultationGuestEmail } from "./email";
import { consultationIcs } from "./ics";
import type { SiteRequestKind } from "./types";
import { REQUEST_FIELD, SITE_REQUEST_BODY_LIMIT, validateSiteRequest, type RequestPayload } from "./validate";

export type OutgoingEmail = InquiryEmail & {
  html?: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
};

export type SiteRequestDeps = {
  /** Null when the service-role key is missing: every endpoint answers 503. */
  admin: SupabaseClient | null;
  /** True when the mail was accepted. Never throws (real-deps.ts); a thrown error counts as not sent. */
  send: (email: OutgoingEmail, options: { idempotencyKey: string }) => Promise<boolean>;
  brand: () => Promise<EmailBrand | null>;
  now: () => Date;
  /** The test seam of allowFormPost; absent on a Worker. */
  limiter?: FormLimiter | null;
};

const refused = (status: number) => formReply({ ok: false }, status);

// ---- Plan, List, Package --------------------------------------------------------------------------------------------

export type SubmitSiteRequestInput = {
  kind: SiteRequestKind;
  locale: Locale;
  payload: RequestPayload;
  /** Lines a kind's prepare hook built; they follow the payload lines in the email. */
  emailLines?: readonly string[];
};

export type SubmitSiteRequestResult = { ok: true; id: string; emailed: boolean } | { ok: false; status: number };

/** Saves through submit_site_request, then emails inquiries@. `almar:invalid` (an unpublished package) is 400, any other refusal 503. */
export async function submitSiteRequest(deps: SiteRequestDeps, input: SubmitSiteRequestInput): Promise<SubmitSiteRequestResult> {
  if (!deps.admin) return { ok: false, status: 503 };
  const { data, error } = await deps.admin.rpc("submit_site_request", { p_kind: input.kind, p_locale: input.locale, p_payload: input.payload });
  if (error) return { ok: false, status: error.message === "almar:invalid" ? 400 : 503 };
  const id = data && typeof data === "object" && typeof (data as { id?: unknown }).id === "string" ? (data as { id: string }).id : null;
  if (!id) return { ok: false, status: 503 };
  let emailed = false;
  try {
    emailed = await deps.send(composeRequestEmail(input.kind, input.locale, input.payload, id, input.emailLines ?? []), { idempotencyKey: `site-request/${id}` });
  } catch {
    emailed = false;
  }
  return { ok: true, id, emailed };
}

/** A kind's own step between validation and the save (06-06: reads published rows, never writes). */
export type PrepareRequest = (
  kind: SiteRequestKind,
  payload: RequestPayload,
  admin: SupabaseClient,
) => Promise<{ ok: true; emailLines: string[] } | { ok: false; errors?: Record<string, string> }>;

type ReadForm = { ok: true; params: URLSearchParams } | { ok: false; response: Response };

/** The order every public form POST shares, up to and including the honeypots. */
async function readForm(request: Request, scope: FormScope, deps: SiteRequestDeps): Promise<ReadForm> {
  if (!sameOrigin(request)) return { ok: false, response: refused(403) };
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/x-www-form-urlencoded\s*(;|$)/i.test(type)) return { ok: false, response: refused(415) };
  const body = await readFormBody(request, SITE_REQUEST_BODY_LIMIT);
  if (!body.ok) return { ok: false, response: refused(body.status) };
  if (!(await allowFormPost(request, scope, deps.limiter))) return { ok: false, response: refused(429) };
  const params = new URLSearchParams(body.text);
  if (honeypotTripped((name) => params.get(name))) return { ok: false, response: refused(400) };
  return { ok: true, params };
}

/** POST /api/requests: one order for every kind in `kinds`; no per-kind code here. */
export async function handleSiteRequestPost(
  request: Request,
  deps: SiteRequestDeps,
  kinds: readonly SiteRequestKind[],
  prepare: Partial<Record<SiteRequestKind, PrepareRequest>> = {},
): Promise<Response> {
  const form = await readForm(request, "request", deps);
  if (!form.ok) return form.response;
  const { params } = form;

  const kind = params.get(REQUEST_FIELD.kind);
  const known = kinds.find((k) => k === kind);
  if (!known) return refused(400);
  const locale = params.get(REQUEST_FIELD.locale);
  if (!isLocale(locale)) return formReply({ ok: false, errors: { locale: "invalid" } }, 400);

  const checked = validateSiteRequest(known, params);
  if (!checked.ok) return formReply({ ok: false, errors: checked.errors }, 400);
  if (!deps.admin) return refused(503);

  let emailLines: string[] = [];
  const hook = prepare[known];
  if (hook) {
    const prepared = await hook(known, checked.payload, deps.admin);
    if (!prepared.ok) return formReply({ ok: false, errors: prepared.errors ?? {} }, 400);
    emailLines = prepared.emailLines;
  }

  const saved = await submitSiteRequest(deps, { kind: known, locale, payload: checked.payload, emailLines });
  if (!saved.ok) return refused(saved.status);
  return formReply({ ok: true, emailed: saved.emailed }, 200);
}

// ---- Consultation ---------------------------------------------------------------------------------------------------

export type ConsultRefusalReason = "slot_taken" | "closed" | "unavailable" | "invalid" | "error";

export type BookConsultationResult =
  | { ok: true; request_id: string; booking_id: string; slot_start: string; emailed: boolean }
  | { ok: false; status: number; reason: ConsultRefusalReason };

function bookingRefusal(message: string | null | undefined): { status: number; reason: ConsultRefusalReason } {
  switch (message) {
    case "almar:slot_taken":
      return { status: 409, reason: "slot_taken" };
    case "almar:consult_closed":
      return { status: 409, reason: "closed" };
    case "almar:slot_outside_hours":
    case "almar:slot_too_soon":
    case "almar:slot_too_far":
      return { status: 409, reason: "unavailable" };
    case "almar:invalid":
      return { status: 400, reason: "invalid" };
    default:
      return { status: 503, reason: "error" };
  }
}

/** The invitation, in the guest's language; inquiries@ gets the same file. */
function invitation(locale: Locale, bookingId: string, start: string, phone: string, now: Date): OutgoingEmail["attachments"] {
  const g = SITE_REQUESTS_COPY[locale].guestEmail;
  const whatsapp = printedWhatsapp(ALMAR_WHATSAPP_NUMBER);
  const description = `${g.wa.replace("{phone}", phone).replace("{whatsapp}", whatsapp)}\n${g.cancel}`;
  const ics = consultationIcs({ bookingId, start, minutes: 30, summary: g.subject, description, now });
  const content = Buffer.from(ics, "utf-8").toString("base64");
  return [{ filename: "almar-consultation.ics", content, contentType: "text/calendar; charset=utf-8; method=PUBLISH" }];
}

/**
 * Saves through book_consultation (its lock and the partial unique index settle two guests on one slot), then the guest's and
 * the owner's emails, each with the .ics. A failed email never undoes the booking; `emailed` is the guest's. Each email has its
 * own try: a saved brand that cannot be read costs the guest's email, never the owner's word of the call.
 */
export async function bookConsultation(deps: SiteRequestDeps, input: { locale: Locale; payload: RequestPayload }): Promise<BookConsultationResult> {
  if (!deps.admin) return { ok: false, status: 503, reason: "error" };
  const { data, error } = await deps.admin.rpc("book_consultation", { p_locale: input.locale, p_payload: input.payload });
  if (error) return { ok: false, ...bookingRefusal(error.message) };
  const row = (data ?? {}) as { request_id?: unknown; booking_id?: unknown; slot_start?: unknown };
  if (typeof row.request_id !== "string" || typeof row.booking_id !== "string" || typeof row.slot_start !== "string") {
    return { ok: false, status: 503, reason: "error" };
  }
  const { request_id, booking_id, slot_start } = row;
  const payload = input.payload;
  const name = String(payload.name ?? "");
  const phone = String(payload.phone ?? "");
  const timeZone = String(payload.time_zone ?? "");

  const attachments = invitation(input.locale, booking_id, slot_start, phone, deps.now());
  let emailed = false;
  try {
    const guest = renderConsultationGuestEmail({
      locale: input.locale,
      name,
      startIso: slot_start,
      timeZone,
      phone,
      whatsappNumber: printedWhatsapp(ALMAR_WHATSAPP_NUMBER),
      copy: SITE_REQUESTS_COPY[input.locale].guestEmail,
      brand: await deps.brand(),
    });
    // Reply-to inquiries@: she cancels by replying (F-04).
    emailed = await deps.send(
      { from: INQUIRY_ADDRESS, to: String(payload.email), replyTo: INQUIRY_ADDRESS, subject: guest.subject, html: guest.html, text: guest.text, attachments },
      { idempotencyKey: `consult-guest/${booking_id}` },
    );
  } catch {
    // The booking stands; the guest is told the email failed.
  }
  try {
    await deps.send(
      { ...composeConsultationOwnerEmail({ payload, requestId: request_id, startIso: slot_start, timeZone }), attachments },
      { idempotencyKey: `consult-owner/${booking_id}` },
    );
  } catch {
    // The booking stands and shows in the dashboard.
  }
  return { ok: true, request_id, booking_id, slot_start, emailed };
}

/** POST /api/consult/book. */
export async function handleConsultBookPost(request: Request, deps: SiteRequestDeps): Promise<Response> {
  const form = await readForm(request, "consult", deps);
  if (!form.ok) return form.response;
  const { params } = form;
  const locale = params.get(REQUEST_FIELD.locale);
  if (!isLocale(locale)) return formReply({ ok: false, errors: { locale: "invalid" } }, 400);
  const checked = validateSiteRequest("consultation", params);
  if (!checked.ok) return formReply({ ok: false, errors: checked.errors }, 400);
  if (!deps.admin) return refused(503);
  const booked = await bookConsultation(deps, { locale, payload: checked.payload });
  if (!booked.ok) return formReply({ ok: false, reason: booked.reason }, booked.status);
  return formReply({ ok: true, slot_start: booked.slot_start, emailed: booked.emailed }, 200);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 31;

function dayMs(value: string | null): number | null {
  if (!value || !DAY.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value ? null : ms;
}

/**
 * GET /api/consult/slots?from=&to= (Dubai dates, at most 31 days apart). Only ISO starts and `open` leave the server: never the
 * hours, the days off, the notice, the horizon or another booking (T-06-05-05). No limiter: read-only and bounded (T-06-05-04).
 */
export async function handleConsultSlotsGet(url: URL, deps: Pick<SiteRequestDeps, "admin">): Promise<Response> {
  const from = dayMs(url.searchParams.get("from"));
  const to = dayMs(url.searchParams.get("to"));
  if (from === null || to === null || to < from || (to - from) / 86400000 > MAX_RANGE_DAYS) return refused(400);
  if (!deps.admin) return refused(503);
  const setup = await deps.admin.rpc("consult_is_open");
  if (setup.error) return refused(503);
  const closed: ConsultSlotsReply & { ok: true; open: boolean } = { ok: true, open: false, slots: [], time_zone: "Asia/Dubai" };
  if (setup.data !== true) return formReply(closed, 200);
  const { data, error } = await deps.admin.rpc("consult_slots", { p_from: url.searchParams.get("from"), p_to: url.searchParams.get("to") });
  if (error) return refused(503);
  const rows = Array.isArray(data) ? (data as Array<{ slot_start?: unknown }>) : [];
  const slots = rows.flatMap((row) => {
    const ms = typeof row.slot_start === "string" ? Date.parse(row.slot_start) : Number.NaN;
    return Number.isNaN(ms) ? [] : [new Date(ms).toISOString()];
  });
  return formReply({ ...closed, open: true, slots }, 200);
}
