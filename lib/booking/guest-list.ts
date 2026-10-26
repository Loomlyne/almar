// Plan 04-06 (Task 1b step 3, Task 4): the signed-in guest's /bookings list. `GuestCard` is the display shape the
// screen draws; `toGuestCards` builds it from 04-08's `GuestBookingSummary` rows; `loadGuestBookings` makes the one
// `guest_bookings` read for the session's email (AUTH-01, B-10).
//
// Server code: this file imports `./server`, so client files (the screen, the harness scene) take `GuestCard` with
// `import type` only. No environment, no Next, no Supabase import: the page passes the service-role client as `db`,
// the email from `readSessionProfile()` only (never the URL, a body or a cookie) and the host's TEST flag.
// No money arithmetic: every amount is `formatAed` of a stored fils value. List links carry the ref only, never the
// signed link token, so the booking page re-checks the session.
import { formatAed } from "../money/format";
import { formatDate, formatRange } from "../format";
import { bookingPagePath } from "./origin";
import { listGuestBookings, type BookingDb } from "./server";
import { uaeDateTime } from "./trip-format";
import type { BookingLocale, BookingStatus, GuestBookingSummary } from "./types";

export type GuestCard = {
  reference: string;
  status: Exclude<BookingStatus, "held">;
  tab: "upcoming" | "past" | "cancelled";
  title: string;
  place: string;
  image: { src: string; alt: string } | null;
  dates: string;
  total: string;
  /** The formatted `paidFils` (settled payments, voids excluded); null when nothing is paid (P6-07). */
  paid: string | null;
  stillDue: string | null;
  payBy: { date: string; time: string } | null;
  href: string;
};

type ListedSummary = GuestBookingSummary & { status: Exclude<BookingStatus, "held"> };

function isListed(item: GuestBookingSummary): item is ListedSummary {
  return item.status !== "held";
}

/**
 * P6-09, not yet signed by the owner: option 1 (recommended) is built, a trip stays Upcoming through its departure
 * day, so a trip under way is Upcoming. Option 2 (Past from its arrival day) is this one line:
 * `return item.arrive > today;`. ISO days compare as text.
 */
function stillAhead(item: GuestBookingSummary, today: string): boolean {
  return item.leave >= today;
}

/** Completed is always Past and cancelled / expired always Cancelled; every other status goes by its dates. */
function tabOf(item: ListedSummary, today: string): GuestCard["tab"] {
  if (item.status === "cancelled" || item.status === "expired") return "cancelled";
  if (item.status === "completed") return "past";
  return stillAhead(item, today) ? "upcoming" : "past";
}

/** "2026-11-20" -> "20/11/2026"; anything else is shown as it came, never thrown. */
function dayText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? formatDate(Number(m[3]), Number(m[2]), Number(m[1])) : iso;
}

/** The pay-by line only while awaiting payment with a deadline; a deadline `uaeDateTime` cannot read gives null. */
function payByOf(item: ListedSummary): GuestCard["payBy"] {
  if (item.status !== "awaiting_payment" || !item.deadline) return null;
  try {
    return uaeDateTime(item.deadline);
  } catch {
    return null;
  }
}

function toCard(item: ListedSummary, locale: BookingLocale, today: string): GuestCard {
  return {
    reference: item.ref,
    status: item.status,
    tab: tabOf(item, today),
    title: item.stayTitle,
    place: item.destinationName,
    image: item.image,
    dates: formatRange(dayText(item.arrive), dayText(item.leave)),
    total: formatAed(item.grandFils),
    // P6-07, not yet signed: option 1 (recommended) is built, a Paid line when something is paid. Option 2 removes
    // `paid` from GuestCard and this line (Task 4 action step 2).
    paid: item.paidFils > 0 ? formatAed(item.paidFils) : null,
    stillDue: item.stillDueFils === 0 ? null : formatAed(item.stillDueFils),
    payBy: payByOf(item),
    href: bookingPagePath(locale, item.ref),
  };
}

const TAB_ORDER: readonly GuestCard["tab"][] = ["upcoming", "past", "cancelled"];

/** Upcoming soonest first; Past and Cancelled latest first. Same arrival: by reference, so the order is stable. */
function compareCards(a: { card: GuestCard; arrive: string }, b: { card: GuestCard; arrive: string }): number {
  const tabs = TAB_ORDER.indexOf(a.card.tab) - TAB_ORDER.indexOf(b.card.tab);
  if (tabs !== 0) return tabs;
  if (a.arrive !== b.arrive) {
    const later = a.arrive > b.arrive ? 1 : -1;
    return a.card.tab === "upcoming" ? later : -later;
  }
  return a.card.reference < b.card.reference ? -1 : a.card.reference > b.card.reference ? 1 : 0;
}

/**
 * The list's cards: held rows dropped (the SQL never sends one), each row sorted into Upcoming, Past or Cancelled by
 * `today` (the Dubai day, from the caller's clock), grouped in that tab order and sorted within each tab.
 */
export function toGuestCards(
  items: readonly GuestBookingSummary[],
  opts: { locale: BookingLocale; today: string },
): GuestCard[] {
  return items
    .filter(isListed)
    .map((item) => ({ card: toCard(item, opts.locale, opts.today), arrive: item.arrive }))
    .sort(compareCards)
    .map((entry) => entry.card);
}

/**
 * The session guest's bookings, or null when they cannot be read: no admin client or no email means no call; the
 * email is trimmed and lower-cased (the SQL filters `lower(email)`); a failed or unreadable answer is null, never a
 * throw, so the page shows its try-again line.
 */
export async function loadGuestBookings(input: {
  db: BookingDb | null;
  email: string | null | undefined;
  locale: BookingLocale;
  isTest: boolean;
}): Promise<GuestBookingSummary[] | null> {
  const { db } = input;
  if (!db) return null;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email) return null;
  try {
    return await listGuestBookings(db, { email, locale: input.locale, isTest: input.isTest });
  } catch {
    return null;
  }
}
