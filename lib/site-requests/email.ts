// The three emails of plan 06-05, as signed (pictures/06-05: email-guest, email-owner-request, email-owner-consult). Pure:
// no Resend, no env. Owner emails are plain text in English (the owner's inbox), from and to inquiries@, reply-to the guest.
// The guest's email is html and text in her language. Header-bound values go through cleanLine, html values through
// escapeHtml; the payload carries no cc, bcc or headers key (T-06-05-02). The contact values come from code: INQUIRY_ADDRESS
// and ALMAR_WHATSAPP_NUMBER (tests/site-requests-email.test.mjs pins the printed number to SITE_CONTACT.phone).

import { INQUIRY_ADDRESS, cleanLine, type InquiryEmail } from "../contact-inquiry";
import { OPS_REQUESTS_COPY } from "../copy/ops-requests";
import { SITE_REQUESTS_COPY, type SiteRequestsCopy } from "../copy/site-requests";
import type { EmailBrand } from "../email/magic-link";
import type { Locale } from "../locale-path";
import { DUBAI, SLOT_TAGS, dateLabel, dubaiLabel, timeLabel } from "./slots";
import type { SiteRequestKind } from "./types";
import { UAE_AIRPORTS } from "./validate";

export type GuestEmailCopy = SiteRequestsCopy["guestEmail"];
export type RequestPayloadValues = Record<string, unknown>;

/** ALMAR's WhatsApp number as printed on the site, from the digits of lib/whatsapp-request.ts (SITE-13). */
export function printedWhatsapp(digits: string): string {
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}

const DESIGN: EmailBrand = { teal: "#1f3b40", white: "#ffffff", ivory: "#fffaf0", ink: "#262626", titleFace: "Questa", bodyFace: "Lato", logoUrl: null };
const HEX = /^#[0-9a-f]{6}$/;
const FACE = /^(Questa|Lato)$/;
const LOGO_URL = /^https:\/\/media\.almarprivatejourney\.com\/[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.(webp|png|jpg)$/;

/** The saved brand, checked as lib/email/magic-link.ts checks it. */
function checkedBrand(brand: EmailBrand | null): EmailBrand {
  if (!brand) return DESIGN;
  for (const key of ["teal", "white", "ivory", "ink"] as const) {
    if (!HEX.test(brand[key])) throw new Error(`email brand: ${key} is not #rrggbb`);
  }
  if (!FACE.test(brand.titleFace) || !FACE.test(brand.bodyFace)) throw new Error("email brand: a face is not the design system's");
  if (brand.logoUrl !== null && !LOGO_URL.test(brand.logoUrl)) throw new Error("email brand: the logo is not a media URL");
  return brand;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const fillText = (line: string, values: Record<string, string>) => line.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

const titles: Record<SiteRequestKind, string> = {
  plan: SITE_REQUESTS_COPY.en.plan.title,
  list: SITE_REQUESTS_COPY.en.list.title,
  package: OPS_REQUESTS_COPY.en.kinds.package,
  consultation: OPS_REQUESTS_COPY.en.kinds.consultation,
};

const value = (payload: RequestPayloadValues, key: string): string => {
  const held = payload[key];
  if (held === undefined || held === null || held === "") return "";
  return Array.isArray(held) ? held.join(", ") : String(held);
};

const shortDay = (day: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

function datesLine(payload: RequestPayloadValues): string {
  const from = value(payload, "from");
  const to = value(payload, "to");
  if (from && to) return `${shortDay(from)} to ${shortDay(to)}`;
  return from ? shortDay(from) : to ? shortDay(to) : "";
}

function airportName(code: string): string {
  const at = (UAE_AIRPORTS as readonly string[]).indexOf(code);
  return at >= 0 ? (SITE_REQUESTS_COPY.en.plan.airports[at] ?? code) : code;
}

/** Every field the guest sent, in the drawn order, under the dashboard's own labels; an empty one has no line. */
function payloadLines(kind: SiteRequestKind, payload: RequestPayloadValues): string[] {
  const d = OPS_REQUESTS_COPY.en.d;
  const rows: Array<[string, string]> = [
    [d.name, value(payload, "name")],
    [d.email, value(payload, "email")],
    [d.phone, value(payload, "phone")],
  ];
  if (kind === "plan") {
    rows.push(
      [d.destination, value(payload, "destination")],
      [d.dates, datesLine(payload)],
      [d.guests, value(payload, "guests")],
      [d.budget, value(payload, "budget")],
      [d.airport, airportName(value(payload, "airport"))],
    );
  } else if (kind === "list") {
    rows.push([d.propType, value(payload, "property_type")], [d.city, value(payload, "city")], [d.message, value(payload, "message")]);
  } else if (kind === "package") {
    rows.push(
      [titles.package, value(payload, "tier_slug")],
      [d.dates, datesLine(payload)],
      [d.guests, value(payload, "guests")],
      [d.city, value(payload, "cities")],
    );
  }
  rows.push([d.notes, value(payload, "notes")]);
  return rows.filter(([, held]) => held !== "").map(([label, held]) => `${label}: ${held}`);
}

/** The email a Plan, List or Package request becomes. `extraLines` come from a kind's prepare hook, each cleaned here. */
export function composeRequestEmail(
  kind: SiteRequestKind,
  locale: Locale,
  payload: RequestPayloadValues,
  id: string,
  extraLines: readonly string[] = [],
): InquiryEmail {
  const title = titles[kind];
  const name = value(payload, "name");
  const text = [
    `${title} request`,
    "",
    ...payloadLines(kind, payload),
    ...extraLines.map(cleanLine).filter((line) => line !== ""),
    "",
    `Language of the page: ${locale.toUpperCase()}`,
    `Saved in the dashboard under Requests (id ${id}).`,
    "Reply to this email to answer the guest.",
  ].join("\n");
  return { from: INQUIRY_ADDRESS, to: INQUIRY_ADDRESS, replyTo: value(payload, "email"), subject: cleanLine(`${title}: ${name}`), text };
}

/** Guest time and Dubai time, with the date, as the two signed rows. */
function guestRows(startIso: string, timeZone: string, locale: Locale, g: GuestEmailCopy): Array<[string, string]> {
  return [
    [fillText(g.yours, { zone: timeZone }), `${dateLabel(startIso, timeZone, locale)}, ${timeLabel(startIso, timeZone, locale)}`],
    [g.dubai, `${dateLabel(startIso, DUBAI, locale)}, ${dubaiLabel(startIso, locale)}`],
  ];
}

/** The guest's confirmation, in her language: both times, the WhatsApp call, cancel by replying, the .ics named. */
export function renderConsultationGuestEmail({
  locale,
  name,
  startIso,
  timeZone,
  phone,
  whatsappNumber,
  copy,
  brand = null,
}: {
  locale: Locale;
  name: string;
  startIso: string;
  timeZone: string;
  phone: string;
  /** The printed number, from code. */
  whatsappNumber: string;
  copy: GuestEmailCopy;
  brand?: EmailBrand | null;
}): { subject: string; html: string; text: string } {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const b = checkedBrand(brand);
  const titleFont = locale === "ar" ? "'Noto Naskh Arabic',Georgia,serif" : `${b.titleFace},Georgia,serif`;
  const bodyFont = locale === "ar" ? "'Noto Sans Arabic',Arial,sans-serif" : `${b.bodyFace},Arial,sans-serif`;
  const align = dir === "rtl" ? "right" : "left";
  const subject = cleanLine(copy.subject);
  const greeting = fillText(copy.greet, { name });
  const rows = guestRows(startIso, timeZone, locale, copy);
  const digits = whatsappNumber.replace(/[^\d]/g, "");
  const whatsappHref = `https://wa.me/${digits}`;
  const ltr = (held: string) => `<span dir="ltr">${escapeHtml(held)}</span>`;
  // Each piece of the template escaped, then the two numbers put in with their own direction.
  const waHtml = escapeHtml(copy.wa).replace("{phone}", ltr(phone)).replace("{whatsapp}", ltr(whatsappNumber));
  const waText = fillText(copy.wa, { phone, whatsapp: whatsappNumber });
  const masthead = b.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="ALMAR Private Journey" width="140" style="display:block;width:140px;max-width:100%;height:auto;border:0">`
    : `<span style="color:${b.white};font-family:${titleFont};font-size:24px">ALMAR Private Journey</span>`;
  const rowsHtml = rows
    .map(
      ([label, held], at) =>
        `<tr><td style="padding:10px 0;color:#63615f;${at === 0 ? "border-top" : "border-bottom"}:1px solid #d4ba8a">${escapeHtml(label)}</td><td style="padding:10px 0;font-weight:700;${at === 0 ? "border-top" : "border-bottom"}:1px solid #d4ba8a">${escapeHtml(held)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${b.ivory};color:${b.ink};font-family:${bodyFont}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${b.ivory}">
<tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;text-align:${align}" dir="${dir}">
<tr><td style="padding:20px 24px;background:${b.teal}">${masthead}</td></tr>
<tr><td style="padding:24px 24px 0;font-family:${titleFont};font-size:32px;line-height:1.2;color:${b.teal}">${escapeHtml(subject)}</td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:1.5">${escapeHtml(greeting)}</td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:1.5">${escapeHtml(copy.lead)}</td></tr>
<tr><td style="padding:16px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:16px;line-height:1.5;text-align:${align}" dir="${dir}">${rowsHtml}</table></td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:1.5">${waHtml}</td></tr>
<tr><td style="padding:16px 24px 0"><a href="${escapeHtml(whatsappHref)}" style="display:inline-block;padding:12px 24px;background:${b.teal};color:${b.white};font-size:16px;text-decoration:none;border-radius:0">${escapeHtml(copy.btn)}</a></td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:1.5">${escapeHtml(copy.cancel)}</td></tr>
<tr><td style="padding:16px 24px 0;font-size:14px;line-height:1.5;color:#63615f">${escapeHtml(copy.ics)}</td></tr>
<tr><td style="padding:16px 24px 24px;font-size:16px;line-height:1.5">${escapeHtml(copy.sign)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    copy.subject,
    "",
    greeting,
    copy.lead,
    "",
    ...rows.map(([label, held]) => `${label}: ${held}`),
    "",
    waText,
    `${copy.btn}: ${whatsappHref}`,
    copy.cancel,
    copy.ics,
    "",
    copy.sign,
    "",
  ].join("\n");
  return { subject, html, text };
}

/** The booked call for inquiries@: plain text in English, Dubai time first. */
export function composeConsultationOwnerEmail({
  payload,
  requestId,
  startIso,
  timeZone,
}: {
  payload: RequestPayloadValues;
  requestId: string;
  startIso: string;
  timeZone: string;
}): InquiryEmail {
  const d = OPS_REQUESTS_COPY.en.d;
  const name = value(payload, "name");
  const dubaiWhen = new Intl.DateTimeFormat(SLOT_TAGS.en, { day: "numeric", month: "short", timeZone: DUBAI }).format(new Date(startIso));
  const rows = [
    `${d.name}: ${name}`,
    `${d.email}: ${value(payload, "email")}`,
    `${d.phone}: ${value(payload, "phone")}`,
    `Dubai time: ${dateLabel(startIso, DUBAI, "en")}, ${dubaiLabel(startIso, "en")}`,
    `Guest time: ${dateLabel(startIso, timeZone, "en", false)}, ${timeLabel(startIso, timeZone, "en")} (${timeZone})`,
  ];
  const notes = value(payload, "notes");
  if (notes) rows.push(`Message: ${notes}`);
  const text = [
    "Consultation booked",
    "",
    ...rows,
    "",
    "Call the guest on WhatsApp at the time above.",
    `Saved in the dashboard under Requests (id ${requestId}). Cancel it there to free the slot.`,
  ].join("\n");
  return {
    from: INQUIRY_ADDRESS,
    to: INQUIRY_ADDRESS,
    replyTo: value(payload, "email"),
    subject: cleanLine(`Consultation: ${name}, ${dubaiWhen} ${dubaiLabel(startIso, "en")} Dubai`),
    text,
  };
}
