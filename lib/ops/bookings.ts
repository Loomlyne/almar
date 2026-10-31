// Plan 04-09 Task 5: the bindings the eight booking route files import (route files import lib/ops only). The handlers
// are in lib/ops/bookings-api.ts with their dependencies injected; here they get the real ones: 04-08's notifier seam
// (getNotifier), the guest's view (bookingViewById), and the signed booking link (lib/booking/link.ts holds the secret;
// this file never reads it). A link that cannot be signed is null: the receipt then goes without its link.
import type { OwnerContext } from "../auth/require-owner";
import { bookingLinkConfigured, signBookingLink } from "../booking/link";
import { getNotifier } from "../booking/notify";
import { bookingPagePath, originForBooking } from "../booking/origin";
import { bookingViewById } from "../booking/server";
import {
  addNote,
  getBooking,
  listBookings,
  recordPayment,
  recordRefund,
  resendMail,
  resolveAttention,
  setStatus,
  voidPayment,
  voidRefund,
  type AttentionBody,
  type BookingsDeps,
  type NoteBody,
  type PaymentBody,
  type RefundInput,
  type RefundVoidInput,
  type ResendBody,
  type StatusBody,
  type VoidBody,
} from "./bookings-api";

export { parseAttention, parseNote, parsePayment, parseRefund, parseRefundVoid, parseResend, parseStatus, parseVoid } from "./bookings-api";

const deps: BookingsDeps = {
  notifier: getNotifier,
  view: (db, bookingId, opts) => bookingViewById(db, bookingId, opts),
  linkReady: bookingLinkConfigured,
  bookingUrl: async ({ id, ref, locale, isTest, linkVersion }) => {
    if (!bookingLinkConfigured()) return null;
    try {
      const token = await signBookingLink(id, linkVersion);
      return originForBooking(isTest) + bookingPagePath(locale, ref, token);
    } catch {
      return null;
    }
  },
};

type Get = { owner: OwnerContext; url: URL };
type Post<B> = { owner: OwnerContext; body: B };

export const getBookingsRoute = ({ owner, url }: Get) => listBookings({ owner, url });
export const getBookingRoute = ({ owner, url }: Get) => getBooking({ owner, url });
export const postPaymentRoute = ({ owner, body }: Post<PaymentBody>) => recordPayment({ owner, body }, deps);
export const postVoidRoute = ({ owner, body }: Post<VoidBody>) => voidPayment({ owner, body });
export const postRefundRoute = ({ owner, body }: Post<RefundInput>) => recordRefund({ owner, body }, deps);
export const postRefundVoidRoute = ({ owner, body }: Post<RefundVoidInput>) => voidRefund({ owner, body });
export const postStatusRoute = ({ owner, body }: Post<StatusBody>) => setStatus({ owner, body });
export const postNoteRoute = ({ owner, body }: Post<NoteBody>) => addNote({ owner, body });
export const postAttentionRoute = ({ owner, body }: Post<AttentionBody>) => resolveAttention({ owner, body });
export const postResendRoute = ({ owner, body }: Post<ResendBody>) => resendMail({ owner, body }, deps);
