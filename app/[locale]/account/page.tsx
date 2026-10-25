import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AccountScreen } from "./account-screen";
import { readSessionProfile } from "../../../lib/supabase/clients";
import { navAccount } from "../../../lib/auth/nav-account";
import { isLocale, localePath } from "../../../lib/locale-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

/** /en/account, /ar/account, /es/account (job 21): the page's language is the address's. */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const profile = await readSessionProfile();
  if (!profile) redirect(`${localePath(locale, "/login")}?return=account`);
  return <AccountScreen profile={{ ...profile, locale }} account={navAccount(profile)!} />;
}
