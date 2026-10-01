import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookingsScreen } from "./bookings-screen";
import { readSessionProfile } from "../../lib/supabase/clients";
import { navAccount } from "../../lib/auth/nav-account";
import { requestLocale } from "../../lib/request-locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

/** D-19: one line and a way home until Phase 4 brings bookings. */
export default async function BookingsPage() {
  const profile = await readSessionProfile();
  if (!profile) redirect("/login?return=bookings");
  return <BookingsScreen initialLocale={await requestLocale(profile.locale)} account={navAccount(profile)!} />;
}
