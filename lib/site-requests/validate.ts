// The one validation of a site request (plan 06-05, SITE-04, SITE-05, SITE-06, SITE-12): run by the browser forms before
// they post and by the routes before they save; 06-06's package request calls it too. Pure: it imports only
// lib/contact-inquiry.ts (the cleaners and the honeypots), lib/site-requests/slots.ts and the caps of 06-01. The SQL check
// site_request_payload_ok stays the last word; this is stricter where the form asks for more (consultation phone).
//
// No form field name equals a honeypot name, not even by case (S3-12): Plan's notes are `Trip Notes`, List's message is
// `Property Details`, the call's notes are `Call Notes`. Budget stays the guest's own words: never parsed into a number.

import { HONEYPOT_FIELDS, asciiDigits, cleanLine, cleanText, isInquiryEmail } from "../contact-inquiry";
import { isTimeZone } from "./slots";
import { SITE_REQUEST_CAPS, type SiteRequestKind } from "./types";

/** The form's field names. */
export const REQUEST_FIELD = {
  kind: "Kind",
  locale: "Locale",
  name: "Name",
  email: "Email",
  phone: "Phone",
  destination: "Destination",
  from: "From",
  to: "To",
  guests: "Guests",
  budget: "Budget",
  airport: "Airport",
  tripNotes: "Trip Notes",
  propertyType: "Property Type",
  city: "City",
  propertyDetails: "Property Details",
  slot: "Slot",
  timeZone: "Time Zone",
  callNotes: "Call Notes",
  tier: "Tier",
  cities: "Cities",
} as const;

/** F-10: Dubai, Abu Dhabi, Sharjah. "Not decided" sends nothing. */
export const UAE_AIRPORTS = ["DXB", "AUH", "SHJ"] as const;
export const SITE_REQUEST_HONEYPOTS = HONEYPOT_FIELDS;

/** The byte cap of a urlencoded request body; worker/handle.mjs FORM_BODY_CAPS holds the same number for the two POST paths. */
export const SITE_REQUEST_BODY_LIMIT = 16384;

export type RequestErrorCode = "required" | "invalid" | "tooLong";
/** Errors by payload key (name, email, property_type, slot_start...). */
export type RequestErrors = Record<string, RequestErrorCode>;
export type RequestPayload = Record<string, string | number | string[]>;
export type RequestCheck = { ok: true; payload: RequestPayload } | { ok: false; errors: RequestErrors };

/** What a validation reads: URLSearchParams has both. */
export type RequestFields = { get(name: string): string | null; getAll(name: string): string[] };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// The SQL's form of slot_start (site_request_payload_ok).
const SLOT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)$/;

function isDay(value: string): boolean {
  const m = DAY.exec(value);
  if (!m) return false;
  const at = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return at.getUTCFullYear() === Number(m[1]) && at.getUTCMonth() === Number(m[2]) - 1 && at.getUTCDate() === Number(m[3]);
}

type Builder = {
  fields: RequestFields;
  payload: RequestPayload;
  errors: RequestErrors;
};

function text(b: Builder, key: string, field: string, max: number, { required = false, multiline = false } = {}): void {
  const raw = b.fields.get(field) ?? "";
  const value = multiline ? cleanText(raw) : cleanLine(raw);
  if (!value) {
    if (required) b.errors[key] = "required";
    return;
  }
  if (value.length > max) b.errors[key] = "tooLong";
  else b.payload[key] = value;
}

function contact(b: Builder, kind: SiteRequestKind, notesField: string | null, phoneRequired: boolean): void {
  const caps = SITE_REQUEST_CAPS[kind];
  const nameCap = caps.name;
  text(b, "name", REQUEST_FIELD.name, nameCap.kind === "text" ? nameCap.max : 120, { required: true });

  const email = (b.fields.get(REQUEST_FIELD.email) ?? "").trim().normalize("NFC");
  if (!email) b.errors.email = "required";
  else if (email.length > 254) b.errors.email = "tooLong";
  else if (!isInquiryEmail(email)) b.errors.email = "invalid";
  else b.payload.email = email;

  const phoneCap = caps.phone;
  const phone = cleanLine(asciiDigits(b.fields.get(REQUEST_FIELD.phone) ?? ""));
  if (!phone) {
    if (phoneRequired) b.errors.phone = "required";
  } else if (phoneCap.kind === "phone" && !phoneCap.pattern.test(phone)) b.errors.phone = "invalid";
  else b.payload.phone = phone;

  if (notesField) text(b, "notes", notesField, 2000, { multiline: true });
}

/** `from` and `to` (from before to when both are there) and `guests` 1..99 (Arabic-Indic digits become ASCII). */
function datesAndGuests(b: Builder): void {
  const from = (b.fields.get(REQUEST_FIELD.from) ?? "").trim();
  const to = (b.fields.get(REQUEST_FIELD.to) ?? "").trim();
  if (from) {
    if (isDay(from)) b.payload.from = from;
    else b.errors.from = "invalid";
  }
  if (to) {
    if (!isDay(to) || (isDay(from) && from >= to)) b.errors.to = "invalid";
    else b.payload.to = to;
  }
  const guests = asciiDigits(b.fields.get(REQUEST_FIELD.guests) ?? "").trim();
  if (guests) {
    const n = /^\d{1,3}$/.test(guests) ? Number(guests) : 0;
    if (n >= 1 && n <= 99) b.payload.guests = n;
    else b.errors.guests = "invalid";
  }
}

/** The slot's start as ISO UTC, on a :00 or :30 minute, or null. */
export function slotStart(value: string): string | null {
  if (!SLOT.test(value)) return null;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms) || ms % 1800000 !== 0) return null;
  return new Date(ms).toISOString();
}

/** Validates one request of `kind`: `{ok: true, payload}` with the 06-01 payload keys, or `{ok: false, errors}`. */
export function validateSiteRequest(kind: SiteRequestKind, fields: RequestFields): RequestCheck {
  const b: Builder = { fields, payload: {}, errors: {} };
  if (kind === "plan") {
    contact(b, kind, REQUEST_FIELD.tripNotes, false);
    text(b, "destination", REQUEST_FIELD.destination, 120);
    datesAndGuests(b);
    text(b, "budget", REQUEST_FIELD.budget, 120);
    const airport = (fields.get(REQUEST_FIELD.airport) ?? "").trim();
    if (airport) {
      if ((UAE_AIRPORTS as readonly string[]).includes(airport)) b.payload.airport = airport;
      else b.errors.airport = "invalid";
    }
  } else if (kind === "list") {
    contact(b, kind, null, false);
    text(b, "property_type", REQUEST_FIELD.propertyType, 80, { required: true });
    text(b, "city", REQUEST_FIELD.city, 120, { required: true });
    text(b, "message", REQUEST_FIELD.propertyDetails, 2000, { required: true, multiline: true });
  } else if (kind === "package") {
    contact(b, kind, REQUEST_FIELD.tripNotes, false);
    const tier = (fields.get(REQUEST_FIELD.tier) ?? "").trim();
    if (!tier) b.errors.tier_slug = "required";
    else if (tier.length > 80) b.errors.tier_slug = "tooLong";
    else if (!SLUG.test(tier)) b.errors.tier_slug = "invalid";
    else b.payload.tier_slug = tier;
    datesAndGuests(b);
    const cities = fields.getAll(REQUEST_FIELD.cities).map(cleanLine).filter((city) => city !== "");
    if (cities.length > 6) b.errors.cities = "invalid";
    else if (cities.some((city) => city.length > 120)) b.errors.cities = "tooLong";
    else if (cities.length > 0) b.payload.cities = cities;
  } else {
    contact(b, kind, REQUEST_FIELD.callNotes, true);
    const slot = (fields.get(REQUEST_FIELD.slot) ?? "").trim();
    const start = slot ? slotStart(slot) : null;
    if (!slot) b.errors.slot_start = "required";
    else if (!start) b.errors.slot_start = "invalid";
    else b.payload.slot_start = start;
    const zone = (fields.get(REQUEST_FIELD.timeZone) ?? "").trim();
    if (!zone) b.errors.time_zone = "required";
    else if (zone.length > 64 || !/^[A-Za-z][A-Za-z0-9_+/-]*$/.test(zone) || !isTimeZone(zone)) b.errors.time_zone = "invalid";
    else b.payload.time_zone = zone;
  }
  return Object.keys(b.errors).length > 0 ? { ok: false, errors: b.errors } : { ok: true, payload: b.payload };
}
