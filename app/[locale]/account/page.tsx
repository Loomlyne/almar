import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AccountScreen } from "./account-screen";
import { createSupabaseServer, readSessionProfile } from "../../../lib/supabase/clients";
import { navAccount } from "../../../lib/auth/nav-account";
import { isLocale, localePath, type Locale } from "../../../lib/locale-path";
import { createSupabaseAnon, savedStayCards } from "../../../lib/saved-stays/server";
import type { SavedStayCard } from "../../../components/site/saved-stays-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

/** Plan 06-07: her saved, published stays. The account page never fails on them: a failed read shows the card empty. */
async function readSavedStays(locale: Locale): Promise<SavedStayCard[]> {
  try {
    const [supabase, anon] = [await createSupabaseServer(), createSupabaseAnon()];
    return supabase && anon ? await savedStayCards(supabase, anon, locale) : [];
  } catch {
    console.error("[saved-stays] account read failed");
    return [];
  }
}

/** /en/account, /ar/account, /es/account (job 21): the page's language is the address's. */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const profile = await readSessionProfile();
  if (!profile) redirect(`${localePath(locale, "/login")}?return=account`);
  return <AccountScreen profile={{ ...profile, locale }} account={navAccount(profile)!} savedStays={await readSavedStays(locale)} />;
}
