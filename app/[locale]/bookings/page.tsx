import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BookingsScreen } from "./bookings-screen";
import { readSessionProfile } from "../../../lib/supabase/clients";
import { navAccount } from "../../../lib/auth/nav-account";
import { isLocale, localePath } from "../../../lib/locale-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

/** D-19: one line and a way home until Phase 4 brings bookings. /en/bookings, /ar/bookings, /es/bookings (job 21). */
export default async function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const profile = await readSessionProfile();
  if (!profile) redirect(`${localePath(locale, "/login")}?return=bookings`);
  return <BookingsScreen initialLocale={locale} account={navAccount(profile)!} />;
}
