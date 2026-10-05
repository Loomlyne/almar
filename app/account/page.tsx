import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountScreen } from "./account-screen";
import { readSessionProfile } from "../../lib/supabase/clients";
import { navAccount } from "../../lib/auth/nav-account";
import { requestLocale } from "../../lib/request-locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const profile = await readSessionProfile();
  if (!profile) redirect("/login?return=account");
  const locale = await requestLocale(profile.locale);
  return <AccountScreen profile={{ ...profile, locale }} account={navAccount(profile)!} />;
}
