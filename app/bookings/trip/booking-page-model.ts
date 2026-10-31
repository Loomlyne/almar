// Plan 04-05 (Task 2): which blocks the guest booking page shows for a BookingView. Pure: no React, no fetch, no
// clock (the caller passes `nowMs`, the time the view was read), no storage. The page view calls it once per render.
//
// Defence in depth over 04-08's booking_view: the transfer block shows only for the four money-due statuses and the
// stay details only for Confirmed and Completed (BOOK-08, OPS-10), even if a view carried more. The model never
// derives a status from the clock: `expired` comes only from the view (R1), so a part-paid request far past its
// deadline still reads awaiting_payment and keeps its transfer block with the late line (E-28).
import type { BookingStatus, BookingView, WithdrawReason } from "../../../lib/booking/types";
import { isLocale, localePath, type Locale } from "../../../lib/locale-path";

/** The withdraw control's state on the page (R2), driven by the screen (Task 6) or a scene. */
export type WithdrawUi =
  | { step: "idle" }
  | { step: "confirm" }
  | { step: "failed" }
  | { step: "done"; stayPath: string }
  | { step: "refused"; reason: WithdrawReason };

/** What the page view needs to draw and drive the Withdraw section and its ConfirmDialog. */
export type WithdrawControl = {
  ui: WithdrawUi;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export type TransferBlock = {
  /** "deadline" on awaiting_payment (the Pay-by sentence), "balance" otherwise (the due date). */
  kind: "deadline" | "balance";
  amountFils: number;
  payBy: string | null;
  dueBy: string | null;
};

export type BookingPageModel = {
  status: BookingStatus;
  transfer: TransferBlock | null;
  showAccess: boolean;
  addressPending: boolean;
  partReceived: boolean;
  nothingMoreDue: boolean;
  acceptedAsPaid: boolean;
  overpaid: boolean;
  moneyOnClosed: boolean;
  /** Paid minus refunded, never below 0: the amount the closed-booking sentence names (P5-03). */
  closedNetFils: number;
  /** The recorded bank refunds: date and amount only (P5-03). */
  refunds: { refundedOn: string; amountFils: number }[];
  notSent: boolean;
  balanceLine: { amountFils: number; dueDate: string } | null;
  stayPath: string;
  startAgainPath: string | null;
  finishPath: string | null;
  canWithdraw: boolean;
  partPaidContact: boolean;
  ownerMadeContact: boolean;
  partPaidLate: boolean;
};

const TRANSFER_STATUSES: ReadonlySet<BookingStatus> = new Set(["awaiting_payment", "deposit_paid", "confirmed", "completed"]);
const ACCESS_STATUSES: ReadonlySet<BookingStatus> = new Set(["confirmed", "completed"]);
const SETTLED_STATUSES: ReadonlySet<BookingStatus> = new Set(["deposit_paid", "paid_in_full", "confirmed", "completed"]);
const SLUG = /^[a-z0-9-]+$/;

/** The stay page of a booking in a language; a slug that is not plain falls back to the list of stays. */
export function stayPagePath(locale: Locale, slug: string): string {
  return localePath(locale, SLUG.test(slug) ? `/private-stays/${slug}` : "/private-stays");
}

/** True when `iso` parses and `nowMs` is before it. An unreadable deadline is never "ahead". */
function before(nowMs: number, iso: string | null): boolean {
  if (iso === null) return false;
  const at = Date.parse(iso);
  return !Number.isNaN(at) && nowMs < at;
}

/** True when `iso` parses and `nowMs` is at or after it. An unreadable deadline is never "passed". */
function atOrAfter(nowMs: number, iso: string | null): boolean {
  if (iso === null) return false;
  const at = Date.parse(iso);
  return !Number.isNaN(at) && nowMs >= at;
}

/**
 * The page's blocks for one view. `nowMs` is the time the view was read (epoch ms). `locale` is the page's language
 * (the links it builds); it defaults to the view's own language.
 */
export function bookingPageModel(view: BookingView, nowMs: number, locale: Locale = isLocale(view.locale) ? view.locale : "en"): BookingPageModel {
  const status = view.status;
  const paid = view.money.paidFils;
  const awaiting = status === "awaiting_payment";
  const closedNetFils = Math.max(0, paid - view.money.refundedFils);

  const transfer: TransferBlock | null =
    view.transfer !== null && TRANSFER_STATUSES.has(status)
      ? {
          kind: awaiting ? "deadline" : "balance",
          amountFils: view.transfer.amountFils,
          payBy: view.transfer.payBy,
          dueBy: view.transfer.dueBy,
        }
      : null;

  const showAccess = view.access !== null && ACCESS_STATUSES.has(status);
  const addressPending = !showAccess && status !== "cancelled" && status !== "expired";

  const balanceLine =
    view.plan === "deposit" && view.money.stillDueFils > 0 && view.balanceDueDate !== null && !awaiting && SETTLED_STATUSES.has(status)
      ? { amountFils: view.money.stillDueFils, dueDate: view.balanceDueDate }
      : null;

  const stayPath = stayPagePath(locale, view.stay.slug);

  const canWithdraw = view.withdrawable === true && awaiting && paid === 0 && before(nowMs, view.deadline);
  const partPaidContact = awaiting && paid > 0;
  const ownerMadeContact = awaiting && paid === 0 && view.withdrawable !== true;
  const partPaidLate = partPaidContact && atOrAfter(nowMs, view.deadline);

  return {
    status,
    transfer,
    showAccess,
    addressPending,
    partReceived: awaiting && view.flags.partReceived,
    nothingMoreDue: view.money.stillDueFils === 0 && SETTLED_STATUSES.has(status),
    acceptedAsPaid: view.flags.writtenOff,
    overpaid: view.flags.overpaid,
    moneyOnClosed: (status === "cancelled" || status === "expired") && closedNetFils > 0,
    closedNetFils,
    refunds: view.refunds.map((r) => ({ refundedOn: r.refundedOn, amountFils: r.amountFils })),
    notSent: status === "held",
    balanceLine,
    stayPath,
    startAgainPath: status === "expired" ? stayPath : null,
    finishPath: status === "held" ? localePath(locale, "/booking/trip") : null,
    canWithdraw,
    partPaidContact,
    ownerMadeContact,
    partPaidLate,
  };
}
