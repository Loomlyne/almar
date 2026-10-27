import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BookingsScreen } from "./bookings-screen";
import { createSupabaseAdmin, readSessionProfile } from "../../../lib/supabase/clients";
import { navAccount } from "../../../lib/auth/nav-account";
import { isLocale, localePath } from "../../../lib/locale-path";
import { loadGuestBookings, toGuestCards, type GuestCard } from "../../../lib/booking/guest-list";
import { isTestHost } from "../../../lib/booking/origin";
import { dubaiToday } from "../../../lib/money/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

/** Plan 04-06: the bookings made with the signed-in session's own email on this host's TEST or real side (never an address from the URL, a body or a cookie). */
export default async function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const profile = await readSessionProfile();
  if (!profile) redirect(`${localePath(locale, "/login")}?return=bookings`);
  const host = (await headers()).get("host");
  const items = await loadGuestBookings({ db: createSupabaseAdmin(), email: profile.email, locale, isTest: isTestHost(host) });
  let cards: GuestCard[] | null = null;
  try {
    // One row toGuestCards cannot format (formatAed throws on a negative amount) shows Try again, never a crash.
    cards = items ? toGuestCards(items, { locale, today: dubaiToday(new Date()) }) : null;
  } catch {
    cards = null;
  }
  return <BookingsScreen initialLocale={locale} account={navAccount(profile)!} cards={cards} />;
}
