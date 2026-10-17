// The Contact inquiry (phase 3.3 plan 26): every limit, field name, honeypot and rule the browser form and
// POST /api/contact share, and the one email an inquiry becomes. Pure and a leaf: its only import is lib/locale-path,
// so the client form, the route and the node tests (tests/contact-inquiry.test.mjs) load the same rules.
//
// Header safety (threat T-3.3-26-01): a value that reaches the subject is cleaned by cleanLine (no CR, LF, other
// control character, line or paragraph separator, or bidi override), and reply-to must pass isInquiryEmail (one plain
// address: no whitespace, comma, semicolon, angle bracket, quote, parenthesis, bracket, backslash or colon). Resend
// receives JSON fields, never raw headers, and the payload carries no cc, bcc, headers or html key.

import { isPlainEmail } from "./email-address";
import { absoluteLocaleUrl, isLocale, type Locale } from "./locale-path";

/**
 * ALMAR's inbox: the sender and the only recipient of every inquiry. A constant, not getContactDetails(): lib/data
 * reads its fixtures with node:fs from process.cwd(), which exists at build time only, never inside the Worker.
 * tests/contact-inquiry.test.mjs pins it to getContactDetails("en").email and to the site's other two copies.
 */
export const INQUIRY_ADDRESS = "inquiries@almarprivatejourney.com";

/** The journey types, as submitted and emailed in every language (the labels are localised in lib/copy/contact-page.ts). */
export const JOURNEY_TYPES = ["Experiences", "Services", "Full Journey", "Group Event", "General Question"] as const;
export type JourneyType = (typeof JOURNEY_TYPES)[number];

/**
 * The form's field names: the live Framer form's own, except the textarea. The live `Message` differs from the
 * honeypot `message` only by case, so the textarea is `Journey Details` (S3-12).
 */
export const INQUIRY_FIELD = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  journeyType: "Journey Type",
  details: "Journey Details",
  locale: "Locale",
} as const;

/** The 11 invisible spam traps of the live Framer form, the same names and order as app/newsletter/route.ts (SITE-12). */
export const HONEYPOT_FIELDS = [
  "title",
  "website",
  "company",
  "message",
  "subject",
  "description",
  "feedback",
  "notes",
  "details",
  "remarks",
  "comments",
] as const;

/** Character caps per field (after cleaning) and the byte cap of the whole urlencoded body. */
export const INQUIRY_LIMITS = { name: 100, phone: 40, email: 254, details: 4000, body: 16384 } as const;

export type InquiryInput = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  journeyType?: string | null;
  details?: string | null;
  locale?: string | null;
};

export type Inquiry = {
  name: string;
  phone: string | null;
  email: string;
  journeyType: JourneyType;
  details: string;
  locale: Locale;
};

export type InquiryErrorCode = "required" | "invalid" | "tooLong";
export type InquiryErrors = Partial<Record<keyof typeof INQUIRY_FIELD, InquiryErrorCode>>;
export type InquiryResult = { ok: true; inquiry: Inquiry } | { ok: false; errors: InquiryErrors };

// C0, DEL and C1 controls, the line and paragraph separators, and the bidi embeddings, overrides and isolates (a
// name that flips the subject line's reading order).
const LINE_UNSAFE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;
// The same, keeping tab and line feed (the message keeps its lines).
const TEXT_UNSAFE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/g;
const ANY_CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/** One line for a header-bound value: every control character becomes a space, runs of whitespace one space, trimmed, NFC. */
export function cleanLine(value: string): string {
  return value.normalize("NFC").replace(LINE_UNSAFE, " ").replace(/\s+/g, " ").trim();
}

/** The message: CRLF and CR become LF; tab and LF stay; every other control character is removed; trimmed, NFC. */
export function cleanText(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/g, "\n").replace(TEXT_UNSAFE, "").trim();
}

/**
 * One plain address, at most INQUIRY_LIMITS.email characters: lib/email-address.ts isPlainEmail, the rule the
 * newsletter and the footer share (review fix: labels non-empty, no edge hyphen, no edge or doubled dot). Surrounding
 * whitespace is the caller's to trim.
 */
export function isInquiryEmail(value: string): boolean {
  return value.length <= INQUIRY_LIMITS.email && isPlainEmail(value);
}

// A phone number as people write it: digits, spaces, + ( ) - . and at least six digits.
const PHONE = /^[+0-9 ().-]+$/;
const MIN_PHONE_DIGITS = 6;

// Review fix (PR #16 round 1): an Arabic keyboard types Arabic-Indic digits (U+0660-0669), a Persian or Urdu one
// Extended Arabic-Indic digits (U+06F0-06F9). Both become ASCII before the phone rule, in the form and in the route,
// and the email carries the ASCII form (one number the owner can dial or paste into WhatsApp as is).
const EASTERN_DIGIT = /[\u0660-\u0669\u06f0-\u06f9]/g;

/** Arabic-Indic and Extended Arabic-Indic digits as ASCII 0-9; every other character unchanged. */
export function asciiDigits(value: string): string {
  return value.replace(EASTERN_DIGIT, (d) => String(d.charCodeAt(0) & 0x0f));
}

function isJourneyType(value: string): value is JourneyType {
  return (JOURNEY_TYPES as readonly string[]).includes(value);
}

/** The one validation of an inquiry, run by the form before it posts and by the route before it sends. */
export function validateInquiry(input: InquiryInput): InquiryResult {
  const errors: InquiryErrors = {};

  const name = cleanLine(input.name ?? "");
  if (!name) errors.name = "required";
  else if (name.length > INQUIRY_LIMITS.name) errors.name = "tooLong";

  const rawPhone = asciiDigits(input.phone ?? "").trim();
  const phone = cleanLine(rawPhone);
  if (rawPhone) {
    if (phone.length > INQUIRY_LIMITS.phone) errors.phone = "tooLong";
    else if (ANY_CONTROL.test(rawPhone) || !PHONE.test(phone) || (phone.match(/\d/g) ?? []).length < MIN_PHONE_DIGITS) {
      errors.phone = "invalid";
    }
  }

  const email = (input.email ?? "").trim().normalize("NFC");
  if (!email) errors.email = "required";
  else if (email.length > INQUIRY_LIMITS.email) errors.email = "tooLong";
  else if (!isInquiryEmail(email)) errors.email = "invalid";

  const journeyType = (input.journeyType ?? "").trim();
  if (!journeyType) errors.journeyType = "required";
  else if (!isJourneyType(journeyType)) errors.journeyType = "invalid";

  const details = cleanText(input.details ?? "");
  if (!details) errors.details = "required";
  else if (details.length > INQUIRY_LIMITS.details) errors.details = "tooLong";

  const locale = input.locale ?? "";
  if (!isLocale(locale)) errors.locale = "invalid";

  if (Object.keys(errors).length > 0 || !isJourneyType(journeyType) || !isLocale(locale)) return { ok: false, errors };
  return { ok: true, inquiry: { name, phone: phone || null, email, journeyType, details, locale } };
}

/** True when any of the 11 traps holds a non-whitespace value. `get` reads one submitted field (null when absent). */
export function honeypotTripped(get: (name: string) => string | null | undefined): boolean {
  return HONEYPOT_FIELDS.some((field) => {
    const value = get(field);
    return typeof value === "string" && value.trim().length > 0;
  });
}

export type InquiryEmail = { from: string; to: string; replyTo: string; subject: string; text: string };

/** The one plain-text email an inquiry becomes: from and to ALMAR's inbox, reply-to the visitor. No html, no headers. */
export function composeInquiryEmail(inquiry: Inquiry): InquiryEmail {
  // DRAFTED internal wording, English for the owner's inbox. Built only from cleaned values.
  const subject = cleanLine(`Website inquiry · ${inquiry.journeyType} · ${inquiry.name}`);
  const text = [
    `Name: ${inquiry.name}`,
    `Phone / WhatsApp: ${inquiry.phone ?? "-"}`,
    `Email: ${inquiry.email}`,
    `Journey type: ${inquiry.journeyType}`,
    `Language: ${inquiry.locale}`,
    `Page: ${absoluteLocaleUrl(inquiry.locale, "/contact")}`,
    "",
    "Message:",
    inquiry.details,
  ].join("\n");
  return { from: INQUIRY_ADDRESS, to: INQUIRY_ADDRESS, replyTo: inquiry.email, subject, text };
}
