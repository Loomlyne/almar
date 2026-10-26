// Plan 04-05 (Tasks 1 and 2): fake BookingView and mail-job fixtures for every email and booking page state. Pure data,
// no network, no database. Documentation values only (E-06): repeating-digit amounts in fils, bracketed names, the
// public example IBAN AE07 0331 2345 6789 0123 456 and BIC TESTAEAAXXX (never a real bank's: the repo is public), the
// reference ALMAR-TEST22 and an obviously fake link token. The page scenes pass FIXTURE_NOW as the time the view was
// read, so the Withdraw control and the late line never depend on the clock.
import type { BookingStatus, BookingView, StayAccess, TransferInstructions } from "../../lib/booking/types";
import type { LapseMailJob, PaymentMailJob, RequestMailJob } from "../../lib/booking/notify";
import { bookingPagePath, originForBooking } from "../../lib/booking/origin";

export type FixtureLocale = "en" | "ar" | "es";

export type ViewState =
  | "awaiting"
  | "awaiting-owner-made"
  | "part-received"
  | "part-paid-late"
  | "deposit-balance"
  | "paid-full"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "withdrawn"
  | "expired"
  | "not-sent";

export const VIEW_STATES: readonly ViewState[] = [
  "awaiting",
  "awaiting-owner-made",
  "part-received",
  "part-paid-late",
  "deposit-balance",
  "paid-full",
  "confirmed",
  "completed",
  "cancelled",
  "withdrawn",
  "expired",
  "not-sent",
];

export type PaymentVariant = "part" | "deposit" | "full" | "written-off" | "overpaid" | "after-expiry";

export const PAYMENT_VARIANTS: readonly PaymentVariant[] = ["part", "deposit", "full", "written-off", "overpaid", "after-expiry"];

/** The time every page scene reads its view at: 2026-11-02 08:00 UTC (12:00 UAE time). */
export const FIXTURE_NOW = Date.parse("2026-11-02T08:00:00Z");

/** One day after FIXTURE_NOW (the deadline still ahead) and one day before it (the deadline passed). */
export const DEADLINE_AHEAD = "2026-11-03T08:00:00+00:00";
export const DEADLINE_PASSED = "2026-11-01T08:00:00+00:00";
export const HOLD_ENDS = "2026-11-02T08:30:00+00:00";

export const FIXTURE_REF = "ALMAR-TEST22";
export const FIXTURE_BOOKING_ID = "00000000-0000-4000-8000-000000000522";
export const FIXTURE_PAYMENT_ID = "00000000-0000-4000-8000-0000000005c1";

/** 43 base64url characters, the shape 04-08's token check accepts; it verifies against no secret. */
export const FAKE_LINK_TOKEN = "fake-link-token-for-tests-only-000000000000";

export const FIXTURE_ARRIVE = "2026-12-10";
export const FIXTURE_LEAVE = "2026-12-15";
export const FIXTURE_BALANCE_DUE = "2026-11-26";
export const FIXTURE_RECEIVED_ON = "2026-11-02";

/** Symbolic fils (E-06): AED 3,333.33 nights + AED 1,111.11 add-ons, VAT 5% AED 222.22, total AED 4,666.66. */
export const FILS = Object.freeze({
  nights: 333333,
  addons: 111111,
  subtotal: 444444,
  vatBp: 500,
  vat: 22222,
  grand: 466666,
  deposit: 222222,
  balance: 244444,
  part: 111111,
  depositShort: 222200,
  extra: 11111,
});

/** The IBAN as stored (no spaces): the public documentation example for the UAE. */
export const FIXTURE_IBAN = "AE070331234567890123456";
export const FIXTURE_SWIFT = "TESTAEAAXXX";

type Words = {
  guestName: string;
  travellerName: string;
  childName: string;
  stayTitle: string;
  destination: string;
  imageAlt: string;
  addonName: string;
  pickupAddress: string;
  accountName: string;
  bankName: string;
  bankAddress: string;
  note: string;
  stayAddress: string;
  wifiName: string;
  wifiPassword: string;
  doorCode: string;
  arrivalNotes: string;
};

/** Bracketed placeholders in each language: never a real name, place or bank value. */
export const FIXTURE_WORDS: Record<FixtureLocale, Words> = {
  en: {
    guestName: "[Guest name]",
    travellerName: "[Traveller name]",
    childName: "[Child name]",
    stayTitle: "[Stay name]",
    destination: "[Destination]",
    imageAlt: "[Stay photo description]",
    addonName: "[Add-on name]",
    pickupAddress: "[Pickup address]",
    accountName: "[Account name]",
    bankName: "[Bank name]",
    bankAddress: "[Bank address]",
    note: "[Note line]",
    stayAddress: "[Stay address]",
    wifiName: "[Wi-Fi name]",
    wifiPassword: "[Wi-Fi password]",
    doorCode: "[Door code]",
    arrivalNotes: "[Arrival notes]",
  },
  ar: {
    guestName: "[اسم الضيف]",
    travellerName: "[اسم المسافر]",
    childName: "[اسم الطفل]",
    stayTitle: "[اسم الإقامة]",
    destination: "[الوجهة]",
    imageAlt: "[وصف صورة الإقامة]",
    addonName: "[اسم الإضافة]",
    pickupAddress: "[عنوان الاستقبال]",
    accountName: "[اسم الحساب]",
    bankName: "[اسم البنك]",
    bankAddress: "[عنوان البنك]",
    note: "[سطر الملاحظة]",
    stayAddress: "[عنوان الإقامة]",
    wifiName: "[اسم شبكة الواي فاي]",
    wifiPassword: "[كلمة مرور الواي فاي]",
    doorCode: "[رمز الباب]",
    arrivalNotes: "[ملاحظات الوصول]",
  },
  es: {
    guestName: "[Nombre del huésped]",
    travellerName: "[Nombre del viajero]",
    childName: "[Nombre del niño]",
    stayTitle: "[Nombre de la estancia]",
    destination: "[Destino]",
    imageAlt: "[Descripción de la foto de la estancia]",
    addonName: "[Nombre del extra]",
    pickupAddress: "[Dirección de recogida]",
    accountName: "[Nombre de la cuenta]",
    bankName: "[Nombre del banco]",
    bankAddress: "[Dirección del banco]",
    note: "[Línea de nota]",
    stayAddress: "[Dirección de la estancia]",
    wifiName: "[Nombre del wifi]",
    wifiPassword: "[Contraseña del wifi]",
    doorCode: "[Código de la puerta]",
    arrivalNotes: "[Notas de llegada]",
  },
};

export const FIXTURE_SLUG = "test-stay";
export const FIXTURE_EMAIL = "guest@example.com";
export const FIXTURE_RECORDED_BY = "owner@example.com";

function words(locale: FixtureLocale): Words {
  return FIXTURE_WORDS[locale] ?? FIXTURE_WORDS.en;
}

function transfer(locale: FixtureLocale, amountFils: number, payBy: string | null, dueBy: string | null): TransferInstructions {
  const w = words(locale);
  return {
    accountName: w.accountName,
    bankName: w.bankName,
    iban: FIXTURE_IBAN,
    swift: FIXTURE_SWIFT,
    bankAddress: w.bankAddress,
    note: w.note,
    currency: "AED",
    amountFils,
    reference: FIXTURE_REF,
    payBy,
    dueBy,
  };
}

/** Stay details with values: the confirmed and completed views carry them; no email may print any of them. */
export function accessFixture(locale: FixtureLocale): StayAccess {
  const w = words(locale);
  return { address: w.stayAddress, wifiName: w.wifiName, wifiPassword: w.wifiPassword, doorCode: w.doorCode, notes: w.arrivalNotes };
}

function base(locale: FixtureLocale, status: BookingStatus, plan: "deposit" | "full"): BookingView {
  const w = words(locale);
  return {
    ref: FIXTURE_REF,
    status,
    locale,
    guest: { name: w.guestName, email: FIXTURE_EMAIL },
    stay: { slug: FIXTURE_SLUG, title: w.stayTitle, destinationName: w.destination, image: null },
    arrive: FIXTURE_ARRIVE,
    leave: FIXTURE_LEAVE,
    nights: 5,
    adults: 2,
    children: 1,
    infants: 0,
    travellers: [
      { kind: "adult", fullName: w.guestName, age: null, isBooker: true, notStaying: false },
      { kind: "adult", fullName: w.travellerName, age: null, isBooker: false, notStaying: false },
      { kind: "child", fullName: w.childName, age: 7, isBooker: false, notStaying: false },
    ],
    lines: [{ name: w.addonName, unit: "trip", quantity: 1, unitPriceFils: FILS.addons, lineFils: FILS.addons }],
    airport: "DXB",
    pickupAddress: w.pickupAddress,
    plan,
    money: {
      nightsFils: FILS.nights,
      addonsFils: FILS.addons,
      subtotalFils: FILS.subtotal,
      vatBp: FILS.vatBp,
      vatFils: FILS.vat,
      grandFils: FILS.grand,
      depositFils: plan === "deposit" ? FILS.deposit : 0,
      balanceFils: plan === "deposit" ? FILS.balance : 0,
      paidFils: 0,
      dueNowFils: 0,
      stillDueFils: FILS.grand,
    },
    holdExpiresAt: null,
    deadline: null,
    balanceDueDate: plan === "deposit" ? FIXTURE_BALANCE_DUE : null,
    flags: { partReceived: false, overpaid: false, writtenOff: false },
    withdrawable: false,
    payments: [],
    transfer: null,
    access: null,
  };
}

function payment(amountFils: number): BookingView["payments"][number] {
  return { receivedOn: FIXTURE_RECEIVED_ON, method: "bank_transfer", amountFils };
}

/** An awaiting_payment request with nothing paid; `plan` decides what is due now (the deposit or the total). */
function awaiting(locale: FixtureLocale, plan: "deposit" | "full", withdrawable: boolean): BookingView {
  const view = base(locale, "awaiting_payment", plan);
  const dueNow = plan === "deposit" ? FILS.deposit : FILS.grand;
  view.money.dueNowFils = dueNow;
  view.deadline = DEADLINE_AHEAD;
  view.withdrawable = withdrawable;
  view.transfer = transfer(locale, dueNow, DEADLINE_AHEAD, null);
  return view;
}

function partReceived(locale: FixtureLocale, deadline: string): BookingView {
  const view = base(locale, "awaiting_payment", "deposit");
  const due = FILS.deposit - FILS.part;
  view.money.paidFils = FILS.part;
  view.money.dueNowFils = due;
  view.money.stillDueFils = FILS.grand - FILS.part;
  view.deadline = deadline;
  view.flags.partReceived = true;
  view.payments = [payment(FILS.part)];
  view.transfer = transfer(locale, due, deadline, null);
  return view;
}

/** A deposit received in full (the receipt-deposit variant): the balance and its due date remain. */
function depositPaid(locale: FixtureLocale): BookingView {
  const view = base(locale, "deposit_paid", "deposit");
  view.money.paidFils = FILS.deposit;
  view.money.dueNowFils = FILS.balance;
  view.money.stillDueFils = FILS.balance;
  view.payments = [payment(FILS.deposit)];
  view.transfer = transfer(locale, FILS.balance, null, FIXTURE_BALANCE_DUE);
  return view;
}

function paidFull(locale: FixtureLocale, status: BookingStatus): BookingView {
  const view = base(locale, status, "full");
  view.money.paidFils = FILS.grand;
  view.money.stillDueFils = 0;
  view.payments = [payment(FILS.grand)];
  return view;
}

/** A full BookingView for one page state, with the E-06 values in that language. */
export function viewFixture(state: ViewState, locale: FixtureLocale): BookingView {
  switch (state) {
    case "awaiting":
      return awaiting(locale, "deposit", true);
    case "awaiting-owner-made":
      return awaiting(locale, "deposit", false);
    case "part-received":
      return partReceived(locale, DEADLINE_AHEAD);
    case "part-paid-late":
      return partReceived(locale, DEADLINE_PASSED);
    case "deposit-balance": {
      // Accepted as paid (B-33): the deposit arrived 22 fils short and the owner wrote the gap off.
      const view = depositPaid(locale);
      view.money.paidFils = FILS.depositShort;
      view.flags.writtenOff = true;
      view.payments = [payment(FILS.depositShort)];
      return view;
    }
    case "paid-full":
      return paidFull(locale, "paid_in_full");
    case "confirmed": {
      const view = paidFull(locale, "confirmed");
      view.access = accessFixture(locale);
      return view;
    }
    case "completed": {
      const view = paidFull(locale, "completed");
      view.money.paidFils = FILS.grand + FILS.extra;
      view.flags.overpaid = true;
      view.payments = [payment(FILS.grand), payment(FILS.extra)];
      view.access = accessFixture(locale);
      return view;
    }
    case "cancelled": {
      const view = base(locale, "cancelled", "deposit");
      view.money.paidFils = FILS.part;
      view.money.stillDueFils = FILS.grand - FILS.part;
      view.payments = [payment(FILS.part)];
      return view;
    }
    case "withdrawn":
      // R2: the view read again after a withdraw: cancelled, nothing paid, no transfer, no stay details.
      return base(locale, "cancelled", "deposit");
    case "expired":
      // R1: only an unpaid request lapses.
      return base(locale, "expired", "deposit");
    case "not-sent": {
      const view = base(locale, "held", "deposit");
      view.holdExpiresAt = HOLD_ENDS;
      return view;
    }
  }
}

/** The guest's signed booking page link, as the request route builds it (preview origin, E-06). */
export function bookingUrlFixture(locale: FixtureLocale): string {
  return originForBooking(true) + bookingPagePath(locale, FIXTURE_REF, FAKE_LINK_TOKEN);
}

export function requestJobFixture(
  locale: FixtureLocale,
  options: { isTest?: boolean; plan?: "deposit" | "full" } = {},
): RequestMailJob {
  return {
    bookingId: FIXTURE_BOOKING_ID,
    view: awaiting(locale, options.plan ?? "deposit", true),
    isTest: options.isTest ?? false,
    bookingUrl: bookingUrlFixture(locale),
  };
}

/** The owner's withdrawn notice job (R2): the withdrawn view; its bookingUrl is never printed by the notice. */
export function withdrawnJobFixture(locale: FixtureLocale, options: { isTest?: boolean } = {}): RequestMailJob {
  return {
    bookingId: FIXTURE_BOOKING_ID,
    view: viewFixture("withdrawn", locale),
    isTest: options.isTest ?? false,
    bookingUrl: bookingUrlFixture(locale),
  };
}

export function paymentJobFixture(
  variant: PaymentVariant,
  locale: FixtureLocale,
  options: { isTest?: boolean } = {},
): PaymentMailJob {
  const common = {
    bookingId: FIXTURE_BOOKING_ID,
    paymentId: FIXTURE_PAYMENT_ID,
    isTest: options.isTest ?? false,
    bookingUrl: bookingUrlFixture(locale),
    receivedOn: FIXTURE_RECEIVED_ON,
    sentAtMs: FIXTURE_NOW,
    recordedByEmail: FIXTURE_RECORDED_BY,
  };
  switch (variant) {
    case "part":
      return {
        ...common,
        view: viewFixture("part-received", locale),
        amountFils: FILS.part,
        statusBefore: "awaiting_payment",
        statusAfter: "awaiting_payment",
        attentionReason: null,
      };
    case "deposit":
      return {
        ...common,
        view: depositPaid(locale),
        amountFils: FILS.deposit,
        statusBefore: "awaiting_payment",
        statusAfter: "deposit_paid",
        attentionReason: null,
      };
    case "full":
      return {
        ...common,
        view: viewFixture("paid-full", locale),
        amountFils: FILS.grand,
        statusBefore: "awaiting_payment",
        statusAfter: "paid_in_full",
        attentionReason: null,
      };
    case "written-off": {
      const view = viewFixture("paid-full", locale);
      view.flags.writtenOff = true;
      view.money.stillDueFils = 0;
      return {
        ...common,
        view,
        amountFils: FILS.balance,
        statusBefore: "deposit_paid",
        statusAfter: "paid_in_full",
        attentionReason: null,
      };
    }
    case "overpaid": {
      const view = viewFixture("paid-full", locale);
      view.flags.overpaid = true;
      view.money.paidFils = FILS.grand + FILS.extra;
      view.payments = [payment(FILS.grand + FILS.extra)];
      return {
        ...common,
        view,
        amountFils: FILS.grand + FILS.extra,
        statusBefore: "awaiting_payment",
        statusAfter: "paid_in_full",
        attentionReason: "overpaid",
      };
    }
    case "after-expiry": {
      // Money recorded after an unpaid lapse (R1: paid_after_expiry); the view stays expired.
      const view = viewFixture("expired", locale);
      view.money.paidFils = FILS.part;
      view.money.stillDueFils = FILS.grand - FILS.part;
      view.payments = [payment(FILS.part)];
      return {
        ...common,
        view,
        amountFils: FILS.part,
        statusBefore: "expired",
        statusAfter: "expired",
        attentionReason: "paid_after_expiry",
      };
    }
  }
}

export function lapseJobFixture(locale: FixtureLocale, options: { isTest?: boolean } = {}): LapseMailJob {
  const w = words(locale);
  return {
    bookingId: FIXTURE_BOOKING_ID,
    ref: FIXTURE_REF,
    email: FIXTURE_EMAIL,
    guestName: w.guestName,
    locale,
    isTest: options.isTest ?? false,
    staySlug: FIXTURE_SLUG,
    stayTitle: w.stayTitle,
    arrive: FIXTURE_ARRIVE,
    leave: FIXTURE_LEAVE,
    deadline: DEADLINE_PASSED,
  };
}
