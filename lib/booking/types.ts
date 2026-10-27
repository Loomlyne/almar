// The request and response contracts of the booking endpoints (plans 04-02 and 04-08). Types only: no Next, no
// Supabase, no environment. The plans that import from here: 04-03 (trip pages), 04-05 (emails and the booking
// page), 04-06 (the guest's bookings) and 04-09 (the dashboard).
import type { AddOnUnit, DepositBlock, PriceSnapshot } from "../money/booking-price";

export type BookingStatus =
  | "held"
  | "awaiting_payment"
  | "deposit_paid"
  | "paid_in_full"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "expired";

export type Airport = "DXB" | "AUH" | "SHJ";

/**
 * Every reason a quote, a hold, a request or a payment can be refused with (B-02: shown, never silently hidden).
 * The money engine's too_large (a guest total or an amount past the exact-arithmetic bounds) is reported as
 * "invalid" with the same field ("guests" or "amount") and max, so this list stays the signed one.
 * 04-08 adds `requests_closed` (the request gate is closed: one code, never its causes) and `too_many_open` (three
 * open requests for that email, P-05); 04-03 shows both, and `hold_ended`, in English, Arabic and Spanish.
 */
export type ReasonCode =
  | "stay_unavailable"
  | "dates_invalid"
  | "below_min_nights"
  | "over_max_guests"
  | "blocked"
  | "sold_out"
  | "no_rate"
  | "addon_unavailable"
  | "addon_quantity"
  | "settings_missing"
  | "settings_changed"
  | "deposit_unavailable"
  | "below_minimum_charge"
  | "hold_limit"
  | "hold_ending"
  | "hold_ended"
  | "not_payable"
  | "nothing_due"
  | "terms_required"
  | "unavailable"
  | "invalid"
  | "requests_closed"
  | "too_many_open";

export type BookingReason = {
  code: ReasonCode;
  min?: number;
  max?: number;
  nights?: string[];
  id?: string;
  cause?: DepositBlock;
  field?: string;
};

/**
 * `hold` is sent only while the trip page holds one: the server checks the token and then leaves that hold's own
 * nights out of "taken", so a guest's own hold never counts against their own quote.
 */
export type QuoteRequest = {
  stay: string;
  from: string;
  to: string;
  adults: number;
  children: number;
  infants: number;
  addons: { id: string; qty: number }[];
  plan: "deposit" | "full";
  locale: "en" | "ar" | "es";
  hold?: { ref: string; t: string };
};

export type StayCard = {
  slug: string;
  title: string;
  destinationName: string;
  image: { src: string; alt: string } | null;
  maxGuests: number | null;
  minNights: number;
  infantsCount: boolean;
};

export type AddOnOffering = {
  id: string;
  slug: string;
  kind: "experience" | "service";
  unit: AddOnUnit;
  isUae: boolean;
  isHomePickup: boolean;
  name: string;
  image: { src: string; alt: string } | null;
  priceFils: number;
};

/**
 * The price as the browser sees it: the engine's snapshot without each night's rate-range id (an internal key of the
 * stored snapshot; the page has no use for it). Review 2026-10-05.
 */
export type PublicPriceSnapshot = Omit<PriceSnapshot, "nights"> & {
  nights: { night: string; rateFils: number; source: "range" | "base" }[];
};

export type QuoteResponse = {
  ok: boolean;
  reasons: BookingReason[];
  stay: StayCard | null;
  offers: AddOnOffering[];
  inclusions: { id: string; label: string }[];
  breakdown: PublicPriceSnapshot | null;
};

export type ContactInput = {
  name: string;
  email: string;
  phone: string;
  nationality?: string;
  specialRequests?: string;
  emergencyName?: string;
  emergencyPhone?: string;
};

export type TravellerInput = {
  kind: "adult" | "child" | "infant";
  fullName: string;
  age?: number;
  isBooker: boolean;
  notStaying: boolean;
};

export type HoldRequest = QuoteRequest & {
  contact: ContactInput;
  travellers: TravellerInput[];
  airport: Airport;
  pickupAddress?: string;
  termsAccepted: true;
};

/**
 * A successful hold carries `transferWindowMinutes`, the window the request will get (35 on a TEST booking), and
 * `serverNow`, the server's clock when it answered (an ISO instant): the page runs the countdown from it, never from
 * the device's own clock (plan 04-03 review).
 */
export type HoldResponse =
  | {
      ok: true;
      ref: string;
      holdExpiresAt: string;
      linkToken: string;
      breakdown: PublicPriceSnapshot;
      transferWindowMinutes: number;
      serverNow: string;
    }
  | { ok: false; reasons: BookingReason[] };

// ---------------------------------------------------------------- request to book, paid by bank transfer (04-08)

export type BookingLocale = QuoteRequest["locale"];

/** How a payment row was made: a bank transfer the owner recorded, or a card row from 04-02's schema. */
export type PaymentMethod = "bank_transfer" | "card";

/**
 * The owner's bank details and the amount due now, on the booking page and in the request email (PAY-10, PAY-18).
 * `reference` is the booking reference the guest puts on the transfer. `payBy` is the request's deadline (awaiting
 * payment), `dueBy` the balance due date (deposit paid, confirmed, completed); the other one is null.
 */
export type TransferInstructions = {
  accountName: string;
  bankName: string;
  iban: string;
  swift: string;
  bankAddress: string;
  note: string;
  currency: "AED";
  amountFils: number;
  reference: string;
  payBy: string | null;
  dueBy: string | null;
};

/** The stay's address and arrival details: only for a confirmed or completed booking (BOOK-08, OPS-10). */
export type StayAccess = {
  address: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
  doorCode: string | null;
  notes: string | null;
};

/** The guest's three money flags (the owner's rules: part received, more than the total, a gap written off). */
export type BookingViewFlags = { partReceived: boolean; overpaid: boolean; writtenOff: boolean };

/**
 * The guest's booking page (`booking_view`, camelCase). `status` is the display status: an unpaid request past its
 * deadline reads `expired`; a part-paid one stays `awaiting_payment` (P-09). `withdrawable` is true exactly when the
 * guest may withdraw it (P-19). Never the booking id, the phone, the owner's notes or flags, a write-off or a bank
 * reference.
 */
export type BookingView = {
  ref: string;
  status: BookingStatus;
  locale: BookingLocale;
  guest: { name: string; email: string };
  stay: { slug: string; title: string; destinationName: string; image: { src: string; alt: string } | null };
  arrive: string;
  leave: string;
  nights: number;
  adults: number;
  children: number;
  infants: number;
  travellers: { kind: TravellerInput["kind"]; fullName: string; age: number | null; isBooker: boolean; notStaying: boolean }[];
  lines: { name: string; unit: AddOnUnit; quantity: number; unitPriceFils: number; lineFils: number }[];
  airport: Airport | null;
  pickupAddress: string | null;
  plan: "deposit" | "full";
  money: {
    nightsFils: number;
    addonsFils: number;
    subtotalFils: number;
    vatBp: number;
    vatFils: number;
    grandFils: number;
    depositFils: number;
    balanceFils: number;
    paidFils: number;
    dueNowFils: number;
    stillDueFils: number;
  };
  holdExpiresAt: string | null;
  deadline: string | null;
  balanceDueDate: string | null;
  flags: BookingViewFlags;
  withdrawable: boolean;
  payments: { receivedOn: string | null; method: PaymentMethod; amountFils: number }[];
  transfer: TransferInstructions | null;
  access: StayAccess | null;
};

/** One card on the signed-in guest's list (`guest_bookings`). `paidFils` is the settled payments, voids excluded. */
export type GuestBookingSummary = {
  ref: string;
  status: BookingStatus;
  stayTitle: string;
  destinationName: string;
  image: { src: string; alt: string } | null;
  arrive: string;
  leave: string;
  plan: "deposit" | "full";
  grandFils: number;
  paidFils: number;
  stillDueFils: number;
  deadline: string | null;
};

/** POST /api/booking/request: the held booking's reference and its signed link token (link only, like the release). */
export type RequestRequest = { ref: string; t: string };

export type RequestResponse =
  | { ok: true; ref: string; status: BookingStatus; deadline: string | null; firstTime: boolean; emailSent: boolean }
  | { ok: false; reasons?: BookingReason[] };

/** POST /api/booking/view: the token when the page has one, else the signed-in guest's email decides. */
export type ViewRequest = { ref: string; t?: string; locale?: BookingLocale };

export type ViewResponse = { ok: true; booking: BookingView } | { ok: false };

/** POST /api/booking/withdraw (P-19): the view's access rule, no locale. */
export type WithdrawRequest = { ref: string; t?: string };

/** Why a withdraw is refused: a payment is recorded, or the request is past its deadline, lapsed or cancelled. */
export type WithdrawReason = "part_paid" | "not_withdrawable";

export type WithdrawResponse = { ok: true; ref: string; status: "cancelled"; firstTime: boolean } | { ok: false; reason?: WithdrawReason };
