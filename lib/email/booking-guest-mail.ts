// Plan 04-05 Task 1: the guest emails (a fourth, the refund mail, is plan 05-03), as signed by the owner on 2026-10-26 (pictures/04-05/index.html at
// f95a35e5): request received (with the bank transfer instructions), payment receipt (one per recorded payment, E-31),
// and request lapsed. Pure: the caller passes the job, the copy of the booking's language and the saved brand; no
// environment, no package, no network, no log. The shell (lib/email/shell.ts) escapes every value.
//
// Rules held here: the subject is fixed words and a checked reference only (`[TEST] ` first on a TEST booking); every
// amount comes from a fils field through formatAed; days are DD/MM/YYYY and times 24-hour UAE time from 04-03's
// formatIsoDate and uaeDateTime, the pay-by sentence is JOURNEY_COPY[locale].bookingStatus.payBy (E-14); no mail ever
// prints the stay details the booking page shows after Confirmed (E-02); the lapse email links to the stay page, never
// to the booking page, and carries no bank value (M6). The lapse rule line is in the request email only.
import type { EmailBrand } from "./magic-link";
import type { LapseMailJob, PaymentMailJob, RefundMailJob, RequestMailJob } from "../booking/notify";
import type { BookingView, TransferInstructions } from "../booking/types";
import { BOOKING_CONTACT, type BookingEmailCopy } from "../copy/booking-email";
import { JOURNEY_COPY } from "../copy/journey";
import { formatPlural } from "../journey-format";
import { formatAed } from "../money/format";
import { formatIban, normalizeIban } from "../booking/bank";
import { formatIsoDate, uaeDateTime } from "../booking/trip-format";
import { guestsText, stayDaysText } from "../booking/display-text";
import { originForBooking } from "../booking/origin";
import { localePath } from "../locale-path";
import {
  bookingSubject,
  checkHref,
  fillRich,
  ltr,
  multiline,
  renderEmail,
  type EmailBlock,
  type EmailLocale,
  type EmailRow,
  type Rich,
  type RenderedEmail,
} from "./shell";

/** The guest renderers' context: the copy of the booking's language and the saved brand (null = the design system). */
export type GuestMailContext = { copy: BookingEmailCopy; brand: EmailBrand | null };

function emailLocale(value: unknown): EmailLocale {
  return value === "ar" || value === "es" ? value : "en";
}

const aed = (fils: number): Rich => [ltr(formatAed(fils))];
const day = (iso: string): Rich => [ltr(formatIsoDate(iso))];

const heading = (text: Rich): EmailBlock => ({ kind: "heading", text });
const paragraph = (text: Rich): EmailBlock => ({ kind: "paragraph", text });
const note = (text: Rich): EmailBlock => ({ kind: "note", text });
const rows = (list: EmailRow[]): EmailBlock => ({ kind: "rows", rows: list });
const row = (label: Rich, ...lines: Rich[]): EmailRow => ({ label, lines });
const RULE: EmailBlock = { kind: "rule" };

function greeting(c: BookingEmailCopy, name: string): EmailBlock {
  return paragraph(fillRich(c.greeting, { name }));
}

/** The closing lines of every guest mail: the gold rule, the help line with the published WhatsApp number, the name. */
function helpFooter(c: BookingEmailCopy): EmailBlock[] {
  return [RULE, note(fillRich(c.help, { phone: [ltr(BOOKING_CONTACT.phone)] })), note(c.signOff)];
}

/** The booking's rows: reference, stay, days, nights, guests, add-ons, airport, plan, total. */
function bookingRows(view: BookingView, c: BookingEmailCopy, locale: EmailLocale): EmailBlock {
  const list: EmailRow[] = [
    row(c.rows.reference, [ltr(view.ref)]),
    row(c.rows.stay, fillRich(c.stayLine, { title: view.stay.title, destination: view.stay.destinationName })),
    row(c.rows.dates, [ltr(stayDaysText(view.arrive, view.leave))]),
    row(c.rows.nights, formatPlural(c.nightsCount, view.nights, locale)),
    row(c.rows.guests, guestsText(view, locale)),
  ];
  if (view.lines.length > 0) {
    list.push(
      row(
        c.rows.addons,
        ...view.lines.map((line) =>
          fillRich(c.addonLine, { name: line.name, quantity: [ltr(String(line.quantity))], amount: aed(line.lineFils) }),
        ),
      ),
    );
  }
  if (view.airport) list.push(row(c.rows.airport, c.airports[view.airport]));
  list.push(row(c.rows.plan, c.plans[view.plan]));
  list.push(row(c.rows.total, aed(view.money.grandFils)));
  return rows(list);
}

/** The pay-by sentence of JOURNEY_COPY in UAE time, the date and time left to right. */
function payBySentence(locale: EmailLocale, iso: string): Rich {
  const { date, time } = uaeDateTime(iso);
  return fillRich(JOURNEY_COPY[locale].bookingStatus.payBy, { date: [ltr(date)], time: [ltr(time)] });
}

/** Asia/Dubai has no daylight saving: its calendar day is the UTC instant plus four hours. */
function dubaiDay(iso: string): string | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms + 4 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
}

/**
 * Owner decision 6b (2026-10-21, confirmed with E-31 on 2026-10-26): a receipt never repeats a "Pay by" sentence that
 * is already past. Past = the day received (a Dubai day) is after the pay-by instant's Dubai day, or the mail is sent
 * at or after the pay-by instant (a payment dated on time but recorded late: the booking page shows the deadline as
 * passed, so the receipt does too).
 */
function payByPast(receivedOn: string, sentAtMs: number, payBy: string | null): boolean {
  if (!payBy) return false;
  const deadlineMs = Date.parse(payBy);
  if (Number.isFinite(deadlineMs) && Number.isFinite(sentAtMs) && sentAtMs >= deadlineMs) return true;
  const day = dubaiDay(payBy);
  return day !== null && /^\d{4}-\d{2}-\d{2}$/.test(receivedOn) && receivedOn > day;
}

/**
 * The transfer instructions: the gold rule, the heading, the bank rows (amount, account name, bank, IBAN, SWIFT, bank
 * address, currency, note), the pay-by sentence when there is one, the reference line, B-29 (fees), B-28 (reply with
 * the bank receipt), the lapse rule (request email only, R1) and E-18 (the same details are on the booking page).
 */
function transferBlocks(
  ref: string,
  t: TransferInstructions,
  c: BookingEmailCopy,
  locale: EmailLocale,
  options: { lapseRule: boolean; payBy?: boolean; lapseText?: string },
): EmailBlock[] {
  const out: EmailBlock[] = [
    RULE,
    heading(c.transfer.heading),
    rows([
      row(c.transfer.amount, aed(t.amountFils)),
      row(c.transfer.accountName, t.accountName),
      row(c.transfer.bankName, t.bankName),
      row(c.transfer.iban, [ltr(formatIban(t.iban), normalizeIban(t.iban))]),
      row(c.transfer.swift, [ltr(t.swift)]),
      row(c.transfer.bankAddress, t.bankAddress),
      row(c.transfer.currency, [ltr(t.currency)]),
      row(c.transfer.note, [multiline(t.note)]),
    ]),
  ];
  if (t.payBy && options.payBy !== false) out.push(paragraph(payBySentence(locale, t.payBy)));
  out.push(
    paragraph(fillRich(c.transfer.referenceLine, { ref: [ltr(ref)] })),
    paragraph(c.transfer.fees),
    paragraph(c.transfer.reply),
  );
  if (options.lapseRule) out.push(paragraph(options.lapseText ?? c.transfer.lapseRule));
  out.push(paragraph(c.transfer.alsoOnPage));
  return out;
}

function balanceLine(c: BookingEmailCopy, amountFils: number, dueDate: string): EmailBlock {
  return paragraph(fillRich(c.balanceLine, { amount: aed(amountFils), date: day(dueDate) }));
}

/**
 * request_received: sent once after Request. The booking, then how to pay (amount, bank details, reference, pay-by
 * time, fees, bank receipt, lapse rule), the balance and its due date on a deposit plan, and the booking page button.
 * Throws `email: bad reference`, `email: no transfer` or `email: bad link` (the notifier maps each to its error name).
 */
export function renderRequestReceivedEmail(job: RequestMailJob, ctx: GuestMailContext): RenderedEmail {
  const { view } = job;
  const c = ctx.copy;
  const locale = emailLocale(view.locale);
  // P5-05: a booking the owner made by hand has its own subject, heading, first line and lapse sentence.
  const words = job.handMade ? c.requestReceived.handMade : c.requestReceived;
  const subject = bookingSubject(words.subject, view.ref, job.isTest);
  const transfer = view.transfer;
  if (!transfer) throw new Error("email: no transfer");
  const href = checkHref(job.bookingUrl);
  const blocks: EmailBlock[] = [
    heading(words.heading),
    greeting(c, view.guest.name),
    paragraph(fillRich(words.intro, { ref: [ltr(view.ref)] })),
    bookingRows(view, c, locale),
    ...transferBlocks(view.ref, transfer, c, locale, { lapseRule: true, lapseText: job.handMade ? c.requestReceived.handMade.lapseRule : c.transfer.lapseRule }),
  ];
  if (view.plan === "deposit" && view.money.balanceFils > 0 && view.balanceDueDate) {
    blocks.push(balanceLine(c, view.money.balanceFils, view.balanceDueDate));
  }
  blocks.push(paragraph(c.requestReceived.confirmNote), { kind: "button", label: c.buttons.viewBooking, href }, ...helpFooter(c));
  return renderEmail({ locale, subject, brand: ctx.brand, testBanner: job.isTest ? c.testBanner : null, blocks });
}

/**
 * payment_receipt: one per recorded payment (E-31), in the booking's language. The amount and the day received, then
 * by the status after the recording: part received (still to transfer, the pay-by sentence unless the money arrived
 * after the pay-by date (6b), and the bank details again); a balance still due (its due date and the bank details); nothing more due (with the accepted-as-paid
 * or overpaid line when flagged); or, on a lapsed or cancelled booking, the neutral E-10 variant: no intro, no total
 * paid, no bank details, no "nothing more is due" and no promise of the stay. The button when the job has a link, else
 * the line pointing to the request email.
 */
export function renderPaymentReceiptEmail(job: PaymentMailJob, ctx: GuestMailContext): RenderedEmail {
  const { view } = job;
  const c = ctx.copy;
  const r = c.paymentReceipt;
  const locale = emailLocale(view.locale);
  const subject = bookingSubject(r.subject, view.ref, job.isTest);
  const href = typeof job.bookingUrl === "string" ? checkHref(job.bookingUrl) : null;
  const after = job.statusAfter;
  const closed = after === "expired" || after === "cancelled";
  const money = view.money;

  const blocks: EmailBlock[] = [heading(r.heading), greeting(c, view.guest.name)];
  if (!closed) blocks.push(paragraph(fillRich(r.intro, { ref: [ltr(view.ref)] })));
  const received: EmailRow[] = [row(r.amountReceived, aed(job.amountFils)), row(r.receivedOn, day(job.receivedOn))];
  if (!closed) received.push(row(r.totalPaid, aed(money.paidFils)));
  blocks.push(rows(received));

  if (closed) {
    // After a refund the sentence stands only while paid minus refunded is above 0; it then names that net amount.
    const net = money.paidFils - money.refundedFils;
    if (net > 0) blocks.push(paragraph(fillRich(r.moneyOnClosed, { amount: aed(job.amountFils) })));
  } else if (after === "awaiting_payment") {
    blocks.push(paragraph(r.partReceived), rows([row(r.stillDue, aed(money.dueNowFils))]));
    if (view.transfer) {
      const payBy = !payByPast(job.receivedOn, job.sentAtMs, view.transfer.payBy);
      blocks.push(...transferBlocks(view.ref, view.transfer, c, locale, { lapseRule: false, payBy }));
    }
  } else if (money.stillDueFils > 0) {
    if (view.balanceDueDate) blocks.push(balanceLine(c, money.stillDueFils, view.balanceDueDate));
    if (view.transfer) blocks.push(...transferBlocks(view.ref, view.transfer, c, locale, { lapseRule: false }));
  } else {
    if (view.flags.writtenOff) blocks.push(paragraph(r.acceptedAsPaid));
    if (view.flags.overpaid) blocks.push(paragraph(r.overpaid));
    blocks.push(paragraph(r.nothingMoreDue));
  }

  if (href !== null) blocks.push({ kind: "button", label: c.buttons.viewBooking, href });
  else blocks.push(paragraph(r.noLink));
  blocks.push(...helpFooter(c));
  return renderEmail({ locale, subject, brand: ctx.brand, testBanner: job.isTest ? c.testBanner : null, blocks });
}

/**
 * refund_receipt (P5-03): one per recorded bank refund, in the booking's language. The heading, the reference, the
 * amount refunded and the day, then the booking page button (or the line pointing to the request email). It prints
 * nothing else: no status, no paid total, no amount still due, no bank value, no reason, and no promise of when money
 * arrives. Throws `email: bad reference` or `email: bad link` as its neighbours do.
 */
export function renderRefundReceiptEmail(job: RefundMailJob, ctx: GuestMailContext): RenderedEmail {
  const { view } = job;
  const c = ctx.copy;
  const r = c.refundReceipt;
  const locale = emailLocale(view.locale);
  const subject = bookingSubject(r.subject, view.ref, job.isTest);
  const href = typeof job.bookingUrl === "string" ? checkHref(job.bookingUrl) : null;
  const blocks: EmailBlock[] = [
    heading(r.heading),
    greeting(c, view.guest.name),
    paragraph(fillRich(r.intro, { ref: [ltr(view.ref)] })),
    rows([row(r.amountRefunded, aed(job.amountFils)), row(r.refundedOn, day(job.refundedOn))]),
  ];
  if (href !== null) blocks.push(paragraph(r.onPage), { kind: "button", label: c.buttons.viewBooking, href });
  else blocks.push(paragraph(c.paymentReceipt.noLink));
  blocks.push(...helpFooter(c));
  return renderEmail({ locale, subject, brand: ctx.brand, testBanner: job.isTest ? c.testBanner : null, blocks });
}

const SLUG = /^[a-z0-9-]+$/;

/**
 * request_lapsed: no payment at all was recorded by the deadline (UAE time), the dates are free again, and "Start
 * again" to the stay page in the booking's language on the booking's own origin (preview for TEST). No booking link,
 * no link token, no bank value.
 */
export function renderRequestLapsedEmail(job: LapseMailJob, ctx: GuestMailContext): RenderedEmail {
  const c = ctx.copy;
  const l = c.requestLapsed;
  const locale = emailLocale(job.locale);
  const subject = bookingSubject(l.subject, job.ref, job.isTest);
  const { date, time } = uaeDateTime(job.deadline);
  const path = typeof job.staySlug === "string" && SLUG.test(job.staySlug) ? `/private-stays/${job.staySlug}` : "/private-stays";
  const href = checkHref(originForBooking(job.isTest) + localePath(locale, path));
  const blocks: EmailBlock[] = [
    heading(l.heading),
    greeting(c, job.guestName),
    paragraph(fillRich(l.body, { date: [ltr(date)], time: [ltr(time)], ref: [ltr(job.ref)] })),
    paragraph(l.startAgainLine),
    { kind: "button", label: c.buttons.startAgain, href },
    ...helpFooter(c),
  ];
  return renderEmail({ locale, subject, brand: ctx.brand, testBanner: job.isTest ? c.testBanner : null, blocks });
}

