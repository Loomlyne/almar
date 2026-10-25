import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignInScreen } from "./sign-in-screen";
import { readSessionProfile } from "../../../lib/supabase/clients";
import { returnCookieName, safeReturnPath } from "../../../lib/auth/rules";
import { isLocale, localePath } from "../../../lib/locale-path";
import { localizedReturnPath } from "../../../lib/account-preferences";

export const dynamic = "force-dynamic";

// English paths; the page's own language prefix is added below (job 21).
const RETURN_KEYS: Record<string, string> = { account: "/account", bookings: "/bookings" };

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/** /en/login, /ar/login, /es/login (job 21): the language comes from the address, so lang and dir are right in the first bytes. */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ expired?: string; return?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const store = await cookies();
  const query = await searchParams;
  // `return` is a key from a fixed list, never a URL, so it cannot redirect off-site.
  const key = query.return ?? "";
  const returnTo = Object.hasOwn(RETURN_KEYS, key)
    ? localePath(locale, RETURN_KEYS[key])
    : localizedReturnPath(safeReturnPath(store.get(returnCookieName())?.value), locale);
  if (await readSessionProfile()) redirect(returnTo);

  const { expired } = query;
  return (
    <SignInScreen
      initialLocale={locale}
      returnTo={returnTo}
      expired={expired === "1"}
    />
  );
}
