// Phase 5 plan 05-01: the contract of the owner's bank-refund routes (PAY-12, P5-06, P5-07, B-25, B-31). Types only:
// `import type` only and no runtime export, so nothing here enters a bundle. 05-03 builds the routes and screens from it.
// A refund is recorded, never sent; it changes no status, no paid amount and no amount still due (P-06).
import type { OwnerFlags } from "./booking-rules";
import type { MailResult } from "./bookings-api";

/** POST /api/ops/booking/refund. amount: AED text, parseAedAmount. request_id made when the dialog opens. */
export type RefundRecordBody = {
  booking_id: string;
  request_id: string;
  amount: string;
  refunded_on: string;
  bank_reference: string;
  reason: string | null;
};
/** What ops_record_refund answers. A replay: first_time false, no mail. */
export type RefundRecordRow = {
  first_time: boolean;
  booking_id: string;
  ref: string;
  refund_id: number;
  amount_fils: number;
  refunded_on: string;
  paid_fils: number;
  refunded_fils: number;
  refundable_fils: number;
  attention_cleared: boolean;
  flags: OwnerFlags;
  is_test: boolean;
  locale: "en" | "ar" | "es";
  link_version: number;
};
export type RefundRecordAnswer = { ok: true; refund: RefundRecordRow; mail: MailResult };

/** POST /api/ops/booking/refund-void. reason 3..300. */
export type RefundVoidBody = { refund_id: number; reason: string };
export type RefundVoidRow = {
  first_time: boolean;
  booking_id: string;
  ref: string;
  refund_id: number;
  amount_fils: number;
  paid_fils: number;
  refunded_fils: number;
  attention_raised: boolean;
  flags: OwnerFlags;
};
export type RefundVoidAnswer = { ok: true; void: RefundVoidRow };

/** One more arm of ResendBody on POST /api/ops/booking/resend. Mail key: resend/<booking_id>/<request_id>. */
export type RefundResendBody = { ref: string; kind: "refund"; refund_id: number; request_id: string };

/** Refusals, 409 unless noted: above_paid, nothing_to_refund, not_voidable, changed; not_found 404; not_owner 403; invalid 400. ops_void_payment adds refund_first. */
export type RefundRefusal = "above_paid" | "nothing_to_refund" | "not_voidable" | "changed" | "not_found" | "not_owner" | "invalid" | "refund_first";
