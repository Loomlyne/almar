// Plan 04-05 Task 1: the owner's three notices to inquiries@, as signed by the owner on 2026-10-26 (E-11 = A: English
// only, like the dashboard; pictures/04-05/index.html at f95a35e5): a new request, a recorded payment (the request rows
// plus the payment rows) and a guest's withdrawal (R2, E-30). Pure: no environment, no package, no network, no log.
//
// E-03: an owner notice never carries a bank value (IBAN, account name, bank address), never the guest's booking link
// and never a link token: its one link is the dashboard detail page. The stay is named as the guest saw it plus its
// slug, and the booking's language is a row ("Language: Arabic"). Subjects are fixed words and the checked reference.
import type { EmailBrand } from "./magic-link";
import type { PaymentMailJob, RequestMailJob } from "../booking/notify";
import type { BookingView } from "../booking/types";
import { BOOKING_EMAIL_COPY, OWNER_EMAIL_COPY, type OwnerEmailCopy } from "../copy/booking-email";
import { fill, formatPlural } from "../journey-format";
import { formatAed } from "../money/format";
import { formatIsoDate, uaeDateTime } from "../booking/trip-format";
import { guestsText, stayDaysText } from "../booking/display-text";
import { OPS_HOSTNAME } from "../host";
import { bookingSubject, renderEmail, type EmailBlock, type EmailRow, type RenderedEmail } from "./shell";

/** The dashboard's booking detail page (04-09); the notices link to it with `?ref=<ref>`. */
export const OPS_BOOKING_DETAIL_PATH = "/bookings/detail";

/** The owner renderers' context: the saved brand; the copy defaults to the English OWNER_EMAIL_COPY (E-11). */
export type OwnerMailContext = { brand: EmailBrand | null; copy?: OwnerEmailCopy };

const ATTENTION = /^[a-z0-9_]{1,60}$/;

function dashboardUrl(ref: string): string {
  return `https://${OPS_HOSTNAME}${OPS_BOOKING_DETAIL_PATH}?ref=${encodeURIComponent(ref)}`;
}

const row = (label: string, value: string): EmailRow => ({ label, lines: [value] });

function languageName(o: OwnerEmailCopy, locale: unknown): string {
  return locale === "ar" || locale === "es" || locale === "en" ? o.languageNames[locale] : o.languageNames.en;
}

/** The request rows every request and payment notice starts with. */
function requestRows(view: BookingView, o: OwnerEmailCopy): EmailRow[] {
  return [
    row(o.rows.reference, view.ref),
    row(o.rows.guest, view.guest.name),
    row(o.rows.email, view.guest.email),
    row(o.rows.language, languageName(o, view.locale)),
    row(o.rows.stay, fill(o.stayValue, { title: view.stay.title, slug: view.stay.slug })),
    row(o.rows.dates, stayDaysText(view.arrive, view.leave)),
    row(o.rows.nights, formatPlural(BOOKING_EMAIL_COPY.en.nightsCount, view.nights, "en")),
    row(o.rows.guests, guestsText(view, "en")),
    row(o.rows.plan, o.plans[view.plan]),
    row(o.rows.total, formatAed(view.money.grandFils)),
    row(o.rows.dueNow, formatAed(view.money.dueNowFils)),
  ];
}

/** The closing blocks: the dashboard button and its address written out (a mail client may hide the button). */
function dashboardBlocks(o: OwnerEmailCopy, ref: string): EmailBlock[] {
  const href = dashboardUrl(ref);
  return [
    { kind: "button", label: o.dashboardButton, href },
    { kind: "note", text: href },
  ];
}

function ownerMail(o: OwnerEmailCopy, subject: string, isTest: boolean, brand: EmailBrand | null, blocks: EmailBlock[]): RenderedEmail {
  return renderEmail({ locale: "en", subject, brand, testBanner: isTest ? o.testBanner : null, blocks });
}

/** request_owner: a guest sent a request. The request rows, the pay-by time, the reply-to note, the dashboard link. */
export function renderRequestOwnerEmail(job: RequestMailJob, ctx: OwnerMailContext): RenderedEmail {
  const o = ctx.copy ?? OWNER_EMAIL_COPY;
  const { view } = job;
  const subject = bookingSubject(o.request.subject, view.ref, job.isTest);
  const list = requestRows(view, o);
  list.push(row(o.rows.deadline, view.deadline ? fill(o.deadlineValue, uaeDateTime(view.deadline)) : o.none));
  const blocks: EmailBlock[] = [
    { kind: "heading", text: o.request.heading },
    { kind: "paragraph", text: o.request.intro },
    { kind: "rows", rows: list },
    { kind: "paragraph", text: o.replyNote },
    ...dashboardBlocks(o, view.ref),
  ];
  return ownerMail(o, subject, job.isTest, ctx.brand, blocks);
}

function attentionText(o: OwnerEmailCopy, reason: string | null): string {
  if (reason === null) return o.none;
  if (Object.hasOwn(o.attentionWords, reason)) return o.attentionWords[reason as keyof OwnerEmailCopy["attentionWords"]];
  return ATTENTION.test(reason) ? reason : o.none;
}

/**
 * payment_owner: a payment was recorded. The request rows, then the payment rows: amount, received on, recorded by,
 * status before -> after in English words, paid in total, still due, and the attention reason in words (R1's list).
 */
export function renderPaymentOwnerEmail(job: PaymentMailJob, ctx: OwnerMailContext): RenderedEmail {
  const o = ctx.copy ?? OWNER_EMAIL_COPY;
  const { view } = job;
  const subject = bookingSubject(o.payment.subject, view.ref, job.isTest);
  const list = requestRows(view, o);
  list.push(
    row(o.rows.amount, formatAed(job.amountFils)),
    row(o.rows.receivedOn, formatIsoDate(job.receivedOn)),
    row(o.rows.recordedBy, job.recordedByEmail ?? o.notRecorded),
    row(o.rows.statusChange, fill(o.statusChangeValue, { before: o.statusWords[job.statusBefore], after: o.statusWords[job.statusAfter] })),
    row(o.rows.paidTotal, formatAed(view.money.paidFils)),
    row(o.rows.stillDue, formatAed(view.money.stillDueFils)),
    row(o.rows.attention, attentionText(o, job.attentionReason)),
  );
  const blocks: EmailBlock[] = [
    { kind: "heading", text: o.payment.heading },
    { kind: "paragraph", text: o.payment.intro },
    { kind: "rows", rows: list },
    { kind: "paragraph", text: o.replyNote },
    ...dashboardBlocks(o, view.ref),
  ];
  return ownerMail(o, subject, job.isTest, ctx.brand, blocks);
}

/**
 * request_withdrawn_owner (R2, E-30): the guest withdrew an unpaid request on the booking page. The reference, the
 * guest's name, the stay and its slug, the days, "The nights are free again." and the dashboard link.
 */
export function renderWithdrawnOwnerEmail(job: RequestMailJob, ctx: OwnerMailContext): RenderedEmail {
  const o = ctx.copy ?? OWNER_EMAIL_COPY;
  const { view } = job;
  const subject = bookingSubject(o.withdrawn.subject, view.ref, job.isTest);
  const blocks: EmailBlock[] = [
    { kind: "heading", text: o.withdrawn.heading },
    {
      kind: "rows",
      rows: [
        row(o.rows.reference, view.ref),
        row(o.rows.guest, view.guest.name),
        row(o.rows.stay, fill(o.stayValue, { title: view.stay.title, slug: view.stay.slug })),
        row(o.rows.dates, stayDaysText(view.arrive, view.leave)),
      ],
    },
    { kind: "paragraph", text: o.withdrawn.line },
    ...dashboardBlocks(o, view.ref),
  ];
  return ownerMail(o, subject, job.isTest, ctx.brand, blocks);
}
