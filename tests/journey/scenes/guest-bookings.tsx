import { BookingsScreen } from "../../../app/[locale]/bookings/bookings-screen";
import type { GuestCard } from "../../../lib/booking/guest-list";
import type { Scenes } from "../scene-types";
import { IMAGES } from "./_images";

// Plan 04-06 (Task 1b step 6): the signed-in guest's /bookings list, the states of the signed picture page
// (.planning/phases/04-book-and-pay/pictures/04-06/index.html; owner 2026-10-27: P6-07 option 1, P6-09 option 1).
// Symbolic data only: AED [AMOUNT], [DD/MM/YYYY], [HH:MM], [Stay name], [Destination], references like ALMAR-7K3QH9;
// never a real price, date or person. The account is guest-account.tsx's fixture guest. `GuestCard` by type only
// (lib/booking/guest-list.ts imports server code). Each card's `tab` is fixed here, as the page computed it.

type Locale = "en" | "ar" | "es";

const account = { name: "Layla Haddad", email: "guest@example.com" };

const AMOUNT = "AED [AMOUNT]";
const RANGE = "[DD/MM/YYYY] – [DD/MM/YYYY]";
const PAY_BY = { date: "[DD/MM/YYYY]", time: "[HH:MM]" };

type Row = {
  reference: string;
  status: GuestCard["status"];
  tab: GuestCard["tab"];
  photo: boolean;
  /** Something paid: the Paid line under P6-07 option 1. */
  paid: boolean;
  stillDue: boolean;
  payBy: boolean;
  dates?: string;
};

/** The base card set of the picture page, in the order the page sorts them within each tab. */
const BASE: Row[] = [
  // awaiting payment, nothing paid, Pay by
  { reference: "ALMAR-7K3QH9", status: "awaiting_payment", tab: "upcoming", photo: true, paid: false, stillDue: true, payBy: true },
  // awaiting payment, part paid, its Pay by already passed (04-08 P-09: the nights are kept; the booking page explains)
  { reference: "ALMAR-4MZ8RT", status: "awaiting_payment", tab: "upcoming", photo: true, paid: true, stillDue: true, payBy: true },
  { reference: "ALMAR-9PXW2C", status: "deposit_paid", tab: "upcoming", photo: true, paid: true, stillDue: true, payBy: false },
  { reference: "ALMAR-H6TQ3N", status: "paid_in_full", tab: "upcoming", photo: true, paid: true, stillDue: false, payBy: false },
  // no photo: the teal-tint block
  { reference: "ALMAR-2DKV7Y", status: "confirmed", tab: "upcoming", photo: false, paid: true, stillDue: false, payBy: false },
  { reference: "ALMAR-R8BN5J", status: "completed", tab: "past", photo: true, paid: true, stillDue: false, payBy: false },
  { reference: "ALMAR-W3FH6Q", status: "cancelled", tab: "cancelled", photo: true, paid: false, stillDue: false, payBy: false },
  // a lapsed request: chip JOURNEY_COPY.bookingStatus.expired, in Cancelled (P6-08)
  { reference: "ALMAR-5YCM9K", status: "expired", tab: "cancelled", photo: true, paid: false, stillDue: false, payBy: false },
];

/** A confirmed trip under way (arrived, not yet left): Upcoming until its departure day (P6-09 option 1). */
const UNDER_WAY: Row = {
  reference: "ALMAR-T7GJ4P",
  status: "confirmed",
  tab: "upcoming",
  photo: true,
  paid: true,
  stillDue: false,
  payBy: false,
  dates: "[started DD/MM/YYYY] – [ends DD/MM/YYYY]",
};

/** `withPaid`: the Paid line on every card with a payment (P6-07 option 1, what the page builds). */
function card(row: Row, i: number, locale: Locale, withPaid: boolean): GuestCard {
  return {
    reference: row.reference,
    status: row.status,
    tab: row.tab,
    title: "[Stay name]",
    place: "[Destination]",
    image: row.photo ? IMAGES[i % IMAGES.length] : null,
    dates: row.dates ?? RANGE,
    total: AMOUNT,
    paid: withPaid && row.paid ? AMOUNT : null,
    stillDue: row.stillDue ? AMOUNT : null,
    payBy: row.payBy ? PAY_BY : null,
    href: `/${locale}/bookings/trip?ref=${row.reference}`,
  };
}

const cards = (rows: Row[], locale: Locale, withPaid: boolean) => rows.map((row, i) => card(row, i, locale, withPaid));

const screen = (locale: Locale, list: GuestCard[] | null) => (
  <BookingsScreen initialLocale={locale} account={account} cards={list} />
);

export const scenes: Scenes = {
  // No booking at all: today's empty state, no tabs.
  empty: ({ locale }) => screen(locale, []),
  // The base set with no Paid line, as drawn on the signed page's `upcoming` frame.
  upcoming: ({ locale }) => screen(locale, cards(BASE, locale, false)),
  // P6-07 option 1 (signed): Paid AED [AMOUNT] on every card with a payment.
  "upcoming-with-paid": ({ locale }) => screen(locale, cards(BASE, locale, true)),
  // P6-09 option 1 (signed): the trip under way (last Upcoming card) stays under Upcoming.
  "upcoming-in-progress": ({ locale }) => screen(locale, cards([...BASE.filter((r) => r.tab === "upcoming"), UNDER_WAY, ...BASE.filter((r) => r.tab !== "upcoming")], locale, true)),
  // The spec clicks the Past tab.
  past: ({ locale }) => screen(locale, cards(BASE, locale, true)),
  // The spec clicks the Cancelled tab: a cancelled booking and a lapsed request.
  cancelled: ({ locale }) => screen(locale, cards(BASE, locale, true)),
  // Bookings only in Past, Upcoming open: its empty line.
  "tab-empty": ({ locale }) => screen(locale, cards(BASE.filter((r) => r.tab === "past"), locale, true)),
  // The list could not be read: the line and a secondary Try again.
  error: ({ locale }) => screen(locale, null),
};
